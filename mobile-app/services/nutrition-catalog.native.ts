import { File, Paths } from 'expo-file-system';
import {
  createDownloadResumable,
  FileSystemSessionType,
  getInfoAsync,
} from 'expo-file-system/legacy';
import {
  importDatabaseFromAssetAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';

import { LOCAL_NUTRITION_PREFERRED_ALIASES } from '@/data/local-nutrition-aliases';
import { normalizeNutritionAlias } from '@/data/local-nutrition-aliases';
import {
  NUTRITION_CATALOG_SCHEMA_VERSION,
  NUTRITION_CORE_CATALOG_VERSION,
  NUTRITION_PORTION_UNITS,
  NUTRITION_PRODUCT_INDEX_VERSION,
} from '@/data/nutrition-catalog-schema';
import {
  estimateLocalNutritionFromMatches,
  isAmbiguousNutritionFoodQuery,
  nutritionFamilyFoodIds,
  nutritionFoodQueryWords,
  rankLocalNutritionSuggestions,
} from '@/services/local-nutrition-estimator';
import { remoteNutritionCatalogConfig } from '@/services/nutrition-catalog-config';
import { barcodeLookupCandidates } from '@/services/product-barcode';
import type {
  NutritionCatalog,
  NutritionCatalogStatus,
  ProductBarcodeRecord,
} from '@/services/nutrition-catalog';
import type { ProductBarcodeType } from '@/services/product-barcode';
import type {
  LocalNutritionPortionUnit,
  LocalNutritionReferenceFood,
} from '@/types/nutrition';

const CORE_DATABASE_NAME = `nutrition-core-${NUTRITION_CORE_CATALOG_VERSION}-v${NUTRITION_CATALOG_SCHEMA_VERSION}.db`;
const CORE_DATABASE_ASSET = require('../assets/data/nutrition-core.db') as number;
const SOURCE = {
  id: 'usda-fdc-local-sqlite-v1',
  label: 'USDA FoodData Central local SQLite catalog',
  sourceUrl: 'https://fdc.nal.usda.gov/',
} as const;

interface FoodRow {
  fdc_id: number;
  name: string;
  brand: string | null;
  search_aliases: string;
  source_rank: number;
  default_amount: number;
  default_unit_code: number;
  default_label: string;
  default_grams: number;
  calories: number;
  carbohydrates_grams: number;
  protein_grams: number;
  fat_grams: number;
  fiber_grams: number | null;
}

interface AliasRow {
  fdc_id: number;
  alias: string;
}

interface PortionRow {
  fdc_id: number;
  unit_code: number;
  grams_per_unit: number;
}

interface CatalogValidation {
  kind: 'core' | 'branded';
  version: string;
  foodCount: number;
  productCount: number;
}

interface ProductBarcodeRow {
  fdc_id: number;
  gtin14: string;
  name: string;
  brand: string | null;
  ingredients: string | null;
  image_url: string | null;
  serving_label: string | null;
  serving_grams: number | null;
  calories: number | null;
  carbohydrates_grams: number | null;
  fiber_grams: number | null;
  total_sugars_grams: number | null;
  added_sugars_grams: number | null;
  protein_grams: number | null;
  fat_grams: number | null;
  saturated_fat_grams: number | null;
  trans_fat_grams: number | null;
  sodium_milligrams: number | null;
  publication_date: string;
}

let coreDatabase: SQLiteDatabase | undefined;
let brandedDatabase: SQLiteDatabase | undefined;
let initialization: Promise<NutritionCatalogStatus> | undefined;
let status: NutritionCatalogStatus = {
  coreFoodCount: 0,
  brandedFoodCount: 0,
  brandedProductCount: 0,
  brandedState: 'not-configured',
};

async function validateCatalog(
  database: SQLiteDatabase,
  expectedKind: CatalogValidation['kind'],
  expectedVersion?: string,
  checkIntegrity = false,
): Promise<CatalogValidation> {
  const rows = await database.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM catalog_metadata
     WHERE key IN (
       'schema_version', 'catalog_kind', 'catalog_version', 'food_count',
       'product_index_version', 'barcode_product_count'
     )`,
  );
  const metadata = Object.fromEntries(rows.map(({ key, value }) => [key, value]));
  if (Number(metadata.schema_version) !== NUTRITION_CATALOG_SCHEMA_VERSION) {
    throw new Error('The nutrition catalog schema is not supported by this app build.');
  }
  if (metadata.catalog_kind !== expectedKind) {
    throw new Error(`Expected a ${expectedKind} nutrition catalog.`);
  }
  if (expectedVersion && metadata.catalog_version !== expectedVersion) {
    throw new Error('The downloaded nutrition catalog version does not match its manifest.');
  }
  const count = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM foods',
  );
  const declaredCount = Number(metadata.food_count);
  if (!count || count.count <= 0 || count.count !== declaredCount) {
    throw new Error('The nutrition catalog food count is invalid.');
  }
  let productCount = 0;
  if (expectedKind === 'branded') {
    if (Number(metadata.product_index_version) !== NUTRITION_PRODUCT_INDEX_VERSION) {
      throw new Error('The branded product barcode index is not supported by this app build.');
    }
    const productCountRow = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM product_barcodes',
    );
    const declaredProductCount = Number(metadata.barcode_product_count);
    if (
      !productCountRow ||
      productCountRow.count <= 0 ||
      productCountRow.count !== declaredProductCount
    ) {
      throw new Error('The branded product barcode count is invalid.');
    }
    productCount = productCountRow.count;
  }
  if (checkIntegrity) {
    const integrity = await database.getFirstAsync<{ integrity_check: string }>(
      'PRAGMA integrity_check',
    );
    if (integrity?.integrity_check !== 'ok') {
      throw new Error('The downloaded nutrition catalog failed its integrity check.');
    }
  }
  return {
    kind: expectedKind,
    version: metadata.catalog_version,
    foodCount: count.count,
    productCount,
  };
}

async function openCoreCatalog(): Promise<CatalogValidation> {
  await importDatabaseFromAssetAsync(CORE_DATABASE_NAME, {
    assetId: CORE_DATABASE_ASSET,
  });
  coreDatabase = await openDatabaseAsync(CORE_DATABASE_NAME);
  const validation = await validateCatalog(
    coreDatabase,
    'core',
    NUTRITION_CORE_CATALOG_VERSION,
  );
  await coreDatabase.execAsync('PRAGMA query_only = ON;');
  return validation;
}

async function prepareBrandedCatalogInBackground(): Promise<void> {
  let config;
  try {
    config = remoteNutritionCatalogConfig();
  } catch (error) {
    status = {
      ...status,
      brandedState: 'error',
      error: error instanceof Error ? error.message : 'The branded catalog configuration is invalid.',
    };
    return;
  }
  if (!config) return;

  status = {
    ...status,
    brandedState: 'downloading',
    brandedBytesDownloaded: 0,
    brandedBytesTotal: config.bytes,
    error: undefined,
  };
  const filename = `nutrition-branded-${config.version}-${config.md5.slice(0, 8)}.db`;
  const destination = new File(Paths.document, filename);
  const verificationMarker = new File(Paths.document, `${filename}.verified.json`);
  try {
    let previouslyVerified = false;
    if (destination.exists && verificationMarker.exists) {
      try {
        const marker = JSON.parse(await verificationMarker.text()) as {
          bytes?: number;
          md5?: string;
          schemaVersion?: number;
          version?: string;
        };
        previouslyVerified = marker.bytes === config.bytes &&
          marker.md5 === config.md5 &&
          marker.version === config.version &&
          marker.schemaVersion === NUTRITION_CATALOG_SCHEMA_VERSION;
      } catch {
        previouslyVerified = false;
      }
    }
    if (!previouslyVerified) {
      const currentInfo = await getInfoAsync(destination.uri, { md5: true });
      if (
        !currentInfo.exists ||
        currentInfo.size !== config.bytes ||
        currentInfo.md5?.toLocaleLowerCase() !== config.md5
      ) {
        const requiredSpace = config.bytes * 2 + 100_000_000;
        if (Paths.availableDiskSpace < requiredSpace) {
          throw new Error(
            `The branded catalog needs about ${Math.ceil(requiredSpace / 1_000_000)} MB of free space to download and verify.`,
          );
        }
        const download = createDownloadResumable(
          config.url,
          destination.uri,
          { sessionType: FileSystemSessionType.BACKGROUND },
          ({ totalBytesWritten }) => {
            status = {
              ...status,
              brandedState: 'downloading',
              brandedBytesDownloaded: Math.min(totalBytesWritten, config.bytes),
              brandedBytesTotal: config.bytes,
            };
          },
        );
        const result = await download.downloadAsync();
        if (!result) throw new Error('The branded food catalog download was canceled.');
      }
      status = {
        ...status,
        brandedState: 'verifying',
        brandedBytesDownloaded: config.bytes,
        brandedBytesTotal: config.bytes,
      };
      const downloadedInfo = await getInfoAsync(destination.uri, { md5: true });
      if (
        !downloadedInfo.exists ||
        downloadedInfo.size !== config.bytes ||
        downloadedInfo.md5?.toLocaleLowerCase() !== config.md5
      ) {
        throw new Error('The branded food catalog checksum did not match its manifest.');
      }
    }
    const candidate = await openDatabaseAsync(
      filename,
      { useNewConnection: true },
      Paths.document.uri,
    );
    try {
      const validation = await validateCatalog(
        candidate,
        'branded',
        config.version,
        !previouslyVerified,
      );
      await candidate.execAsync('PRAGMA query_only = ON;');
      if (!previouslyVerified) {
        verificationMarker.write(JSON.stringify({
          bytes: config.bytes,
          md5: config.md5,
          schemaVersion: NUTRITION_CATALOG_SCHEMA_VERSION,
          version: config.version,
        }));
      }
      brandedDatabase = candidate;
      status = {
        ...status,
        brandedFoodCount: validation.foodCount,
        brandedProductCount: validation.productCount,
        brandedState: 'ready',
        error: undefined,
      };
    } catch (error) {
      await candidate.closeAsync();
      throw error;
    }
  } catch (error) {
    status = {
      ...status,
      brandedState: 'error',
      error: error instanceof Error ? error.message : 'The branded food catalog could not be prepared.',
    };
  }
}

async function initialize(): Promise<NutritionCatalogStatus> {
  if (!initialization) {
    initialization = openCoreCatalog().then((validation) => {
      status = { ...status, coreFoodCount: validation.foodCount };
      void prepareBrandedCatalogInBackground();
      return status;
    });
  }
  await initialization;
  return status;
}

function unitFromCode(code: number): LocalNutritionPortionUnit {
  const unit = NUTRITION_PORTION_UNITS[code];
  if (!unit) throw new Error(`Unsupported nutrition portion unit code: ${code}`);
  return unit;
}

async function hydrateFoods(
  database: SQLiteDatabase,
  rows: readonly FoodRow[],
): Promise<LocalNutritionReferenceFood[]> {
  const uniqueRows = [...new Map(rows.map((row) => [row.fdc_id, row])).values()];
  if (uniqueRows.length === 0) return [];
  const placeholders = uniqueRows.map(() => '?').join(', ');
  const ids = uniqueRows.map(({ fdc_id }) => fdc_id);
  const [aliases, portions] = await Promise.all([
    database.getAllAsync<AliasRow>(
      `SELECT fdc_id, alias FROM food_aliases WHERE fdc_id IN (${placeholders})`,
      ids,
    ),
    database.getAllAsync<PortionRow>(
      `SELECT fdc_id, unit_code, grams_per_unit FROM food_portions WHERE fdc_id IN (${placeholders})`,
      ids,
    ),
  ]);
  const aliasesByFood = new Map<number, string[]>();
  for (const { fdc_id, alias } of aliases) {
    aliasesByFood.set(fdc_id, [...(aliasesByFood.get(fdc_id) ?? []), alias]);
  }
  const portionsByFood = new Map<
    number,
    Partial<Record<LocalNutritionPortionUnit, number>>
  >();
  for (const { fdc_id, unit_code, grams_per_unit } of portions) {
    portionsByFood.set(fdc_id, {
      ...(portionsByFood.get(fdc_id) ?? {}),
      [unitFromCode(unit_code)]: grams_per_unit,
    });
  }
  return uniqueRows.map((row) => ({
    fdcId: row.fdc_id,
    name: row.brand ? `${row.brand} — ${row.name}` : row.name,
    aliases: aliasesByFood.get(row.fdc_id) ?? [
      normalizeNutritionAlias(row.name),
      normalizeNutritionAlias(row.brand ?? ''),
      row.search_aliases,
    ].filter(Boolean),
    defaultPortion: {
      amount: row.default_amount,
      unit: unitFromCode(row.default_unit_code),
      label: row.default_label,
      grams: row.default_grams,
    },
    gramsPerUnit: {
      [unitFromCode(row.default_unit_code)]: row.default_grams / row.default_amount,
      ...(portionsByFood.get(row.fdc_id) ?? {}),
    },
    nutrientsPer100Grams: {
      calories: row.calories,
      carbohydratesGrams: row.carbohydrates_grams,
      proteinGrams: row.protein_grams,
      fatGrams: row.fat_grams,
      ...(row.fiber_grams === null ? {} : { fiberGrams: row.fiber_grams }),
    },
  }));
}

const FOOD_COLUMNS = `
  f.fdc_id, f.name, f.brand, f.search_aliases, f.source_rank, f.default_amount,
  f.default_unit_code, f.default_label, f.default_grams, f.calories,
  f.carbohydrates_grams, f.protein_grams, f.fat_grams, f.fiber_grams
`;

async function foodById(
  database: SQLiteDatabase,
  fdcId: number,
): Promise<LocalNutritionReferenceFood | undefined> {
  const row = await database.getFirstAsync<FoodRow>(
    `SELECT ${FOOD_COLUMNS} FROM foods f WHERE f.fdc_id = ?`,
    fdcId,
  );
  return row ? (await hydrateFoods(database, [row]))[0] : undefined;
}

function ftsQuery(input: string): string | undefined {
  const words = nutritionFoodQueryWords(input);
  if (words.length === 0) return undefined;
  return words.map((word) => `"${word.replace(/"/g, '""')}"`).join(' AND ');
}

async function exactFood(
  database: SQLiteDatabase,
  normalizedQuery: string,
): Promise<LocalNutritionReferenceFood | undefined> {
  const row = await database.getFirstAsync<FoodRow>(
    `SELECT ${FOOD_COLUMNS}
     FROM food_aliases a
     JOIN foods f ON f.fdc_id = a.fdc_id
     WHERE a.alias = ?
     ORDER BY f.source_rank, length(f.name)
     LIMIT 1`,
    normalizedQuery,
  );
  return row ? (await hydrateFoods(database, [row]))[0] : undefined;
}

async function searchedFood(
  database: SQLiteDatabase,
  input: string,
): Promise<LocalNutritionReferenceFood | undefined> {
  const query = ftsQuery(input);
  if (!query) return undefined;
  const row = await database.getFirstAsync<FoodRow>(
    `SELECT ${FOOD_COLUMNS}
     FROM food_search s
     JOIN foods f ON f.fdc_id = s.rowid
     WHERE food_search MATCH ?
     ORDER BY bm25(food_search, 0.0, 8.0, 4.0, 2.0), f.source_rank, length(f.name)
     LIMIT 1`,
    query,
  );
  return row ? (await hydrateFoods(database, [row]))[0] : undefined;
}

async function matchFood(input: string): Promise<LocalNutritionReferenceFood | undefined> {
  await initialize();
  if (!coreDatabase) return undefined;
  const queryText = nutritionFoodQueryWords(input).join(' ');
  const preferredId = LOCAL_NUTRITION_PREFERRED_ALIASES[queryText];
  if (preferredId !== undefined) {
    const preferred = await foodById(coreDatabase, preferredId);
    if (preferred) return preferred;
  }
  if (isAmbiguousNutritionFoodQuery(input)) return undefined;
  if (nutritionFoodQueryWords(input).length === 1) return undefined;
  const coreExact = await exactFood(coreDatabase, queryText);
  if (coreExact) return coreExact;
  if (brandedDatabase) {
    const brandedExact = await exactFood(brandedDatabase, queryText);
    if (brandedExact) return brandedExact;
  }
  const coreSearch = await searchedFood(coreDatabase, input);
  if (coreSearch) return coreSearch;
  return brandedDatabase ? searchedFood(brandedDatabase, input) : undefined;
}

async function candidateFoods(
  database: SQLiteDatabase,
  input: string,
): Promise<LocalNutritionReferenceFood[]> {
  const query = ftsQuery(input);
  let rows: FoodRow[] = [];
  if (query) {
    rows = await database.getAllAsync<FoodRow>(
      `SELECT ${FOOD_COLUMNS}
       FROM food_search s
       JOIN foods f ON f.fdc_id = s.rowid
       WHERE food_search MATCH ?
       ORDER BY bm25(food_search, 0.0, 8.0, 4.0, 2.0), f.source_rank
       LIMIT 80`,
      query,
    );
  }
  if (rows.length === 0) {
    const prefix = nutritionFoodQueryWords(input)[0]?.slice(0, 3);
    if (prefix) {
      rows = await database.getAllAsync<FoodRow>(
        `SELECT ${FOOD_COLUMNS}
         FROM food_aliases a
         JOIN foods f ON f.fdc_id = a.fdc_id
         WHERE a.alias LIKE ?
         ORDER BY f.source_rank, length(a.alias)
         LIMIT 80`,
        `${prefix}%`,
      );
    }
  }
  return hydrateFoods(database, rows);
}

async function findSuggestions(input: string, limit = 3) {
  await initialize();
  if (!coreDatabase) return [];
  const [coreCandidates, brandedCandidates, familyFoods] = await Promise.all([
    candidateFoods(coreDatabase, input),
    brandedDatabase ? candidateFoods(brandedDatabase, input) : Promise.resolve([]),
    Promise.all(nutritionFamilyFoodIds(input).map((id) => foodById(coreDatabase!, id))),
  ]);
  const candidates = [
    ...coreCandidates,
    ...brandedCandidates,
    ...familyFoods.filter((food): food is LocalNutritionReferenceFood => Boolean(food)),
  ];
  return rankLocalNutritionSuggestions(input, candidates, limit);
}

function hydrateProduct(row: ProductBarcodeRow): ProductBarcodeRecord {
  const nutrition = row.serving_label ? {
    basis: 'serving' as const,
    servingLabel: row.serving_label,
    ...(row.serving_grams !== null ? { servingGrams: row.serving_grams } : {}),
    ...(row.calories !== null ? { calories: row.calories } : {}),
    ...(row.carbohydrates_grams !== null
      ? { totalCarbohydratesGrams: row.carbohydrates_grams }
      : {}),
    ...(row.fiber_grams !== null ? { dietaryFiberGrams: row.fiber_grams } : {}),
    ...(row.total_sugars_grams !== null ? { totalSugarGrams: row.total_sugars_grams } : {}),
    ...(row.added_sugars_grams !== null ? { addedSugarGrams: row.added_sugars_grams } : {}),
    ...(row.protein_grams !== null ? { proteinGrams: row.protein_grams } : {}),
    ...(row.fat_grams !== null ? { totalFatGrams: row.fat_grams } : {}),
    ...(row.saturated_fat_grams !== null
      ? { saturatedFatGrams: row.saturated_fat_grams }
      : {}),
    ...(row.trans_fat_grams !== null ? { transFatGrams: row.trans_fat_grams } : {}),
    ...(row.sodium_milligrams !== null ? { sodiumMilligrams: row.sodium_milligrams } : {}),
  } : undefined;
  return {
    productId: `gtin14:${row.gtin14}`,
    fdcId: row.fdc_id,
    gtin14: row.gtin14,
    name: row.name,
    ...(row.brand ? { brand: row.brand } : {}),
    ...(row.image_url ? { imageUrl: row.image_url } : {}),
    ...(row.ingredients ? { ingredients: row.ingredients } : {}),
    ...(nutrition ? { nutrition } : {}),
    publicationDate: row.publication_date,
  };
}

async function lookupProductBarcode(
  value: string,
  type: ProductBarcodeType = 'unknown',
) {
  const candidates = barcodeLookupCandidates(value, type);
  if (candidates.length === 0) return { state: 'invalid' as const };
  await initialize();
  if (!brandedDatabase) {
    if (
      status.brandedState === 'downloading' ||
      status.brandedState === 'verifying'
    ) {
      return { state: 'catalog-preparing' as const };
    }
    return {
      state: 'catalog-unavailable' as const,
      ...(status.error ? { message: status.error } : {}),
    };
  }
  const placeholders = candidates.map(() => '?').join(', ');
  const row = await brandedDatabase.getFirstAsync<ProductBarcodeRow>(
    `SELECT fdc_id, gtin14, name, brand, ingredients, image_url, serving_label,
            serving_grams, calories, carbohydrates_grams, fiber_grams,
            total_sugars_grams, added_sugars_grams, protein_grams, fat_grams,
            saturated_fat_grams, trans_fat_grams, sodium_milligrams, publication_date
     FROM product_barcodes
     WHERE gtin14 IN (${placeholders})
     ORDER BY CASE gtin14 ${candidates.map((_, index) => `WHEN ? THEN ${index}`).join(' ')} END
     LIMIT 1`,
    [...candidates, ...candidates],
  );
  return row
    ? { state: 'found' as const, product: hydrateProduct(row) }
    : { state: 'not-found' as const };
}

export const nutritionCatalog: NutritionCatalog = {
  initialize,
  async retryBrandedCatalog() {
    await initialize();
    void prepareBrandedCatalogInBackground();
    return status;
  },
  async estimate(foods, selectedFdcIds = []) {
    const inputs = foods.slice(0, 20);
    const matches = await Promise.all(inputs.map(async (input, index) => {
      const selectedFdcId = selectedFdcIds[index];
      if (selectedFdcId === undefined) return matchFood(input);
      await initialize();
      if (!coreDatabase) return undefined;
      const coreFood = await foodById(coreDatabase, selectedFdcId);
      if (coreFood) return coreFood;
      return brandedDatabase ? await foodById(brandedDatabase, selectedFdcId) : undefined;
    }));
    return estimateLocalNutritionFromMatches(inputs, matches, SOURCE);
  },
  findSuggestions,
  lookupProductBarcode,
};
