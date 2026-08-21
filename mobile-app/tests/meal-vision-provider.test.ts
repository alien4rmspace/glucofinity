import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MealAnalysisValidationError,
  ValidatedMealVisionProvider,
  validateMealAnalysis,
  type MealVisionProvider,
} from '../services/meal-vision-provider';
import type { MealAnalysis } from '../types/ai';

test('accepts partial nutrition without inventing unknown fields', () => {
  const analysis = validateMealAnalysis({
    foods: [{ name: 'Apple slices', carbohydratesGrams: 18 }],
    totalCarbohydratesGrams: 18,
    generatedAt: '2026-08-11T12:00:00.000Z',
  });

  assert.equal(analysis.foods[0].name, 'Apple slices');
  assert.equal(analysis.totalCarbohydratesGrams, 18);
  assert.equal('totalCalories' in analysis, false);
  assert.equal('proteinGrams' in analysis.foods[0], false);
});

test('rejects malformed provider responses', () => {
  assert.throws(
    () =>
      validateMealAnalysis({
        foods: [{ name: 'Example', calories: -1 }],
        generatedAt: 'not-a-date',
      }),
    MealAnalysisValidationError
  );
});

test('validates a mocked provider and attaches provider provenance', async () => {
  const fakeProvider: MealVisionProvider = {
    providerId: 'test-provider',
    async analyzeMeal() {
      return {
        foods: [{ name: 'Test meal' }],
        generatedAt: '2026-08-11T12:00:00.000Z',
      };
    },
  };
  const provider = new ValidatedMealVisionProvider(fakeProvider);
  const result = await provider.analyzeMeal('file:///meal.jpg');

  assert.equal(result.providerId, 'test-provider');
  assert.equal(result.foods[0].name, 'Test meal');

  const malformedProvider: MealVisionProvider = {
    providerId: 'malformed-provider',
    async analyzeMeal() {
      return { foods: 'invalid' } as unknown as MealAnalysis;
    },
  };
  await assert.rejects(
    new ValidatedMealVisionProvider(malformedProvider).analyzeMeal('file:///meal.jpg'),
    MealAnalysisValidationError
  );
});
