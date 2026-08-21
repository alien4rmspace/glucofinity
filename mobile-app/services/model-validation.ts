import type {
  MealPredictionFeatures,
  MealResponsePrediction,
  ModelMetadata,
} from '@/types/ai';

export class ModelContractValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelContractValidationError';
  }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ModelContractValidationError(`${field} must be a nonempty string.`);
  }
  return value.trim();
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ModelContractValidationError(`${field} must be a finite number.`);
  }
  return value;
}

function optionalNumber(
  value: unknown,
  field: string,
  options: { minimum?: number; maximum?: number } = {}
): number | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = requiredNumber(value, field);
  if (options.minimum !== undefined && parsed < options.minimum) {
    throw new ModelContractValidationError(`${field} must be at least ${options.minimum}.`);
  }
  if (options.maximum !== undefined && parsed > options.maximum) {
    throw new ModelContractValidationError(`${field} must be at most ${options.maximum}.`);
  }
  return parsed;
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T;
}

export function validateMealPredictionFeatures(value: unknown): MealPredictionFeatures {
  if (!isRecord(value)) {
    throw new ModelContractValidationError('Meal prediction features must be an object.');
  }
  const hourOfDay = requiredNumber(value.hourOfDay, 'hourOfDay');
  const dayOfWeek = requiredNumber(value.dayOfWeek, 'dayOfWeek');
  if (hourOfDay < 0 || hourOfDay >= 24) {
    throw new ModelContractValidationError('hourOfDay must be between 0 and less than 24.');
  }
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new ModelContractValidationError('dayOfWeek must be an integer from 0 through 6.');
  }
  return compact({
    carbohydratesGrams: optionalNumber(value.carbohydratesGrams, 'carbohydratesGrams', { minimum: 0 }),
    proteinGrams: optionalNumber(value.proteinGrams, 'proteinGrams', { minimum: 0 }),
    fatGrams: optionalNumber(value.fatGrams, 'fatGrams', { minimum: 0 }),
    fiberGrams: optionalNumber(value.fiberGrams, 'fiberGrams', { minimum: 0 }),
    calories: optionalNumber(value.calories, 'calories', { minimum: 0 }),
    estimatedMealGrams: optionalNumber(value.estimatedMealGrams, 'estimatedMealGrams', { minimum: 0 }),
    baselineGlucoseMgDl: optionalNumber(value.baselineGlucoseMgDl, 'baselineGlucoseMgDl', { minimum: 0 }),
    recentGlucoseSlopeMgDlPerMinute: optionalNumber(
      value.recentGlucoseSlopeMgDlPerMinute,
      'recentGlucoseSlopeMgDlPerMinute'
    ),
    recentGlucoseMeanMgDl: optionalNumber(value.recentGlucoseMeanMgDl, 'recentGlucoseMeanMgDl', { minimum: 0 }),
    recentGlucoseVariabilityMgDl: optionalNumber(
      value.recentGlucoseVariabilityMgDl,
      'recentGlucoseVariabilityMgDl',
      { minimum: 0 }
    ),
    minutesSincePreviousMeal: optionalNumber(
      value.minutesSincePreviousMeal,
      'minutesSincePreviousMeal',
      { minimum: 0 }
    ),
    hourOfDay,
    dayOfWeek,
    recentExerciseMinutes: optionalNumber(value.recentExerciseMinutes, 'recentExerciseMinutes', { minimum: 0 }),
    sleepDurationHours: optionalNumber(value.sleepDurationHours, 'sleepDurationHours', { minimum: 0 }),
    historicalSimilarMealResponseMgDl: optionalNumber(
      value.historicalSimilarMealResponseMgDl,
      'historicalSimilarMealResponseMgDl'
    ),
  });
}

export function validateModelMetadata(value: unknown): ModelMetadata {
  if (!isRecord(value)) {
    throw new ModelContractValidationError('Model metadata must be an object.');
  }
  const trainedAt = value.trainedAt === undefined
    ? undefined
    : requiredString(value.trainedAt, 'trainedAt');
  if (trainedAt !== undefined && !Number.isFinite(Date.parse(trainedAt))) {
    throw new ModelContractValidationError('trainedAt must be a valid timestamp.');
  }
  return compact({
    modelId: requiredString(value.modelId, 'modelId'),
    modelType: requiredString(value.modelType, 'modelType'),
    version: requiredString(value.version, 'version'),
    trainedAt: trainedAt === undefined ? undefined : new Date(trainedAt).toISOString(),
    trainingSampleCount: optionalNumber(
      value.trainingSampleCount,
      'trainingSampleCount',
      { minimum: 0 }
    ),
    metrics: isRecord(value.metrics)
      ? compact({
          mae: optionalNumber(value.metrics.mae, 'metrics.mae', { minimum: 0 }),
          rmse: optionalNumber(value.metrics.rmse, 'metrics.rmse', { minimum: 0 }),
          rSquared: optionalNumber(value.metrics.rSquared, 'metrics.rSquared'),
        })
      : undefined,
    featureVersion: requiredString(value.featureVersion, 'featureVersion'),
    dataOrigin:
      value.dataOrigin === undefined
        ? undefined
        : value.dataOrigin === 'authorized-user-export' ||
            value.dataOrigin === 'synthetic-fixture'
          ? value.dataOrigin
          : (() => {
              throw new ModelContractValidationError('dataOrigin is invalid.');
            })(),
  });
}

export function validateMealResponsePrediction(
  value: unknown
): MealResponsePrediction {
  if (!isRecord(value)) {
    throw new ModelContractValidationError('Meal response prediction must be an object.');
  }
  if (value.kind !== 'predicted') {
    throw new ModelContractValidationError('Prediction kind must be predicted.');
  }
  const generatedAt = requiredString(value.generatedAt, 'generatedAt');
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new ModelContractValidationError('generatedAt must be a valid timestamp.');
  }
  return compact({
    kind: 'predicted' as const,
    predictedRiseMgDl: optionalNumber(value.predictedRiseMgDl, 'predictedRiseMgDl'),
    predictedPeakMgDl: optionalNumber(value.predictedPeakMgDl, 'predictedPeakMgDl', { minimum: 0 }),
    predictedTimeToPeakMinutes: optionalNumber(
      value.predictedTimeToPeakMinutes,
      'predictedTimeToPeakMinutes',
      { minimum: 0 }
    ),
    predicted120MinuteGlucoseMgDl: optionalNumber(
      value.predicted120MinuteGlucoseMgDl,
      'predicted120MinuteGlucoseMgDl',
      { minimum: 0 }
    ),
    predictedIncrementalAuc: optionalNumber(
      value.predictedIncrementalAuc,
      'predictedIncrementalAuc',
      { minimum: 0 }
    ),
    confidence: optionalNumber(value.confidence, 'confidence', {
      minimum: 0,
      maximum: 1,
    }),
    modelId: requiredString(value.modelId, 'modelId'),
    modelVersion: requiredString(value.modelVersion, 'modelVersion'),
    featureVersion: requiredString(value.featureVersion, 'featureVersion'),
    generatedAt: new Date(generatedAt).toISOString(),
  });
}
