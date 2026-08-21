import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  LOCAL_NUTRITION_FOODS,
  LOCAL_NUTRITION_REFERENCE_META,
} from '../data/local-nutrition-reference';
import {
  NUTRITION_CATALOG_SCHEMA_SQL,
  NUTRITION_CATALOG_SCHEMA_VERSION,
  NUTRITION_PORTION_UNITS,
} from '../data/nutrition-catalog-schema';

const outputPath = path.resolve(
  process.argv[2] ?? 'artifacts/nutrition-core-sr.db',
);

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
    fdc_id, name, brand, search_aliases, source_rank, default_amount, default_unit_code,
    default_label, default_grams, calories, carbohydrates_grams,
    protein_grams, fat_grams, fiber_grams
  ) VALUES (?, ?, NULL, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

database.exec('BEGIN');
try {
  const metadata: Readonly<Record<string, string>> = {
    schema_version: String(NUTRITION_CATALOG_SCHEMA_VERSION),
    catalog_kind: 'core',
    catalog_version: LOCAL_NUTRITION_REFERENCE_META.release,
    source_id: LOCAL_NUTRITION_REFERENCE_META.id,
    source_label: LOCAL_NUTRITION_REFERENCE_META.label,
    source_url: LOCAL_NUTRITION_REFERENCE_META.sourceUrl,
    food_count: String(LOCAL_NUTRITION_FOODS.length),
  };
  for (const [key, value] of Object.entries(metadata)) {
    insertMetadata.run(key, value);
  }

  for (const food of LOCAL_NUTRITION_FOODS) {
    insertFood.run(
      food.fdcId,
      food.name,
      food.aliases.join(' '),
      food.defaultPortion.amount,
      NUTRITION_PORTION_UNITS.indexOf(food.defaultPortion.unit),
      food.defaultPortion.label,
      food.defaultPortion.grams,
      food.nutrientsPer100Grams.calories,
      food.nutrientsPer100Grams.carbohydratesGrams,
      food.nutrientsPer100Grams.proteinGrams,
      food.nutrientsPer100Grams.fatGrams,
      food.nutrientsPer100Grams.fiberGrams ?? null,
    );
    for (const alias of food.aliases) insertAlias.run(food.fdcId, alias);
    for (const [unit, grams] of Object.entries(food.gramsPerUnit)) {
      const unitCode = NUTRITION_PORTION_UNITS.indexOf(
        unit as (typeof NUTRITION_PORTION_UNITS)[number],
      );
      if (unitCode >= 0 && grams !== undefined) {
        insertPortion.run(food.fdcId, unitCode, grams);
      }
    }
    insertSearch.run(food.fdcId, food.name, '', food.aliases.join(' '));
  }
  database.exec(`PRAGMA user_version = ${NUTRITION_CATALOG_SCHEMA_VERSION}; COMMIT;`);
} catch (error) {
  database.exec('ROLLBACK');
  throw error;
}

database.exec('ANALYZE; VACUUM;');
const integrity = database.prepare('PRAGMA integrity_check').get() as {
  integrity_check?: string;
};
const count = database.prepare('SELECT COUNT(*) AS count FROM foods').get() as {
  count: number;
};
database.close();

if (integrity.integrity_check !== 'ok' || count.count !== LOCAL_NUTRITION_FOODS.length) {
  throw new Error('Generated nutrition catalog failed validation.');
}

console.log(
  JSON.stringify({ outputPath, foodCount: count.count, integrity: 'ok' }),
);
