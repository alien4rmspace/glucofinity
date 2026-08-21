import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMealResponseDatasetRecord } from '../services/meal-response-dataset';
import type {
  GlucoseReading,
  MealEntry,
  MealGlucoseResponse,
} from '../types/health';

function reading(id: string, timestamp: string, valueMgDl: number): GlucoseReading {
  return {
    id,
    timestamp,
    valueMgDl,
    trend: 'steady',
    source: 'mock',
  };
}

test('builds a feature-ready record without inventing unavailable context', () => {
  const meal: MealEntry = {
    id: 'meal-current',
    timestamp: '2026-08-10T19:00:00.000Z',
    timezoneOffsetMinutes: 420,
    name: 'Example meal',
    estimatedCarbsGrams: 40,
    nutritionEstimate: {
      carbohydratesGrams: 42,
      proteinGrams: 20,
      fatGrams: 15,
      source: 'manual',
    },
  };
  const previousMeal: MealEntry = {
    id: 'meal-previous',
    timestamp: '2026-08-10T15:00:00.000Z',
    name: 'Earlier meal',
  };
  const response: MealGlucoseResponse = {
    mealId: meal.id,
    baselineGlucoseMgDl: 95,
    peakGlucoseMgDl: 140,
    glucoseRiseMgDl: 45,
    sampleCount: 20,
    dataQuality: 'good',
  };
  const readings = [
    reading('one', '2026-08-10T18:45:00.000Z', 90),
    reading('two', '2026-08-10T18:55:00.000Z', 100),
  ];

  const record = buildMealResponseDatasetRecord(
    meal,
    response,
    readings,
    [meal, previousMeal]
  );

  assert.equal(record.features.hourOfDay, 12);
  assert.equal(record.features.carbohydratesGrams, 42);
  assert.equal(record.features.recentGlucoseSlopeMgDlPerMinute, 1);
  assert.equal(record.features.minutesSincePreviousMeal, 240);
  assert.equal('sleepDurationHours' in record.features, false);
  assert.deepEqual(record.glucoseSources, ['mock']);
  assert.equal(record.observedResponse.glucoseRiseMgDl, 45);
});
