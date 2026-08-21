import assert from 'node:assert/strict';
import test from 'node:test';

import { runMealResponsePrediction } from '../services/meal-response-predictor';
import { InMemoryModelRegistry } from '../services/model-registry';
import {
  ModelContractValidationError,
  validateMealPredictionFeatures,
  validateMealResponsePrediction,
} from '../services/model-validation';
import type { MealResponsePredictor } from '../services/meal-response-predictor';
import type { ModelMetadata } from '../types/ai';

const metadata: ModelMetadata = {
  modelId: 'meal-response-test',
  modelType: 'fixture-regressor',
  version: '1.0.0',
  featureVersion: 'meal-prediction-features-v1',
  dataOrigin: 'synthetic-fixture',
};

test('validates model features without filling optional fields', () => {
  const features = validateMealPredictionFeatures({ hourOfDay: 12, dayOfWeek: 2 });
  assert.deepEqual(features, { hourOfDay: 12, dayOfWeek: 2 });
  assert.throws(
    () => validateMealPredictionFeatures({ hourOfDay: 24, dayOfWeek: 2 }),
    ModelContractValidationError
  );
});

test('rejects malformed model outputs', () => {
  assert.throws(
    () =>
      validateMealResponsePrediction({
        kind: 'predicted',
        confidence: 1.2,
        modelId: 'test',
        modelVersion: '1',
        featureVersion: 'features-1',
        generatedAt: '2026-08-11T12:00:00.000Z',
      }),
    ModelContractValidationError
  );
  assert.throws(
    () =>
      validateMealResponsePrediction({
        kind: 'observed',
        modelId: 'test',
        modelVersion: '1',
        featureVersion: 'features-1',
        generatedAt: '2026-08-11T12:00:00.000Z',
      }),
    ModelContractValidationError
  );
});

test('requires registered, version-matched prediction provenance', async () => {
  const registry = new InMemoryModelRegistry();
  registry.register(metadata);
  assert.throws(() => registry.register(metadata), /already registered/);

  const predictor: MealResponsePredictor = {
    metadata,
    async predict() {
      return {
        kind: 'predicted',
        predictedRiseMgDl: 22,
        modelId: metadata.modelId,
        modelVersion: metadata.version,
        featureVersion: metadata.featureVersion,
        generatedAt: '2026-08-11T12:00:00.000Z',
      };
    },
  };
  const prediction = await runMealResponsePrediction(predictor, registry, {
    hourOfDay: 12,
    dayOfWeek: 2,
  });
  assert.equal(prediction.kind, 'predicted');
  assert.equal(prediction.modelVersion, '1.0.0');

  await assert.rejects(
    runMealResponsePrediction(
      { ...predictor, metadata: { ...metadata, version: '2.0.0' } },
      registry,
      { hourOfDay: 12, dayOfWeek: 2 }
    ),
    /not registered/
  );
});
