import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeIngredients } from '../services/ingredient-analyzer';
import { scoreProduct } from '../services/product-score-engine';
import type { ProductNutritionFacts } from '../types/product-scoring';

function nutrition(
  overrides: Partial<ProductNutritionFacts> = {},
): ProductNutritionFacts {
  return {
    basis: 'serving',
    servingLabel: '1 serving (40 g)',
    servingGrams: 40,
    calories: 180,
    totalCarbohydratesGrams: 24,
    dietaryFiberGrams: 3,
    totalSugarGrams: 8,
    addedSugarGrams: 5,
    proteinGrams: 6,
    totalFatGrams: 7,
    saturatedFatGrams: 1,
    transFatGrams: 0,
    sodiumMilligrams: 140,
    ...overrides,
  };
}

test('high added sugar produces a transparent maximum-weight penalty', () => {
  const result = scoreProduct({
    productId: 'high-sugar',
    nutrition: nutrition({ addedSugarGrams: 30, totalSugarGrams: 32 }),
    ingredients: 'Sugar, corn syrup, enriched flour, cocoa',
  });

  assert.equal(
    result.overallScore.negativeContributions.find(({ id }) => id === 'added-sugar')?.value,
    -20,
  );
  assert.ok((result.glucoseImpactScore.score ?? 100) < 60);
});

test('a high-fiber whole-food product receives bounded positive contributions', () => {
  const result = scoreProduct({
    productId: 'whole-food',
    nutrition: nutrition({ dietaryFiberGrams: 9, addedSugarGrams: 0, proteinGrams: 10 }),
    ingredients: 'Whole grain oats, almonds, chia seeds, blueberries',
  });

  assert.equal(result.processingLevel, 'minimal');
  assert.ok(result.overallScore.positiveContributions.some(({ id }) => id === 'fiber'));
  assert.ok(result.overallScore.positiveContributions.some(
    ({ id }) => id === 'whole-food-ingredients',
  ));
});

test('high protein receives a capped bonus and cannot dominate the food score', () => {
  const result = scoreProduct({
    productId: 'protein',
    nutrition: nutrition({ proteinGrams: 100, addedSugarGrams: 25, sodiumMilligrams: 1_500 }),
    ingredients: 'Milk protein isolate, sugar, corn syrup',
  });
  const protein = result.overallScore.positiveContributions.find(({ id }) => id === 'protein');

  assert.ok((protein?.value ?? 0) <= 8);
  assert.ok((result.overallScore.score ?? 100) < 70);
});

test('high sodium produces the configured maximum penalty', () => {
  const result = scoreProduct({
    productId: 'sodium',
    nutrition: nutrition({ sodiumMilligrams: 2_300 }),
    ingredients: 'Beans, water, salt',
  });

  assert.equal(
    result.overallScore.negativeContributions.find(({ id }) => id === 'sodium')?.value,
    -8,
  );
});

test('a highly refined cereal lowers both generic scores', () => {
  const result = scoreProduct({
    productId: 'cereal',
    nutrition: nutrition({ totalCarbohydratesGrams: 52, dietaryFiberGrams: 1 }),
    ingredients: 'Enriched wheat flour, sugar, maltodextrin, corn starch, natural flavor',
  });

  assert.ok(result.ingredientAnalysis.refinedCarbohydrates.length >= 2);
  assert.ok(result.overallScore.negativeContributions.some(
    ({ id }) => id === 'refined-carbohydrate',
  ));
  assert.ok(result.glucoseImpactScore.negativeContributions.some(
    ({ id }) => id === 'glucose-refined-ingredient',
  ));
});

test('artificial sweetener is informational rather than an automatic score deduction', () => {
  const result = scoreProduct({
    productId: 'sweetener',
    nutrition: nutrition({ totalSugarGrams: 0, addedSugarGrams: 0 }),
    ingredients: 'Water, natural flavor, sucralose, citric acid, potassium sorbate',
  });

  assert.ok(result.ingredientAnalysis.processingSignals.some(
    ({ category }) => category === 'artificial-sweetener',
  ));
  assert.equal(
    result.overallScore.negativeContributions.some(({ id }) => id.includes('sweetener')),
    false,
  );
});

test('missing nutrition never creates a glucose-impact value', () => {
  const result = scoreProduct({
    productId: 'missing-nutrition',
    ingredients: 'Oats, almonds',
  });

  assert.equal(result.overallScore.score, undefined);
  assert.equal(result.glucoseImpactScore.score, undefined);
  assert.ok(result.glucoseImpactScore.unavailableData.includes('Total carbohydrates'));
});

test('missing ingredients reports unknown processing without blocking nutrition scoring', () => {
  const result = scoreProduct({
    productId: 'missing-ingredients',
    nutrition: nutrition(),
  });

  assert.equal(result.processingLevel, 'unknown');
  assert.equal(typeof result.overallScore.score, 'number');
  assert.equal(typeof result.glucoseImpactScore.score, 'number');
  assert.ok(result.overallScore.unavailableData.includes('Ingredient list'));
  assert.ok(result.glucoseImpactScore.unavailableData.includes('Ingredient list'));
});

test('missing fiber is not silently treated as zero fiber', () => {
  const facts = nutrition();
  delete facts.dietaryFiberGrams;
  const result = scoreProduct({
    productId: 'missing-fiber',
    nutrition: facts,
    ingredients: 'Enriched wheat flour, sugar',
  });

  assert.equal(result.estimatedNetCarbohydratesGrams, undefined);
  assert.ok(result.glucoseImpactScore.unavailableData.includes('Dietary fiber'));
  assert.match(
    result.glucoseImpactScore.negativeContributions.find(
      ({ id }) => id === 'rapid-carbohydrates',
    )?.explanation ?? '',
    /without assuming a fiber value/i,
  );
});

test('serving weight alone is not enough to create an overall nutrition score', () => {
  const result = scoreProduct({
    productId: 'weight-only',
    nutrition: {
      basis: 'serving',
      servingLabel: '1 package (30 g)',
      servingGrams: 30,
    },
    ingredients: 'Oats',
  });

  assert.equal(result.overallScore.score, undefined);
  assert.equal(result.glucoseImpactScore.score, undefined);
});

test('zero carbohydrates receives a high but explicitly estimated glucose score', () => {
  const result = scoreProduct({
    productId: 'zero-carbs',
    nutrition: nutrition({
      totalCarbohydratesGrams: 0,
      dietaryFiberGrams: 0,
      totalSugarGrams: 0,
      addedSugarGrams: 0,
      proteinGrams: 20,
      totalFatGrams: 12,
    }),
    ingredients: 'Eggs, water',
  });

  assert.equal(result.estimatedNetCarbohydratesGrams, 0);
  assert.ok((result.glucoseImpactScore.score ?? 0) >= 95);
});

test('extreme values stay finite and clamp the glucose score at zero', () => {
  const result = scoreProduct({
    productId: 'extreme',
    nutrition: nutrition({
      totalCarbohydratesGrams: 10_000,
      dietaryFiberGrams: 0,
      totalSugarGrams: 10_000,
      addedSugarGrams: 10_000,
      saturatedFatGrams: 10_000,
      transFatGrams: 10_000,
      sodiumMilligrams: 1_000_000,
    }),
    ingredients: 'Sugar, enriched flour, maltodextrin, corn starch, natural flavor',
  });

  assert.equal(result.glucoseImpactScore.score, 0);
  assert.ok((result.overallScore.score ?? 100) >= 0);
  assert.ok((result.overallScore.score ?? 0) <= 100);
});

test('upper score values clamp at 100', () => {
  const result = scoreProduct({
    productId: 'upper-bound',
    nutrition: nutrition({
      totalCarbohydratesGrams: 0,
      dietaryFiberGrams: 10,
      totalSugarGrams: 0,
      addedSugarGrams: 0,
      proteinGrams: 50,
      totalFatGrams: 20,
      saturatedFatGrams: 0,
      transFatGrams: 0,
      sodiumMilligrams: 0,
    }),
    ingredients: 'Oats, almonds, chia seeds',
  });

  assert.equal(result.glucoseImpactScore.score, 100);
});

test('ingredient aliases detect cane sugar, dextrose, and maltodextrin', () => {
  const analysis = analyzeIngredients(
    'Whole grain oats, cane sugar, dextrose, maltodextrin',
  );

  assert.ok(analysis.addedSugars.some(({ ingredient }) => /cane sugar/i.test(ingredient)));
  assert.ok(analysis.addedSugars.some(({ ingredient }) => /dextrose/i.test(ingredient)));
  assert.ok(analysis.addedSugars.some(({ ingredient }) => /maltodextrin/i.test(ingredient)));
  assert.ok(analysis.refinedCarbohydrates.some(
    ({ ingredient }) => /maltodextrin/i.test(ingredient),
  ));
});
