import type { GeneratedMealPredictionFeatures, MealPredictionFeatures } from '@/types/ai';
import type {
  ExerciseEntry,
  GlucoseReading,
  MealEntry,
  MealGlucoseResponse,
  SleepEntry,
} from '@/types/health';

const MINUTE_MS = 60_000;
const RECENT_GLUCOSE_MINUTES = 30;
const MAX_SLOPE_GAP_MINUTES = 20;
const RECENT_CONTEXT_HOURS = 24;

export const MEAL_FEATURE_VERSION = 'meal-prediction-features-v1';

export interface MealFeatureContext {
  exerciseEntries?: readonly ExerciseEntry[];
  sleepEntries?: readonly SleepEntry[];
  recentExerciseMinutes?: number;
  sleepDurationHours?: number;
  historicalSimilarMealResponseMgDl?: number;
}
export class MealFeatureGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MealFeatureGenerationError';
  }
}

function rounded(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function finiteOptional(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T;
}

function localMealTime(
  timestamp: number,
  timezoneOffsetMinutes: number | undefined
): { hourOfDay: number; dayOfWeek: number } {
  const localTimestamp =
    timezoneOffsetMinutes === undefined
      ? timestamp
      : timestamp - timezoneOffsetMinutes * MINUTE_MS;
  const date = new Date(localTimestamp);
  return {
    hourOfDay: rounded(date.getUTCHours() + date.getUTCMinutes() / 60),
    dayOfWeek: date.getUTCDay(),
  };
}

function recentGlucoseReadings(
  mealTime: number,
  readings: readonly GlucoseReading[]
): GlucoseReading[] {
  const windowStart = mealTime - RECENT_GLUCOSE_MINUTES * MINUTE_MS;
  const seenIds = new Set<string>();
  return readings
    .filter((reading) => {
      if (!reading.id || seenIds.has(reading.id)) return false;
      const timestamp = Date.parse(reading.timestamp);
      if (
        !Number.isFinite(timestamp) ||
        timestamp < windowStart ||
        timestamp > mealTime ||
        !Number.isFinite(reading.valueMgDl)
      ) {
        return false;
      }
      seenIds.add(reading.id);
      return true;
    })
    .sort((first, second) => Date.parse(first.timestamp) - Date.parse(second.timestamp));
}

function recentSlope(readings: readonly GlucoseReading[]): number | undefined {
  const current = readings.at(-1);
  const previous = readings.at(-2);
  if (!current || !previous) return undefined;
  const elapsedMinutes =
    (Date.parse(current.timestamp) - Date.parse(previous.timestamp)) / MINUTE_MS;
  if (elapsedMinutes <= 0 || elapsedMinutes > MAX_SLOPE_GAP_MINUTES) return undefined;
  return rounded((current.valueMgDl - previous.valueMgDl) / elapsedMinutes);
}

function mean(readings: readonly GlucoseReading[]): number | undefined {
  if (readings.length === 0) return undefined;
  return rounded(
    readings.reduce((sum, reading) => sum + reading.valueMgDl, 0) / readings.length
  );
}

function variability(readings: readonly GlucoseReading[]): number | undefined {
  if (readings.length < 2) return undefined;
  const average = mean(readings)!;
  const variance =
    readings.reduce(
      (sum, reading) => sum + (reading.valueMgDl - average) ** 2,
      0
    ) / readings.length;
  return rounded(Math.sqrt(variance));
}

function minutesSincePreviousMeal(
  meal: MealEntry,
  meals: readonly MealEntry[],
  mealTime: number
): number | undefined {
  const previousTime = meals.reduce<number | undefined>((latest, candidate) => {
    if (candidate.id === meal.id) return latest;
    const timestamp = Date.parse(candidate.timestamp);
    if (!Number.isFinite(timestamp) || timestamp >= mealTime) return latest;
    return latest === undefined || timestamp > latest ? timestamp : latest;
  }, undefined);
  return previousTime === undefined
    ? undefined
    : rounded((mealTime - previousTime) / MINUTE_MS);
}

function recentExerciseMinutes(
  mealTime: number,
  entries: readonly ExerciseEntry[] | undefined
): number | undefined {
  if (!entries) return undefined;
  const start = mealTime - RECENT_CONTEXT_HOURS * 60 * MINUTE_MS;
  const durations = entries
    .filter((entry) => {
      const timestamp = Date.parse(entry.startTime);
      return Number.isFinite(timestamp) && timestamp >= start && timestamp <= mealTime;
    })
    .map((entry) => entry.durationMinutes)
    .filter((duration) => Number.isFinite(duration) && duration >= 0);
  return durations.length > 0
    ? rounded(durations.reduce((sum, duration) => sum + duration, 0))
    : undefined;
}

function recentSleepHours(
  mealTime: number,
  entries: readonly SleepEntry[] | undefined
): number | undefined {
  if (!entries) return undefined;
  const start = mealTime - RECENT_CONTEXT_HOURS * 60 * MINUTE_MS;
  const latest = entries
    .filter((entry) => {
      const end = Date.parse(entry.endTime);
      return Number.isFinite(end) && end >= start && end <= mealTime;
    })
    .sort((first, second) => Date.parse(first.endTime) - Date.parse(second.endTime))
    .at(-1);
  if (!latest) return undefined;
  const durationMinutes = latest.durationMinutes ??
    (Date.parse(latest.endTime) - Date.parse(latest.startTime)) / MINUTE_MS;
  return Number.isFinite(durationMinutes) && durationMinutes >= 0
    ? rounded(durationMinutes / 60)
    : undefined;
}

function estimatedMealGrams(meal: MealEntry): number | undefined {
  const grams = meal.nutritionEstimate?.foods
    ?.map((food) => food.estimatedGrams)
    .filter((value): value is number => value !== undefined && Number.isFinite(value));
  return grams && grams.length > 0
    ? rounded(grams.reduce((sum, value) => sum + value, 0))
    : undefined;
}

export function generateMealPredictionFeatures(
  meal: MealEntry,
  response: MealGlucoseResponse,
  readings: readonly GlucoseReading[],
  meals: readonly MealEntry[],
  context: MealFeatureContext = {}
): GeneratedMealPredictionFeatures {
  const mealTime = Date.parse(meal.timestamp);
  if (!Number.isFinite(mealTime)) {
    throw new MealFeatureGenerationError('Meal timestamp must be valid.');
  }
  const recent = recentGlucoseReadings(mealTime, readings);
  const localTime = localMealTime(mealTime, meal.timezoneOffsetMinutes);
  const nutrition = meal.nutritionEstimate;

  const features: MealPredictionFeatures = compact({
    carbohydratesGrams:
      finiteOptional(nutrition?.carbohydratesGrams) ??
      finiteOptional(meal.estimatedCarbsGrams),
    proteinGrams:
      finiteOptional(nutrition?.proteinGrams) ?? finiteOptional(meal.proteinGrams),
    fatGrams: finiteOptional(nutrition?.fatGrams) ?? finiteOptional(meal.fatGrams),
    fiberGrams:
      finiteOptional(nutrition?.fiberGrams) ?? finiteOptional(meal.fiberGrams),
    calories: finiteOptional(nutrition?.calories),
    estimatedMealGrams: estimatedMealGrams(meal),
    baselineGlucoseMgDl: finiteOptional(response.baselineGlucoseMgDl),
    recentGlucoseSlopeMgDlPerMinute: recentSlope(recent),
    recentGlucoseMeanMgDl: mean(recent),
    recentGlucoseVariabilityMgDl: variability(recent),
    minutesSincePreviousMeal: minutesSincePreviousMeal(meal, meals, mealTime),
    ...localTime,
    recentExerciseMinutes:
      finiteOptional(context.recentExerciseMinutes) ??
      recentExerciseMinutes(mealTime, context.exerciseEntries),
    sleepDurationHours:
      finiteOptional(context.sleepDurationHours) ??
      recentSleepHours(mealTime, context.sleepEntries),
    historicalSimilarMealResponseMgDl: finiteOptional(
      context.historicalSimilarMealResponseMgDl
    ),
  });

  return {
    featureVersion: MEAL_FEATURE_VERSION,
    mealId: meal.id,
    mealTimestamp: new Date(mealTime).toISOString(),
    features,
  };
}
