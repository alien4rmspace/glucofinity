import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import {
  NUTRITION_CATALOG_SCHEMA_SQL,
  NUTRITION_CATALOG_SCHEMA_VERSION,
  NUTRITION_CORE_CATALOG_VERSION,
  NUTRITION_PRODUCT_INDEX_SCHEMA_SQL,
  NUTRITION_PRODUCT_INDEX_VERSION,
} from '../data/nutrition-catalog-schema';
import { remoteNutritionCatalogConfig } from '../services/nutrition-catalog-config';

const databasePath = path.resolve('assets/data/nutrition-core.db');

test('starts the branded catalog preparation when the root app opens', () => {
  const rootLayout = readFileSync(path.resolve('app/_layout.tsx'), 'utf8');
  const startupProvider = readFileSync(
    path.resolve('providers/nutrition-catalog-provider.tsx'),
    'utf8',
  );
  const nativeCatalog = readFileSync(
    path.resolve('services/nutrition-catalog.native.ts'),
    'utf8',
  );

  assert.match(rootLayout, /<NutritionCatalogProvider>/);
  assert.match(startupProvider, /useEffect\(\(\) => \{/);
  assert.match(startupProvider, /nutritionCatalog\.initialize\(\)/);
  assert.match(nativeCatalog, /void prepareBrandedCatalogInBackground\(\)/);
  assert.match(nativeCatalog, /FileSystemSessionType\.BACKGROUND/);
  assert.match(nativeCatalog, /createDownloadResumable\(/);
  assert.match(nativeCatalog, /brandedBytesDownloaded: Math\.min\(totalBytesWritten/);
  const settings = readFileSync(path.resolve('app/(tabs)/settings.tsx'), 'utf8');
  assert.match(settings, /label="Product catalog"/);
  assert.match(settings, /accessibilityRole="progressbar"/);
  assert.match(settings, /Download complete · Verifying/);
});

test('bundles a valid, complete core SQLite nutrition catalog', () => {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const metadataRows = database.prepare(
      'SELECT key, value FROM catalog_metadata',
    ).all() as { key: string; value: string }[];
    const metadata = Object.fromEntries(
      metadataRows.map(({ key, value }) => [key, value]),
    );
    const foodCount = database.prepare('SELECT COUNT(*) AS count FROM foods').get() as {
      count: number;
    };
    const fiberCount = database.prepare(
      'SELECT COUNT(*) AS count FROM foods WHERE fiber_grams IS NOT NULL',
    ).get() as { count: number };
    const sourceCounts = (database.prepare(
      'SELECT source_rank, COUNT(*) AS count FROM foods GROUP BY source_rank ORDER BY source_rank',
    ).all() as { source_rank: number; count: number }[]).map(({ source_rank, count }) => ({
      source_rank,
      count,
    }));
    const integrity = database.prepare('PRAGMA integrity_check').get() as {
      integrity_check: string;
    };

    assert.equal(metadata.schema_version, String(NUTRITION_CATALOG_SCHEMA_VERSION));
    assert.equal(metadata.catalog_kind, 'core');
    assert.equal(metadata.catalog_version, NUTRITION_CORE_CATALOG_VERSION);
    assert.equal(metadata.source_food_count, '13808');
    assert.equal(metadata.skipped_missing_macros, '217');
    assert.equal(foodCount.count, 13_591);
    assert.equal(fiberCount.count, 12_847);
    assert.deepEqual(sourceCounts, [
      { source_rank: 0, count: 367 },
      { source_rank: 1, count: 7_793 },
      { source_rank: 2, count: 5_431 },
    ]);
    assert.equal(integrity.integrity_check, 'ok');
  } finally {
    database.close();
  }
});

test('supports exact aliases, portions, and full-text catalog searches', () => {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const blueberry = database.prepare(`
      SELECT f.fdc_id, f.name
      FROM food_aliases a
      JOIN foods f ON f.fdc_id = a.fdc_id
      WHERE a.alias = ?
      ORDER BY length(f.name)
      LIMIT 1
    `).get('blueberries') as { fdc_id: number; name: string };
    const blueberryPortion = database.prepare(`
      SELECT grams_per_unit
      FROM food_portions
      WHERE fdc_id = ? AND unit_code = 0
    `).get(171711) as { grams_per_unit: number };
    const granola = database.prepare(`
      SELECT f.fdc_id, f.name
      FROM food_search s
      JOIN foods f ON f.fdc_id = s.rowid
      WHERE food_search MATCH ?
      ORDER BY bm25(food_search, 0.0, 8.0, 4.0, 2.0)
      LIMIT 1
    `).get('"granola"') as { fdc_id: number; name: string };

    assert.match(blueberry.name, /blueberr/i);
    assert.equal(blueberryPortion.grams_per_unit, 148);
    assert.match(granola.name, /granola/i);
  } finally {
    database.close();
  }
});

test('defines a separate versioned barcode index without changing the bundled core database', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(NUTRITION_CATALOG_SCHEMA_SQL);
    database.exec(NUTRITION_PRODUCT_INDEX_SCHEMA_SQL);
    database.prepare(`
      INSERT INTO product_barcodes (
        gtin14, fdc_id, name, brand, ingredients, serving_label, serving_grams,
        calories, carbohydrates_grams, fiber_grams, publication_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      '00042100005264',
      123,
      'Example food',
      'Example brand',
      'Oats, almonds',
      '1 bar (40 g)',
      40,
      180,
      24,
      5,
      '2026-04-01',
    );
    const product = database.prepare(
      'SELECT * FROM product_barcodes WHERE gtin14 = ?',
    ).get('00042100005264') as { fdc_id: number; ingredients: string };

    assert.equal(NUTRITION_PRODUCT_INDEX_VERSION, 2);
    assert.equal(product.fdc_id, 123);
    assert.equal(product.ingredients, 'Oats, almonds');
  } finally {
    database.close();
  }
});

test('requires a complete HTTPS manifest before enabling branded downloads', () => {
  const original = {
    url: process.env.EXPO_PUBLIC_FOOD_CATALOG_URL,
    version: process.env.EXPO_PUBLIC_FOOD_CATALOG_VERSION,
    md5: process.env.EXPO_PUBLIC_FOOD_CATALOG_MD5,
    bytes: process.env.EXPO_PUBLIC_FOOD_CATALOG_BYTES,
  };
  try {
    delete process.env.EXPO_PUBLIC_FOOD_CATALOG_URL;
    delete process.env.EXPO_PUBLIC_FOOD_CATALOG_VERSION;
    delete process.env.EXPO_PUBLIC_FOOD_CATALOG_MD5;
    delete process.env.EXPO_PUBLIC_FOOD_CATALOG_BYTES;
    assert.equal(remoteNutritionCatalogConfig(), undefined);

    process.env.EXPO_PUBLIC_FOOD_CATALOG_URL = 'http://example.test/catalog.db';
    process.env.EXPO_PUBLIC_FOOD_CATALOG_VERSION = '2026-04';
    process.env.EXPO_PUBLIC_FOOD_CATALOG_MD5 = 'a'.repeat(32);
    process.env.EXPO_PUBLIC_FOOD_CATALOG_BYTES = '330043392';
    assert.throws(remoteNutritionCatalogConfig, /HTTPS/i);

    process.env.EXPO_PUBLIC_FOOD_CATALOG_URL = 'https://example.test/catalog.db';
    assert.deepEqual(remoteNutritionCatalogConfig(), {
      url: 'https://example.test/catalog.db',
      version: '2026-04',
      md5: 'a'.repeat(32),
      bytes: 330_043_392,
    });
  } finally {
    setOrDeleteEnvironmentValue('EXPO_PUBLIC_FOOD_CATALOG_URL', original.url);
    setOrDeleteEnvironmentValue('EXPO_PUBLIC_FOOD_CATALOG_VERSION', original.version);
    setOrDeleteEnvironmentValue('EXPO_PUBLIC_FOOD_CATALOG_MD5', original.md5);
    setOrDeleteEnvironmentValue('EXPO_PUBLIC_FOOD_CATALOG_BYTES', original.bytes);
  }
});

function setOrDeleteEnvironmentValue(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
