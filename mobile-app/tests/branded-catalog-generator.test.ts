import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

test('branded generator keeps the latest valid USDA record for each canonical barcode', () => {
  const fixtureDirectory = mkdtempSync(path.join(tmpdir(), 'glucofinity-branded-'));
  const outputPath = path.join(fixtureDirectory, 'catalog.db');
  try {
    writeFileSync(path.join(fixtureDirectory, 'food.csv'), [
      'fdc_id,data_type,description,food_category_id,publication_date',
      '1,branded_food,Older cereal,,2026-01-01',
      '2,branded_food,Current cereal,,2026-04-01',
      '3,branded_food,Invalid barcode food,,2026-04-01',
    ].join('\n'));
    writeFileSync(path.join(fixtureDirectory, 'branded_food.csv'), [
      'fdc_id,brand_owner,brand_name,subbrand_name,gtin_upc,ingredients,serving_size,serving_size_unit,household_serving_fulltext',
      '1,Example Owner,Example Brand,,042100005264,"Sugar, flour",30,g,1 cup',
      '2,Example Owner,Example Brand,,0042100005264,"Oats, almonds",30,g,1 cup',
      '3,Example Owner,Example Brand,,042100005265,"Rice, salt",30,g,1 cup',
    ].join('\n'));
    writeFileSync(path.join(fixtureDirectory, 'food_nutrient.csv'), [
      'fdc_id,nutrient_id,amount',
      '2,1003,10',
      '2,1004,5',
      '2,1005,60',
      '2,1008,325',
      '2,1079,8',
      '2,1093,500',
      '2,1235,20',
      '2,1257,0.5',
      '2,1258,4',
      '2,2000,25',
    ].join('\n'));

    const result = spawnSync(process.execPath, [
      path.resolve('node_modules/tsx/dist/cli.mjs'),
      path.resolve('scripts/generate-fooddata-branded-db.ts'),
      fixtureDirectory,
      outputPath,
      'test-2026-04',
    ], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const database = new DatabaseSync(outputPath, { readOnly: true });
    try {
      const product = database.prepare(
        `SELECT gtin14, fdc_id, name, ingredients, serving_label, serving_grams,
                calories, carbohydrates_grams, fiber_grams, total_sugars_grams,
                added_sugars_grams, protein_grams, fat_grams, saturated_fat_grams,
                trans_fat_grams, sodium_milligrams
         FROM product_barcodes`,
      ).get() as {
        gtin14: string;
        fdc_id: number;
        name: string;
        ingredients: string;
        serving_label: string;
        serving_grams: number;
        calories: number;
        carbohydrates_grams: number;
        fiber_grams: number;
        total_sugars_grams: number;
        added_sugars_grams: number;
        protein_grams: number;
        fat_grams: number;
        saturated_fat_grams: number;
        trans_fat_grams: number;
        sodium_milligrams: number;
      };
      const metadata = Object.fromEntries((database.prepare(
        'SELECT key, value FROM catalog_metadata',
      ).all() as { key: string; value: string }[]).map(({ key, value }) => [key, value]));

      assert.deepEqual({ ...product }, {
        gtin14: '00042100005264',
        fdc_id: 2,
        name: 'Current cereal',
        ingredients: 'Oats, almonds',
        serving_label: '1 cup',
        serving_grams: 30,
        calories: 97.5,
        carbohydrates_grams: 18,
        fiber_grams: 2.4,
        total_sugars_grams: 7.5,
        added_sugars_grams: 6,
        protein_grams: 3,
        fat_grams: 1.5,
        saturated_fat_grams: 1.2,
        trans_fat_grams: 0.15,
        sodium_milligrams: 150,
      });
      assert.equal(metadata.food_count, '1');
      assert.equal(metadata.barcode_product_count, '1');
      assert.equal(metadata.source_barcode_count, '3');
      assert.equal(metadata.skipped_invalid_barcode, '1');
      assert.equal(metadata.product_index_version, '2');
    } finally {
      database.close();
    }
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});
