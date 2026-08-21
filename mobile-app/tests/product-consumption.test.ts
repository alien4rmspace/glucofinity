import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  buildProductMealEntry,
  productConsumptionEventFromMeal,
  scaleProductNutrition,
} from '../services/product-consumption';
import type { ProductBarcodeRecord } from '../services/nutrition-catalog';

const product: ProductBarcodeRecord = {
  productId: 'gtin14:00042100005264',
  fdcId: 123,
  gtin14: '00042100005264',
  name: 'Example oats',
  brand: 'Example brand',
  ingredients: 'Oats, almonds',
  nutrition: {
    basis: 'serving',
    servingLabel: '1 bar (40 g)',
    servingGrams: 40,
    calories: 180,
    totalCarbohydratesGrams: 24,
    dietaryFiberGrams: 5,
    proteinGrams: 6,
    totalFatGrams: 7,
  },
  publicationDate: '2026-04-01',
};

test('scales available serving facts without inventing missing nutrients', () => {
  const scaled = scaleProductNutrition(product.nutrition, 1.5);

  assert.equal(scaled?.servingGrams, 60);
  assert.equal(scaled?.calories, 270);
  assert.equal(scaled?.totalCarbohydratesGrams, 36);
  assert.equal(scaled?.addedSugarGrams, undefined);
});

test('builds a stable product consumption context inside a meal event', () => {
  const occurredAt = new Date('2026-08-20T12:00:00.000Z');
  const meal = buildProductMealEntry(product, 2, occurredAt);

  assert.equal(meal.name, product.name);
  assert.equal(meal.estimatedCarbsGrams, 48);
  assert.equal(meal.nutritionEstimate?.source, 'usda-label');
  assert.deepEqual(meal.productContext, {
    schemaVersion: 1,
    productId: product.productId,
    gtin14: product.gtin14,
    fdcId: product.fdcId,
    servingQuantity: 2,
    servingLabel: '1 bar (40 g)',
    servingGrams: 80,
    nutritionPerServing: product.nutrition,
  });
});

test('wires transparent scores, serving edits, limitations, and meal logging into scanner results', () => {
  const scanner = readFileSync(path.resolve('app/product-scan.tsx'), 'utf8');

  assert.match(scanner, /Overall Food Score/);
  assert.match(scanner, /Estimated Glucose Impact/);
  assert.match(scanner, /Key nutrition highlights/);
  assert.match(scanner, /Processing level/);
  assert.match(scanner, /Number of servings/);
  assert.match(scanner, /Why the scores changed/);
  assert.match(scanner, /Log product as a meal/);
  assert.match(scanner, /individual response/);
  assert.doesNotMatch(scanner, /unsafe for diabetics/i);
  assert.doesNotMatch(scanner, /Your Score:\s*\d/);
});

test('derives a future personalization event by joining a product meal with observed metrics', () => {
  const meal = buildProductMealEntry(product, 1, new Date('2026-08-20T12:00:00.000Z'));
  const event = productConsumptionEventFromMeal(meal, {
    mealId: meal.id,
    baselineGlucoseMgDl: 100,
    peakGlucoseMgDl: 143,
    glucoseRiseMgDl: 43,
    incrementalAuc: 2_500,
    timeToPeakMinutes: 55,
    returnToBaselineMinutes: 145,
    sampleCount: 24,
    dataQuality: 'good',
  }, {
    recentExerciseMinutes: 20,
    sleepDurationHours: 7.5,
  });

  assert.equal(event?.productId, product.productId);
  assert.equal(event?.glucoseChangeMgDl, 43);
  assert.equal(event?.recentExerciseMinutes, 20);
  assert.equal(event?.sleepDurationHours, 7.5);
});
