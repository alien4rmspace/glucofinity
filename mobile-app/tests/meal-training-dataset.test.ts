import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMealTrainingDataset,
  eligibleMealTrainingExamples,
} from '../services/meal-training-dataset';
import type { MealEntry, MealGlucoseResponse } from '../types/health';

const meals: MealEntry[] = [
  { id: 'later', timestamp: '2026-08-11T18:00:00.000Z', name: 'Later meal' },
  { id: 'earlier', timestamp: '2026-08-11T12:00:00.000Z', name: 'Earlier meal' },
  { id: 'missing', timestamp: '2026-08-11T20:00:00.000Z', name: 'Missing response' },
];

const responses: MealGlucoseResponse[] = [
  {
    mealId: 'earlier',
    glucoseRiseMgDl: 25,
    sampleCount: 18,
    dataQuality: 'good',
  },
  {
    mealId: 'later',
    glucoseRiseMgDl: 31,
    sampleCount: 5,
    dataQuality: 'limited',
  },
];

test('builds chronological examples and excludes weak response coverage', () => {
  const dataset = buildMealTrainingDataset({
    meals,
    responses,
    readings: [],
    generatedAt: '2026-08-12T00:00:00.000Z',
    dataOrigin: 'synthetic-fixture',
  });

  assert.deepEqual(
    dataset.examples.map((example) => example.mealId),
    ['earlier', 'later', 'missing']
  );
  assert.deepEqual(
    eligibleMealTrainingExamples(dataset).map((example) => example.mealId),
    ['earlier']
  );
  assert.deepEqual(dataset.examples[1].exclusionReasons, [
    'response-quality-limited',
  ]);
  assert.deepEqual(dataset.examples[2].exclusionReasons, [
    'response-quality-insufficient',
    'no-observed-labels',
  ]);
});
