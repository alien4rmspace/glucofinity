import {
  generateMealPredictionFeatures,
  type MealFeatureContext,
} from '@/features/meal-prediction-features';
import type {
  MealTrainingDataset,
  MealTrainingExample,
  MealTrainingLabels,
} from '@/types/ai';
import type {
  GlucoseReading,
  MealEntry,
  MealGlucoseResponse,
} from '@/types/health';

export const MEAL_TRAINING_SCHEMA_VERSION = 'meal-training-dataset-v1';

function compactLabels(response: MealGlucoseResponse): MealTrainingLabels {
  return Object.fromEntries(
    Object.entries({
      glucoseRiseMgDl: response.glucoseRiseMgDl,
      peakGlucoseMgDl: response.peakGlucoseMgDl,
      timeToPeakMinutes: response.timeToPeakMinutes,
      glucoseAt120MinutesMgDl: response.glucoseAt120MinutesMgDl,
      incrementalAuc: response.incrementalAuc,
    }).filter(([, value]) => value !== undefined && Number.isFinite(value))
  ) as MealTrainingLabels;
}
function trainingExclusionReasons(
  response: MealGlucoseResponse,
  labels: MealTrainingLabels
): string[] {
  const reasons: string[] = [];
  if (response.dataQuality !== 'good') {
    reasons.push(`response-quality-${response.dataQuality}`);
  }
  if (Object.keys(labels).length === 0) reasons.push('no-observed-labels');
  return reasons;
}

export function buildMealTrainingExample(
  meal: MealEntry,
  response: MealGlucoseResponse,
  readings: readonly GlucoseReading[],
  meals: readonly MealEntry[],
  context: MealFeatureContext = {}
): MealTrainingExample {
  const generated = generateMealPredictionFeatures(
    meal,
    response,
    readings,
    meals,
    context
  );
  const labels = compactLabels(response);
  const exclusionReasons = trainingExclusionReasons(response, labels);
  return {
    exampleId: `${meal.id}:${generated.featureVersion}`,
    mealId: meal.id,
    occurredAt: generated.mealTimestamp,
    featureVersion: generated.featureVersion,
    features: generated.features,
    labels,
    dataQuality: response.dataQuality,
    eligibleForTraining: exclusionReasons.length === 0,
    exclusionReasons,
    glucoseSources: [...new Set(readings.map((reading) => reading.source))].sort(),
  };
}

export interface BuildMealTrainingDatasetInput {
  meals: readonly MealEntry[];
  responses: readonly MealGlucoseResponse[];
  readings: readonly GlucoseReading[];
  generatedAt: string;
  dataOrigin: MealTrainingDataset['dataOrigin'];
  contextByMealId?: Readonly<Record<string, MealFeatureContext>>;
}

export function buildMealTrainingDataset({
  meals,
  responses,
  readings,
  generatedAt,
  dataOrigin,
  contextByMealId = {},
}: BuildMealTrainingDatasetInput): MealTrainingDataset {
  const generatedTimestamp = Date.parse(generatedAt);
  if (!Number.isFinite(generatedTimestamp)) {
    throw new Error('Training dataset generatedAt must be a valid timestamp.');
  }
  const responseByMealId = new Map(
    responses.map((response) => [response.mealId, response])
  );
  const examples = meals
    .map((meal) => {
      const response = responseByMealId.get(meal.id) ?? {
        mealId: meal.id,
        sampleCount: 0,
        dataQuality: 'insufficient' as const,
      };
      return buildMealTrainingExample(
        meal,
        response,
        readings,
        meals,
        contextByMealId[meal.id]
      );
    })
    .sort((first, second) => Date.parse(first.occurredAt) - Date.parse(second.occurredAt));

  return {
    schemaVersion: MEAL_TRAINING_SCHEMA_VERSION,
    generatedAt: new Date(generatedTimestamp).toISOString(),
    dataOrigin,
    examples,
  };
}

export function eligibleMealTrainingExamples(
  dataset: MealTrainingDataset
): MealTrainingExample[] {
  return dataset.examples.filter((example) => example.eligibleForTraining);
}
