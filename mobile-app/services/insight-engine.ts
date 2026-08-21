import { analyzeMealResponses } from '@/services/meal-glucose-response';
import type { GlucoseReading, InsightObservation, MealEntry } from '@/types/health';
import {
  glucoseStandardDeviation,
  timeInRangePercentage,
} from '@/utils/glucose-metrics';

export interface InsightEngine {
  generate(
    readings: readonly GlucoseReading[],
    meals: readonly MealEntry[]
  ): InsightObservation[];
}

function readingDateRange(readings: readonly GlucoseReading[]) {
  const timestamps = readings
    .map((reading) => Date.parse(reading.timestamp))
    .filter(Number.isFinite)
    .sort((first, second) => first - second);
  if (timestamps.length === 0) return undefined;
  return {
    start: new Date(timestamps[0]).toISOString(),
    end: new Date(timestamps.at(-1)!).toISOString(),
  };
}

function readingsForHours(
  readings: readonly GlucoseReading[],
  startHour: number,
  endHour: number
): GlucoseReading[] {
  return readings.filter((reading) => {
    const hour = new Date(reading.timestamp).getUTCHours();
    return hour >= startHour && hour < endHour;
  });
}

export class RuleBasedInsightEngine implements InsightEngine {
  generate(
    readings: readonly GlucoseReading[],
    meals: readonly MealEntry[]
  ): InsightObservation[] {
    if (readings.length < 12) return [];
    const observations: InsightObservation[] = [];
    const generatedAt = readingDateRange(readings)?.end ?? new Date(0).toISOString();
    const responses = analyzeMealResponses(meals, readings).filter(
      (response) =>
        response.dataQuality !== 'insufficient' &&
        response.glucoseRiseMgDl !== undefined
    );
    const largestMealResponse = [...responses].sort(
      (first, second) =>
        (second.glucoseRiseMgDl ?? 0) - (first.glucoseRiseMgDl ?? 0)
    )[0];
    const largestMeal = largestMealResponse
      ? meals.find((meal) => meal.id === largestMealResponse.mealId)
      : undefined;

    if (
      largestMealResponse &&
      largestMeal &&
      (largestMealResponse.glucoseRiseMgDl ?? 0) > 0
    ) {
      observations.push({
        id: 'largest-meal-rise',
        type: 'meal',
        title: 'Largest meal-window rise',
        description: `${largestMeal.name} was associated with the largest observed meal-window rise today, approximately ${Math.round(largestMealResponse.glucoseRiseMgDl ?? 0)} mg/dL.`,
        evidence: {
          sampleSize: largestMealResponse.sampleCount,
          dateRange: {
            start: new Date(
              Date.parse(largestMeal.timestamp) - 30 * 60_000
            ).toISOString(),
            end: new Date(
              Date.parse(largestMeal.timestamp) + 180 * 60_000
            ).toISOString(),
          },
          metrics: [
            {
              label: 'Observed rise',
              value: Math.round(largestMealResponse.glucoseRiseMgDl ?? 0),
              unit: 'mg/dL',
            },
          ],
        },
        generatedAt,
      });
    }

    const periods = [
      { label: 'morning', readings: readingsForHours(readings, 6, 12) },
      { label: 'afternoon', readings: readingsForHours(readings, 12, 18) },
      { label: 'evening', readings: readingsForHours(readings, 18, 24) },
    ]
      .map((period) => ({
        ...period,
        variability: glucoseStandardDeviation(period.readings),
      }))
      .filter(
        (period): period is (typeof period) & { variability: number } =>
          period.variability !== null && period.readings.length >= 6
      )
      .sort((first, second) => first.variability - second.variability);

    if (periods[0]) {
      observations.push({
        id: 'stable-period',
        type: 'stability',
        title: 'More stable period',
        description: `Displayed glucose readings were more stable during the ${periods[0].label}. This is a descriptive pattern, not a medical conclusion.`,
        evidence: {
          sampleSize: periods[0].readings.length,
          dateRange: readingDateRange(periods[0].readings),
          metrics: [
            {
              label: 'Glucose variability',
              value: Math.round(periods[0].variability * 10) / 10,
              unit: 'mg/dL standard deviation',
            },
          ],
        },
        generatedAt,
      });
    }

    const timeInRange = timeInRangePercentage(readings, {
      lowMgDl: 70,
      highMgDl: 180,
    });
    if (timeInRange !== null) {
      observations.push({
        id: 'range-observation',
        type: 'range',
        title: 'Target-range context',
        description: `${Math.round(timeInRange)}% of the displayed readings were within the configured display range of 70–180 mg/dL.`,
        evidence: {
          sampleSize: readings.length,
          dateRange: readingDateRange(readings),
          metrics: [
            {
              label: 'Displayed time in range',
              value: Math.round(timeInRange),
              unit: '%',
            },
          ],
        },
        generatedAt,
      });
    }

    return observations;
  }
}

export const insightEngine: InsightEngine = new RuleBasedInsightEngine();
