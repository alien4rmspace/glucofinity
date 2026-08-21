import assert from 'node:assert/strict';
import test from 'node:test';

import { generateMealPredictionFeatures } from '../features/meal-prediction-features';
import type {
  ExerciseEntry,
  GlucoseReading,
  MealEntry,
  MealGlucoseResponse,
  SleepEntry,
} from '../types/health';

const meal: MealEntry = {
  id: 'current',
  timestamp: '2026-08-10T19:00:00.000Z',
  timezoneOffsetMinutes: 420,
  name: 'Reviewed example meal',
  nutritionEstimate: {
    foods: [{ name: 'Example food', estimatedGrams: 300 }],
    carbohydratesGrams: 42,
    proteinGrams: 20,
    source: 'ai-corrected',
  },
};

const response: MealGlucoseResponse = {
  mealId: meal.id,
  baselineGlucoseMgDl: 95,
  sampleCount: 12,
  dataQuality: 'good',
};

const readings: GlucoseReading[] = [
  {
    id: 'earlier',
    timestamp: '2026-08-10T18:45:00.000Z',
    valueMgDl: 90,
    trend: 'steady',
    source: 'mock',
  },
  {
    id: 'latest',
    timestamp: '2026-08-10T18:55:00.000Z',
    valueMgDl: 100,
    trend: 'rising',
    source: 'mock',
  },
];

test('generates deterministic meal, glucose, time, exercise, and sleep features', () => {
  const exerciseEntries: ExerciseEntry[] = [
    {
      id: 'exercise',
      startTime: '2026-08-10T17:00:00.000Z',
      durationMinutes: 30,
      activityType: 'Walking',
      intensity: 'low',
    },
  ];
  const sleepEntries: SleepEntry[] = [
    {
      id: 'sleep',
      startTime: '2026-08-10T06:00:00.000Z',
      endTime: '2026-08-10T13:30:00.000Z',
    },
  ];
  const generated = generateMealPredictionFeatures(
    meal,
    response,
    readings,
    [
      meal,
      {
        id: 'previous',
        timestamp: '2026-08-10T15:00:00.000Z',
        name: 'Previous meal',
      },
    ],
    { exerciseEntries, sleepEntries, historicalSimilarMealResponseMgDl: 28 }
  );

  assert.deepEqual(generated.features, {
    carbohydratesGrams: 42,
    proteinGrams: 20,
    estimatedMealGrams: 300,
    baselineGlucoseMgDl: 95,
    recentGlucoseSlopeMgDlPerMinute: 1,
    recentGlucoseMeanMgDl: 95,
    recentGlucoseVariabilityMgDl: 5,
    minutesSincePreviousMeal: 240,
    hourOfDay: 12,
    dayOfWeek: 1,
    recentExerciseMinutes: 30,
    sleepDurationHours: 7.5,
    historicalSimilarMealResponseMgDl: 28,
  });
});

test('keeps missing values absent and preserves explicit zero context', () => {
  const generated = generateMealPredictionFeatures(
    { id: 'sparse', timestamp: meal.timestamp, name: 'Sparse meal' },
    { mealId: 'sparse', sampleCount: 0, dataQuality: 'insufficient' },
    [],
    [],
    { recentExerciseMinutes: 0, sleepDurationHours: 0 }
  );

  assert.equal(generated.features.recentExerciseMinutes, 0);
  assert.equal(generated.features.sleepDurationHours, 0);
  assert.equal('carbohydratesGrams' in generated.features, false);
  assert.equal('baselineGlucoseMgDl' in generated.features, false);
  assert.equal('recentGlucoseMeanMgDl' in generated.features, false);
});
