import {
  generateMealPredictionFeatures,
  type MealFeatureContext,
} from '@/features/meal-prediction-features';
import type { MealPredictionFeatures } from '@/types/ai';
import type {
  GlucoseReading,
  GlucoseReadingSource,
  MealEntry,
  MealGlucoseResponse,
} from '@/types/health';

export type OptionalMealContextFeatures = MealFeatureContext;

export interface MealResponseDatasetRecord {
  featureVersion: string;
  features: MealPredictionFeatures;
  observedResponse: MealGlucoseResponse;
  glucoseSources: GlucoseReadingSource[];
}
/**
 * Backwards-compatible feature record. New training exports should use
 * buildMealTrainingExample/buildMealTrainingDataset so eligibility is explicit.
 */
export function buildMealResponseDatasetRecord(
  meal: MealEntry,
  response: MealGlucoseResponse,
  readings: readonly GlucoseReading[],
  meals: readonly MealEntry[],
  context: OptionalMealContextFeatures = {}
): MealResponseDatasetRecord {
  const generated = generateMealPredictionFeatures(
    meal,
    response,
    readings,
    meals,
    context
  );
  return {
    featureVersion: generated.featureVersion,
    features: generated.features,
    observedResponse: response,
    glucoseSources: [...new Set(readings.map((reading) => reading.source))].sort(),
  };
}
