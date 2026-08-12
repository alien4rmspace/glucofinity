import { exerciseContextFixture } from "@/data/ai-demo-data";
import type {
  GeneratedMealPredictionFeatures,
  GlucoseInsight,
  InsightEvidence,
  MealPredictionFeatures,
} from "@/types/ai";
import type { DemoMeal } from "@/types/demo";
import type { DemoGlucoseReading, MealGlucoseResponse } from "@/types/glucose";

const MINUTE_MS = 60_000;
export const FEATURE_VERSION = "meal-prediction-features-v1";

function rounded(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}

function recentReadings(
  mealTime: number,
  readings: readonly DemoGlucoseReading[],
): DemoGlucoseReading[] {
  const start = mealTime - 30 * MINUTE_MS;
  return readings
    .filter((reading) => {
      const timestamp = Date.parse(reading.timestamp);
      return timestamp >= start && timestamp <= mealTime;
    })
    .sort((first, second) => Date.parse(first.timestamp) - Date.parse(second.timestamp));
}

function mean(readings: readonly DemoGlucoseReading[]): number | undefined {
  if (readings.length === 0) return undefined;
  return rounded(
    readings.reduce((sum, reading) => sum + reading.valueMgDl, 0) / readings.length,
  );
}

function variability(readings: readonly DemoGlucoseReading[]): number | undefined {
  const average = mean(readings);
  if (average === undefined || readings.length < 2) return undefined;
  const variance = readings.reduce(
    (sum, reading) => sum + (reading.valueMgDl - average) ** 2,
    0,
  ) / readings.length;
  return rounded(Math.sqrt(variance));
}

function slope(readings: readonly DemoGlucoseReading[]): number | undefined {
  const latest = readings.at(-1);
  const previous = readings.at(-2);
  if (!latest || !previous) return undefined;
  const elapsed = (Date.parse(latest.timestamp) - Date.parse(previous.timestamp)) / MINUTE_MS;
  if (elapsed <= 0 || elapsed > 20) return undefined;
  return rounded((latest.valueMgDl - previous.valueMgDl) / elapsed);
}

function minutesSincePreviousMeal(
  meal: DemoMeal,
  meals: readonly DemoMeal[],
): number | undefined {
  const mealTime = Date.parse(meal.timestamp);
  const previous = meals
    .filter((candidate) => candidate.id !== meal.id && Date.parse(candidate.timestamp) < mealTime)
    .sort((first, second) => Date.parse(first.timestamp) - Date.parse(second.timestamp))
    .at(-1);
  return previous
    ? rounded((mealTime - Date.parse(previous.timestamp)) / MINUTE_MS)
    : undefined;
}

export function generateMealPredictionFeatures(
  meal: DemoMeal,
  response: MealGlucoseResponse,
  readings: readonly DemoGlucoseReading[],
  meals: readonly DemoMeal[],
): GeneratedMealPredictionFeatures {
  const mealTime = Date.parse(meal.timestamp);
  if (!Number.isFinite(mealTime)) throw new Error("Meal timestamp must be valid.");
  const recent = recentReadings(mealTime, readings);
  const date = new Date(mealTime);
  const features: MealPredictionFeatures = compact({
    carbohydratesGrams: meal.carbohydrates,
    proteinGrams: meal.protein,
    fatGrams: meal.fat,
    fiberGrams: meal.fiber,
    calories: meal.calories,
    baselineGlucoseMgDl: response.baselineGlucoseMgDl,
    recentGlucoseSlopeMgDlPerMinute: slope(recent),
    recentGlucoseMeanMgDl: mean(recent),
    recentGlucoseVariabilityMgDl: variability(recent),
    minutesSincePreviousMeal: minutesSincePreviousMeal(meal, meals),
    hourOfDay: rounded(date.getUTCHours() + date.getUTCMinutes() / 60),
    dayOfWeek: date.getUTCDay(),
  });
  return { featureVersion: FEATURE_VERSION, mealId: meal.id, features };
}

export function isEligibleTrainingResponse(response: MealGlucoseResponse): boolean {
  return response.dataQuality === "good"
    && [
      response.glucoseRiseMgDl,
      response.peakGlucoseMgDl,
      response.timeToPeakMinutes,
      response.glucoseAt120MinutesMgDl,
      response.incrementalAuc,
    ].some((value) => value !== undefined);
}

export type GroupedObservation = { occurredAt: string; value: number };

export function compareObservationGroups({
  firstLabel,
  first,
  secondLabel,
  second,
  unit,
}: {
  firstLabel: string;
  first: readonly GroupedObservation[];
  secondLabel: string;
  second: readonly GroupedObservation[];
  unit: string;
}): InsightEvidence | null {
  const valid = (items: readonly GroupedObservation[]) => items.filter(
    (item) => Number.isFinite(item.value) && Number.isFinite(Date.parse(item.occurredAt)),
  );
  const firstValid = valid(first);
  const secondValid = valid(second);
  if (firstValid.length < 3 || secondValid.length < 3) return null;
  const average = (items: readonly GroupedObservation[]) => rounded(
    items.reduce((sum, item) => sum + item.value, 0) / items.length,
    1,
  );
  const firstMean = average(firstValid);
  const secondMean = average(secondValid);
  const timestamps = [...firstValid, ...secondValid]
    .map((item) => Date.parse(item.occurredAt))
    .sort((left, right) => left - right);
  return {
    sampleSize: firstValid.length + secondValid.length,
    sampleUnit: "observations",
    dateRange: {
      start: new Date(timestamps[0]).toISOString(),
      end: new Date(timestamps.at(-1)!).toISOString(),
    },
    metricDifference: rounded(firstMean - secondMean, 1),
    comparisonGroups: [
      { label: firstLabel, sampleSize: firstValid.length, meanValue: firstMean, unit },
      { label: secondLabel, sampleSize: secondValid.length, meanValue: secondMean, unit },
    ],
  };
}

export function buildEvidenceBackedInsights(
  meals: readonly DemoMeal[],
  responses: readonly MealGlucoseResponse[],
  readings: readonly DemoGlucoseReading[],
): GlucoseInsight[] {
  const generatedAt = readings.at(-1)?.timestamp ?? "2026-08-11T00:00:00.000Z";
  const observed = responses.filter(
    (response) => response.dataQuality !== "insufficient" && response.glucoseRiseMgDl !== undefined,
  );
  const insights: GlucoseInsight[] = [];
  const largest = [...observed].sort(
    (first, second) => (second.glucoseRiseMgDl ?? 0) - (first.glucoseRiseMgDl ?? 0),
  )[0];
  const largestMeal = largest ? meals.find((meal) => meal.id === largest.mealId) : undefined;
  if (largest && largestMeal && largest.glucoseRiseMgDl !== undefined) {
    insights.push({
      id: "largest-meal-rise",
      title: "Largest observed meal-window rise",
      description: `${largestMeal.name} was associated with the largest calculated rise in the displayed fictional meal windows, approximately ${Math.round(largest.glucoseRiseMgDl)} mg/dL.`,
      evidence: {
        sampleSize: largest.sampleCount,
        sampleUnit: "readings",
        metrics: [{ label: "Observed rise", value: largest.glucoseRiseMgDl, unit: "mg/dL" }],
      },
      generatedAt,
    });
  }
  if (observed.length > 1) {
    const rises = observed.map((response) => response.glucoseRiseMgDl!);
    insights.push({
      id: "meal-response-spread",
      title: "Different fictional meals had different observed responses",
      description: `Calculated rises ranged from ${Math.round(Math.min(...rises))} to ${Math.round(Math.max(...rises))} mg/dL across meal windows with usable coverage. This describes variation and does not identify its cause.`,
      evidence: {
        sampleSize: observed.length,
        sampleUnit: "meals",
        metrics: [
          { label: "Lowest observed rise", value: Math.min(...rises), unit: "mg/dL" },
          { label: "Highest observed rise", value: Math.max(...rises), unit: "mg/dL" },
        ],
      },
      generatedAt,
    });
  }
  const comparison = compareObservationGroups({
    firstLabel: "Meals with recent exercise",
    first: exerciseContextFixture.withRecentExercise,
    secondLabel: "Comparison meals without recent exercise",
    second: exerciseContextFixture.withoutRecentExercise,
    unit: "mg/dL rise",
  });
  if (comparison) {
    const difference = Math.abs(comparison.metricDifference ?? 0);
    insights.push({
      id: "exercise-context-fixture",
      title: "Exercise-context comparison fixture",
      description: `In this additional fictional fixture, meals logged after recent exercise were associated with an average observed rise ${difference} mg/dL lower than the comparison group. This does not establish causation.`,
      evidence: comparison,
      generatedAt,
    });
  }
  return insights;
}
