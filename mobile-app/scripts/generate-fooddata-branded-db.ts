import { createHash } from 'node:crypto';
import { createReadStream, mkdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { normalizeNutritionAlias } from '../data/local-nutrition-aliases';
import {
  NUTRITION_CATALOG_SCHEMA_SQL,
  NUTRITION_CATALOG_SCHEMA_VERSION,
  NUTRITION_PORTION_UNITS,
  NUTRITION_PRODUCT_INDEX_SCHEMA_SQL,
  NUTRITION_PRODUCT_INDEX_VERSION,
} from '../data/nutrition-catalog-schema';
import { canonicalGtin14 } from '../services/product-barcode';
import type { LocalNutritionPortionUnit } from '../types/nutrition';
import { readCsv } from './fooddata-csv';

const NUTRIENT_IDS = new Set([
  1003, 1004, 1005, 1008, 1079, 1093, 1235, 1257, 1258, 2000, 2047, 2048,
]);

interface BrandedMetadata {
  brand: string;
  brandOwner: string;
  servingSize?: number;
  servingUnit: string;
  householdServing: string;
}

interface FoodDescription {
  description: string;
  publicationDate: string;
}

interface SelectedNutrients {
  protein?: number;
  fat?: number;
  carbohydrates?: number;
  calories?: number;
  caloriesGeneral?: number;
  caloriesSpecific?: number;
  fiber?: number;
  sodium?: number;
  addedSugar?: number;
  transFat?: number;
  saturatedFat?: number;
  totalSugar?: number;
}

interface Portion {
  amount: number;
  unit: LocalNutritionPortionUnit;
  label: string;
  grams: number;
}

function finitePositive(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function portionUnit(value: string): LocalNutritionPortionUnit {
  const normalized = value.toLocaleLowerCase().trim();
  if (/\bcups?\b/.test(normalized)) return 'cup';
  if (/\b(?:tablespoons?|tbsp)\b/.test(normalized)) return 'tablespoon';
  if (/\b(?:teaspoons?|tsp)\b/.test(normalized)) return 'teaspoon';
  if (/\bslices?\b/.test(normalized)) return 'slice';
  if (/\b(?:containers?|packages?|packets?|jars?|bottles?|cartons?|boxes?|cans?)\b/.test(normalized)) {
    return 'container';
  }
  if (/\b(?:ounces?|oz)\b/.test(normalized)) return 'ounce';
  if (/^(?:grams?|g|grm)$/i.test(normalized)) return 'gram';
  return 'item';
}

function portionAmount(value: string): number | undefined {
  const mixed = value.match(/^\s*(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    return denominator > 0 ? Number(mixed[1]) + Number(mixed[2]) / denominator : undefined;
  }
  const fraction = value.match(/^\s*(\d+)\s*\/\s*(\d+)/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator > 0 ? Number(fraction[1]) / denominator : undefined;
  }
  const numeric = value.match(/^\s*(\d+(?:\.\d+)?)/);
  return numeric ? finitePositive(numeric[1]) : undefined;
}

function gramWeight(metadata: BrandedMetadata): number | undefined {
  if (/^(?:g|grm|gram|grams)$/i.test(metadata.servingUnit)) {
    return metadata.servingSize;
  }
  if (/^(?:oz|ounce|ounces)$/i.test(metadata.servingUnit) && metadata.servingSize) {
    return metadata.servingSize * 28.349_523_125;
  }
  const householdGrams = metadata.householdServing.match(
    /(?:\(|\b)(\d+(?:\.\d+)?)\s*(?:g|gram|grams)\b/i,
  );
  return householdGrams ? finitePositive(householdGrams[1]) : undefined;
}

function productServingLabel(metadata: BrandedMetadata): string | undefined {
  const household = metadata.householdServing.trim();
  if (household) return household;
  if (metadata.servingSize && metadata.servingUnit) {
    return `${metadata.servingSize} ${metadata.servingUnit}`;
  }
  return undefined;
}

function perServing(value: number | undefined, grams: number | undefined): number | null {
  if (value === undefined || grams === undefined) return null;
  return Math.round(value * grams) / 100;
}

function defaultPortion(metadata: BrandedMetadata): Portion {
  const grams = gramWeight(metadata);
  if (!grams) return { amount: 100, unit: 'gram', label: '100 g', grams: 100 };
  const household = metadata.householdServing.trim();
  if (household) {
    return {
      amount: portionAmount(household) ?? 1,
      unit: portionUnit(household),
      label: household,
      grams,
    };
  }
  return {
    amount: metadata.servingSize ?? grams,
    unit: portionUnit(metadata.servingUnit),
    label: `${metadata.servingSize ?? grams} ${metadata.servingUnit || 'g'}`,
    grams,
  };
}

function nutrientKey(id: number): keyof SelectedNutrients | undefined {
  if (id === 1003) return 'protein';
  if (id === 1004) return 'fat';
  if (id === 1005) return 'carbohydrates';
  if (id === 1008) return 'calories';
  if (id === 1079) return 'fiber';
  if (id === 1093) return 'sodium';
  if (id === 1235) return 'addedSugar';
  if (id === 1257) return 'transFat';
  if (id === 1258) return 'saturatedFat';
  if (id === 2000) return 'totalSugar';
  if (id === 2047) return 'caloriesGeneral';
  if (id === 2048) return 'caloriesSpecific';
  return undefined;
}

async function md5(filePath: string): Promise<string> {
  const hash = createHash('md5');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

async function main(): Promise<void> {
  const sourceDirectory = process.argv[2];
  const outputPath = path.resolve(
    process.argv[3] ?? 'artifacts/nutrition-branded.db',
  );
  const catalogVersion = process.argv[4];
  if (!sourceDirectory || !catalogVersion) {
    throw new Error(
      'Usage: tsx scripts/generate-fooddata-branded-db.ts <extracted CSV directory> <output db> <catalog version>',
    );
  }

  const descriptions = new Map<number, FoodDescription>();
  await readCsv(path.join(sourceDirectory, 'food.csv'), (record) => {
    if (record.data_type === 'branded_food') {
      descriptions.set(Number(record.fdc_id), {
        description: record.description.trim(),
        publicationDate: record.publication_date.trim(),
      });
    }
  });

  mkdirSync(path.dirname(outputPath), { recursive: true });
  rmSync(outputPath, { force: true });
  const database = new DatabaseSync(outputPath);
  database.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;');
  database.exec(NUTRITION_CATALOG_SCHEMA_SQL);
  database.exec(NUTRITION_PRODUCT_INDEX_SCHEMA_SQL);
  const insertProduct = database.prepare(`
    INSERT INTO product_barcodes (
      gtin14, fdc_id, name, brand, ingredients, image_url, serving_label,
      serving_grams, calories, carbohydrates_grams, fiber_grams,
      total_sugars_grams, added_sugars_grams, protein_grams, fat_grams,
      saturated_fat_grams, trans_fat_grams, sodium_milligrams, publication_date
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?)
    ON CONFLICT(gtin14) DO UPDATE SET
      fdc_id = excluded.fdc_id,
      name = excluded.name,
      brand = excluded.brand,
      ingredients = excluded.ingredients,
      image_url = excluded.image_url,
      serving_label = excluded.serving_label,
      serving_grams = excluded.serving_grams,
      publication_date = excluded.publication_date
    WHERE excluded.publication_date > product_barcodes.publication_date
       OR (
         excluded.publication_date = product_barcodes.publication_date
         AND excluded.fdc_id > product_barcodes.fdc_id
       )
  `);

  const branded = new Map<number, BrandedMetadata>();
  let sourceBarcodeCount = 0;
  let skippedInvalidBarcode = 0;
  let barcodeProductCount = 0;
  const barcodeFdcIds = new Set<number>();
  database.exec('BEGIN');
  try {
    await readCsv(path.join(sourceDirectory, 'branded_food.csv'), (record) => {
      const fdcId = Number(record.fdc_id);
      const food = descriptions.get(fdcId);
      if (!food) return;
      const brand = (record.brand_name || record.subbrand_name || '').trim();
      const brandOwner = (record.brand_owner || '').trim();
      branded.set(fdcId, {
        brand,
        brandOwner,
        servingSize: finitePositive(record.serving_size),
        servingUnit: record.serving_size_unit.trim(),
        householdServing: (
          record.household_serving_fulltext || record.household_serving_full_text || ''
        ).trim(),
      });
      if (!record.gtin_upc.trim()) return;
      sourceBarcodeCount += 1;
      const gtin14 = canonicalGtin14(record.gtin_upc);
      if (!gtin14) {
        skippedInvalidBarcode += 1;
        return;
      }
      barcodeFdcIds.add(fdcId);
      insertProduct.run(
        gtin14,
        fdcId,
        food.description,
        brand || brandOwner || null,
        record.ingredients.trim() || null,
        productServingLabel(branded.get(fdcId)!) ?? null,
        gramWeight(branded.get(fdcId)!) ?? null,
        food.publicationDate || '0000-00-00',
      );
    });
    database.exec('COMMIT');
    barcodeProductCount = (database.prepare(
      'SELECT COUNT(*) AS count FROM product_barcodes',
    ).get() as { count: number }).count;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  const nutrients = new Map<number, SelectedNutrients>();
  await readCsv(path.join(sourceDirectory, 'food_nutrient.csv'), (record) => {
    const fdcId = Number(record.fdc_id);
    const nutrientId = Number(record.nutrient_id);
    if (!descriptions.has(fdcId) || !NUTRIENT_IDS.has(nutrientId)) return;
    const key = nutrientKey(nutrientId);
    const amount = Number(record.amount);
    if (!key || !Number.isFinite(amount) || amount < 0) return;
    const values = nutrients.get(fdcId) ?? {};
    values[key] = amount;
    nutrients.set(fdcId, values);
  });

  const updateProductNutrition = database.prepare(`
    UPDATE product_barcodes SET
      calories = ?,
      carbohydrates_grams = ?,
      fiber_grams = ?,
      total_sugars_grams = ?,
      added_sugars_grams = ?,
      protein_grams = ?,
      fat_grams = ?,
      saturated_fat_grams = ?,
      trans_fat_grams = ?,
      sodium_milligrams = ?
    WHERE fdc_id = ?
  `);
  database.exec('BEGIN');
  try {
    for (const fdcId of barcodeFdcIds) {
      const values = nutrients.get(fdcId);
      const metadata = branded.get(fdcId);
      const grams = metadata ? gramWeight(metadata) : undefined;
      const calories = values?.calories ?? values?.caloriesSpecific ?? values?.caloriesGeneral;
      updateProductNutrition.run(
        perServing(calories, grams),
        perServing(values?.carbohydrates, grams),
        perServing(values?.fiber, grams),
        perServing(values?.totalSugar, grams),
        perServing(values?.addedSugar, grams),
        perServing(values?.protein, grams),
        perServing(values?.fat, grams),
        perServing(values?.saturatedFat, grams),
        perServing(values?.transFat, grams),
        perServing(values?.sodium, grams),
        fdcId,
      );
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  const insertMetadata = database.prepare(
    'INSERT INTO catalog_metadata (key, value) VALUES (?, ?)',
  );
  const insertFood = database.prepare(`
    INSERT INTO foods (
    fdc_id, name, brand, search_aliases, source_rank, default_amount, default_unit_code,
      default_label, default_grams, calories, carbohydrates_grams,
      protein_grams, fat_grams, fiber_grams
    ) VALUES (?, ?, ?, ?, 10, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSearch = database.prepare(
    'INSERT INTO food_search (rowid, name, brand, search_aliases) VALUES (?, ?, ?, ?)',
  );

  let insertedCount = 0;
  let skippedMissingMacros = 0;
  database.exec('BEGIN');
  try {
    for (const [fdcId, food] of descriptions) {
      const metadata = branded.get(fdcId) ?? {
        brand: '',
        brandOwner: '',
        servingUnit: '',
        householdServing: '',
      };
      const values = nutrients.get(fdcId);
      const calories = values?.calories ?? values?.caloriesSpecific ?? values?.caloriesGeneral;
      if (
        calories === undefined ||
        values?.carbohydrates === undefined ||
        values.protein === undefined ||
        values.fat === undefined
      ) {
        skippedMissingMacros += 1;
        continue;
      }
      const portion = defaultPortion(metadata);
      const unitCode = NUTRITION_PORTION_UNITS.indexOf(portion.unit);
      const displayBrand = metadata.brand || metadata.brandOwner;
      const searchAliases = metadata.brand && metadata.brandOwner
        ? normalizeNutritionAlias(metadata.brandOwner)
        : '';
      insertFood.run(
        fdcId,
        food.description,
        displayBrand || null,
        searchAliases,
        portion.amount,
        unitCode,
        portion.label,
        portion.grams,
        calories,
        values.carbohydrates,
        values.protein,
        values.fat,
        values.fiber ?? null,
      );
      insertSearch.run(
        fdcId,
        food.description,
        displayBrand,
        searchAliases,
      );
      insertedCount += 1;
    }

    const metadata: Readonly<Record<string, string>> = {
      schema_version: String(NUTRITION_CATALOG_SCHEMA_VERSION),
      catalog_kind: 'branded',
      catalog_version: catalogVersion,
      source_id: 'usda-fdc-branded-local-v1',
      source_label: 'USDA FoodData Central Branded Foods, compact SQLite catalog',
      source_url: 'https://fdc.nal.usda.gov/',
      food_count: String(insertedCount),
      source_food_count: String(descriptions.size),
      skipped_missing_macros: String(skippedMissingMacros),
      product_index_version: String(NUTRITION_PRODUCT_INDEX_VERSION),
      barcode_product_count: String(barcodeProductCount),
      source_barcode_count: String(sourceBarcodeCount),
      skipped_invalid_barcode: String(skippedInvalidBarcode),
    };
    for (const [key, value] of Object.entries(metadata)) insertMetadata.run(key, value);
    database.exec(`PRAGMA user_version = ${NUTRITION_CATALOG_SCHEMA_VERSION}; COMMIT;`);
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  database.exec('ANALYZE; VACUUM;');
  const integrity = database.prepare('PRAGMA integrity_check').get() as {
    integrity_check?: string;
  };
  database.close();
  if (integrity.integrity_check !== 'ok') {
    throw new Error('Generated branded catalog failed its SQLite integrity check.');
  }
  const hash = await md5(outputPath);
  const fileBytes = statSync(outputPath).size;
  console.log(JSON.stringify({
    outputPath,
    catalogVersion,
    sourceFoodCount: descriptions.size,
    foodCount: insertedCount,
    skippedMissingMacros,
    barcodeProductCount,
    skippedInvalidBarcode,
    fileBytes,
    md5: hash,
  }));
}

void main();
