import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { nutritionAliasesForDescription } from '../data/local-nutrition-aliases';
import {
  NUTRITION_CATALOG_SCHEMA_SQL,
  NUTRITION_CATALOG_SCHEMA_VERSION,
  NUTRITION_CORE_CATALOG_VERSION,
  NUTRITION_PORTION_UNITS,
} from '../data/nutrition-catalog-schema';
import type { LocalNutritionPortionUnit } from '../types/nutrition';
import { readCsv } from './fooddata-csv';

const SOURCE_RANKS: Readonly<Record<string, number>> = {
  foundation_food: 0,
  sr_legacy_food: 1,
  survey_fndds_food: 2,
  experimental_food: 3,
};
const NUTRIENT_IDS = new Set([1003, 1004, 1005, 1008, 1079, 2047, 2048]);

interface CoreFood {
  description: string;
  sourceRank: number;
}

interface SelectedNutrients {
  protein?: number;
  fat?: number;
  carbohydrates?: number;
  calories?: number;
  caloriesGeneral?: number;
  caloriesSpecific?: number;
  fiber?: number;
}

interface Portion {
  amount: number;
  grams: number;
  label: string;
  sequence: number;
  unit: LocalNutritionPortionUnit;
}

function finitePositive(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function portionUnit(value: string): LocalNutritionPortionUnit {
  const normalized = value.toLocaleLowerCase().trim();
  if (/^(?:cups?|c\b)/.test(normalized)) return 'cup';
  if (/^(?:tablespoons?|tbsp\b)/.test(normalized)) return 'tablespoon';
  if (/^(?:teaspoons?|tsp\b)/.test(normalized)) return 'teaspoon';
  if (/^slices?\b/.test(normalized)) return 'slice';
  if (/^(?:containers?|packages?|packets?|jars?|bottles?|cartons?|boxes?|cans?)\b/.test(normalized)) {
    return 'container';
  }
  if (/^(?:ounces?|oz\b)/.test(normalized)) return 'ounce';
  if (/^(?:grams?|g\b)/.test(normalized)) return 'gram';
  return 'item';
}

function nutrientKey(id: number): keyof SelectedNutrients | undefined {
  if (id === 1003) return 'protein';
  if (id === 1004) return 'fat';
  if (id === 1005) return 'carbohydrates';
  if (id === 1008) return 'calories';
  if (id === 1079) return 'fiber';
  if (id === 2047) return 'caloriesGeneral';
  if (id === 2048) return 'caloriesSpecific';
  return undefined;
}

function portionPreference(portion: Portion): number {
  const normalized = portion.label.toLocaleLowerCase();
  if (/\bmedium\b/.test(normalized)) return 0;
  if (/\blarge\b/.test(normalized)) return 1;
  if (/\bsmall\b/.test(normalized)) return 2;
  return portion.sequence + 3;
}

async function main(): Promise<void> {
  const sourceDirectory = process.argv[2];
  const outputPath = path.resolve(
    process.argv[3] ?? 'assets/data/nutrition-core.db',
  );
  const catalogVersion = process.argv[4];
  if (!sourceDirectory || !catalogVersion) {
    throw new Error(
      'Usage: tsx scripts/generate-fooddata-core-db.ts <extracted full CSV directory> <output db> <catalog version>',
    );
  }
  if (catalogVersion !== NUTRITION_CORE_CATALOG_VERSION) {
    throw new Error(
      `Update NUTRITION_CORE_CATALOG_VERSION before generating ${catalogVersion}.`,
    );
  }

  const foods = new Map<number, CoreFood>();
  await readCsv(path.join(sourceDirectory, 'food.csv'), (record) => {
    const sourceRank = SOURCE_RANKS[record.data_type];
    if (sourceRank === undefined) return;
    foods.set(Number(record.fdc_id), {
      description: record.description.trim(),
      sourceRank,
    });
  });

  const nutrients = new Map<number, SelectedNutrients>();
  await readCsv(path.join(sourceDirectory, 'food_nutrient.csv'), (record) => {
    const fdcId = Number(record.fdc_id);
    const nutrientId = Number(record.nutrient_id);
    if (!foods.has(fdcId) || !NUTRIENT_IDS.has(nutrientId)) return;
    const key = nutrientKey(nutrientId);
    const amount = Number(record.amount);
    if (!key || !Number.isFinite(amount) || amount < 0) return;
    const values = nutrients.get(fdcId) ?? {};
    values[key] = amount;
    nutrients.set(fdcId, values);
  });

  const measureUnits = new Map<number, string>();
  await readCsv(path.join(sourceDirectory, 'measure_unit.csv'), (record) => {
    measureUnits.set(Number(record.id), record.name);
  });

  const portions = new Map<number, Portion[]>();
  await readCsv(path.join(sourceDirectory, 'food_portion.csv'), (record) => {
    const fdcId = Number(record.fdc_id);
    if (!foods.has(fdcId)) return;
    const amount = finitePositive(record.amount);
    const grams = finitePositive(record.gram_weight);
    if (!amount || !grams) return;
    const sourceLabel = (
      record.modifier ||
      record.portion_description ||
      measureUnits.get(Number(record.measure_unit_id)) ||
      'item'
    ).trim();
    const portion: Portion = {
      amount,
      grams,
      label: `${amount} ${sourceLabel}`,
      sequence: Number(record.seq_num) || Number.MAX_SAFE_INTEGER,
      unit: portionUnit(sourceLabel),
    };
    portions.set(fdcId, [...(portions.get(fdcId) ?? []), portion]);
  });

  mkdirSync(path.dirname(outputPath), { recursive: true });
  rmSync(outputPath, { force: true });
  const database = new DatabaseSync(outputPath);
  database.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;');
  database.exec(NUTRITION_CATALOG_SCHEMA_SQL);
  const insertMetadata = database.prepare(
    'INSERT INTO catalog_metadata (key, value) VALUES (?, ?)',
  );
  const insertFood = database.prepare(`
    INSERT INTO foods (
      fdc_id, name, brand, search_aliases, source_rank, default_amount,
      default_unit_code, default_label, default_grams, calories,
      carbohydrates_grams, protein_grams, fat_grams, fiber_grams
    ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAlias = database.prepare(
    'INSERT OR IGNORE INTO food_aliases (fdc_id, alias) VALUES (?, ?)',
  );
  const insertPortion = database.prepare(
    'INSERT OR REPLACE INTO food_portions (fdc_id, unit_code, grams_per_unit) VALUES (?, ?, ?)',
  );
  const insertSearch = database.prepare(
    'INSERT INTO food_search (rowid, name, brand, search_aliases) VALUES (?, ?, ?, ?)',
  );

  let insertedCount = 0;
  let skippedMissingMacros = 0;
  database.exec('BEGIN');
  try {
    for (const [fdcId, food] of foods) {
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
      const foodPortions = [...(portions.get(fdcId) ?? [])].sort(
        (left, right) => left.sequence - right.sequence,
      );
      const defaultPortion = foodPortions[0] ?? {
        amount: 100,
        grams: 100,
        label: '100 g',
        sequence: 1,
        unit: 'gram' as const,
      };
      const aliases = nutritionAliasesForDescription(food.description);
      insertFood.run(
        fdcId,
        food.description,
        aliases.join(' '),
        food.sourceRank,
        defaultPortion.amount,
        NUTRITION_PORTION_UNITS.indexOf(defaultPortion.unit),
        defaultPortion.label,
        defaultPortion.grams,
        calories,
        values.carbohydrates,
        values.protein,
        values.fat,
        values.fiber ?? null,
      );
      for (const alias of aliases) insertAlias.run(fdcId, alias);
      const bestByUnit = new Map<LocalNutritionPortionUnit, Portion>();
      for (const portion of foodPortions) {
        const current = bestByUnit.get(portion.unit);
        if (!current || portionPreference(portion) < portionPreference(current)) {
          bestByUnit.set(portion.unit, portion);
        }
      }
      for (const [unit, portion] of bestByUnit) {
        insertPortion.run(
          fdcId,
          NUTRITION_PORTION_UNITS.indexOf(unit),
          portion.grams / portion.amount,
        );
      }
      insertSearch.run(fdcId, food.description, '', aliases.join(' '));
      insertedCount += 1;
    }

    const metadata: Readonly<Record<string, string>> = {
      schema_version: String(NUTRITION_CATALOG_SCHEMA_VERSION),
      catalog_kind: 'core',
      catalog_version: catalogVersion,
      source_id: 'usda-fdc-core-local-v1',
      source_label: 'USDA FoodData Central generic foods, compact SQLite catalog',
      source_url: 'https://fdc.nal.usda.gov/',
      food_count: String(insertedCount),
      source_food_count: String(foods.size),
      skipped_missing_macros: String(skippedMissingMacros),
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
    throw new Error('Generated core catalog failed its SQLite integrity check.');
  }
  console.log(JSON.stringify({
    outputPath,
    catalogVersion,
    sourceFoodCount: foods.size,
    foodCount: insertedCount,
    skippedMissingMacros,
  }));
}

void main();
