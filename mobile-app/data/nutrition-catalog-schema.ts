import type { LocalNutritionPortionUnit } from '@/types/nutrition';

export const NUTRITION_CATALOG_SCHEMA_VERSION = 2;
export const NUTRITION_CORE_CATALOG_VERSION = '2026-04';
export const NUTRITION_PRODUCT_INDEX_VERSION = 2;

export const NUTRITION_PORTION_UNITS: readonly LocalNutritionPortionUnit[] = [
  'cup',
  'tablespoon',
  'teaspoon',
  'slice',
  'item',
  'container',
  'gram',
  'ounce',
] as const;

export const NUTRITION_CATALOG_SCHEMA_SQL = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE catalog_metadata (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  ) WITHOUT ROWID;

  CREATE TABLE foods (
    fdc_id INTEGER PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    search_aliases TEXT NOT NULL DEFAULT '',
    source_rank INTEGER NOT NULL DEFAULT 0,
    default_amount REAL NOT NULL,
    default_unit_code INTEGER NOT NULL,
    default_label TEXT NOT NULL,
    default_grams REAL NOT NULL,
    calories REAL,
    carbohydrates_grams REAL,
    protein_grams REAL,
    fat_grams REAL,
    fiber_grams REAL
  );

  CREATE TABLE food_aliases (
    fdc_id INTEGER NOT NULL REFERENCES foods(fdc_id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    PRIMARY KEY (fdc_id, alias)
  ) WITHOUT ROWID;

  CREATE INDEX food_aliases_by_alias ON food_aliases(alias, fdc_id);

  CREATE TABLE food_portions (
    fdc_id INTEGER NOT NULL REFERENCES foods(fdc_id) ON DELETE CASCADE,
    unit_code INTEGER NOT NULL,
    grams_per_unit REAL NOT NULL,
    PRIMARY KEY (fdc_id, unit_code)
  ) WITHOUT ROWID;

  CREATE VIRTUAL TABLE food_search USING fts5(
    name,
    brand,
    search_aliases,
    content = 'foods',
    content_rowid = 'fdc_id',
    tokenize = 'unicode61 remove_diacritics 2'
  );
`;

export const NUTRITION_PRODUCT_INDEX_SCHEMA_SQL = `
  CREATE TABLE product_barcodes (
    gtin14 TEXT PRIMARY KEY NOT NULL,
    fdc_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    ingredients TEXT,
    image_url TEXT,
    serving_label TEXT,
    serving_grams REAL,
    calories REAL,
    carbohydrates_grams REAL,
    fiber_grams REAL,
    total_sugars_grams REAL,
    added_sugars_grams REAL,
    protein_grams REAL,
    fat_grams REAL,
    saturated_fat_grams REAL,
    trans_fat_grams REAL,
    sodium_milligrams REAL,
    publication_date TEXT NOT NULL
  ) WITHOUT ROWID;

  CREATE INDEX product_barcodes_by_fdc_id ON product_barcodes(fdc_id);
`;
