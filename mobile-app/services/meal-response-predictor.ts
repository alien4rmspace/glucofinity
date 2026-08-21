import type {
  MealPredictionFeatures,
  MealResponsePrediction,
  ModelMetadata,
} from '@/types/ai';
import type { ModelRegistry } from './model-registry';
import {
  validateMealPredictionFeatures,
  validateMealResponsePrediction,
  validateModelMetadata,
} from './model-validation';

export interface MealResponsePredictor {
  readonly metadata: ModelMetadata;
  predict(features: MealPredictionFeatures): Promise<MealResponsePrediction>;
}
/**
 * Validates inputs/outputs and ensures every prediction resolves to registered,
 * feature-compatible model metadata before it can reach UI code.
 */
export async function runMealResponsePrediction(
  predictor: MealResponsePredictor,
  registry: ModelRegistry,
  features: MealPredictionFeatures
): Promise<MealResponsePrediction> {
  const metadata = validateModelMetadata(predictor.metadata);
  const registered = registry.get(metadata.modelId, metadata.version);
  if (!registered) {
    throw new Error(`Model ${metadata.modelId}@${metadata.version} is not registered.`);
  }
  if (registered.featureVersion !== metadata.featureVersion) {
    throw new Error('Registered model feature version does not match the predictor.');
  }
  const validatedFeatures = validateMealPredictionFeatures(features);
  const prediction = validateMealResponsePrediction(
    await predictor.predict(validatedFeatures)
  );
  if (
    prediction.modelId !== metadata.modelId ||
    prediction.modelVersion !== metadata.version ||
    prediction.featureVersion !== metadata.featureVersion
  ) {
    throw new Error('Prediction provenance does not match the registered model.');
  }
  return prediction;
}
