import type { DemoMeal } from "@/types/demo";
import type { DemoGlucoseReading, MealGlucoseResponse } from "@/types/glucose";

const MINUTE_MS = 60_000;

export const mealResponseConfig = {
  preMealWindowMinutes: 30,
  postMealWindowMinutes: 180,
  baselineMinimumSamples: 2,
  baselineMaximumAgeMinutes: 15,
  pointToleranceMinutes: 15,
  returnToBaselineToleranceMgDl: 5,
  returnSearchStartMinutes: 30,
  maximumIntegrationGapMinutes: 20,
  goodQualityMinimumPostSamples: 12,
  goodQualityMinimumCoverageMinutes: 120,
  goodQualityMaximumGapMinutes: 20,
} as const;

function minutes(milliseconds: number): number {
  return milliseconds / MINUTE_MS;
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

function validReadings(readings: readonly DemoGlucoseReading[]): DemoGlucoseReading[] {
  const seenIds = new Set<string>();
  return readings
    .filter((reading) => {
      if (!reading.id || seenIds.has(reading.id)) return false;
      const timestamp = Date.parse(reading.timestamp);
      if (!Number.isFinite(timestamp) || !Number.isFinite(reading.valueMgDl) || reading.valueMgDl <= 0) {
        return false;
      }
      seenIds.add(reading.id);
      return true;
    })
    .sort((first, second) => Date.parse(first.timestamp) - Date.parse(second.timestamp));
}

export function getMealResponseReadings(
  mealTimestamp: string,
  readings: readonly DemoGlucoseReading[],
): DemoGlucoseReading[] {
  const mealTime = Date.parse(mealTimestamp);
  if (!Number.isFinite(mealTime)) return [];
  const start = mealTime - mealResponseConfig.preMealWindowMinutes * MINUTE_MS;
  const end = mealTime + mealResponseConfig.postMealWindowMinutes * MINUTE_MS;
  return validReadings(readings).filter((reading) => {
    const timestamp = Date.parse(reading.timestamp);
    return timestamp >= start && timestamp <= end;
  });
}

function nearestReading(
  readings: readonly DemoGlucoseReading[],
  targetTime: number,
): DemoGlucoseReading | undefined {
  const toleranceMs = mealResponseConfig.pointToleranceMinutes * MINUTE_MS;
  return readings.reduce<DemoGlucoseReading | undefined>((nearest, reading) => {
    const distance = Math.abs(Date.parse(reading.timestamp) - targetTime);
    if (distance > toleranceMs) return nearest;
    if (!nearest) return reading;
    const nearestDistance = Math.abs(Date.parse(nearest.timestamp) - targetTime);
    return distance < nearestDistance ? reading : nearest;
  }, undefined);
}

function largestGapMinutes(readings: readonly DemoGlucoseReading[], startTime: number): number {
  let previousTime = startTime;
  return readings.reduce((largest, reading) => {
    const currentTime = Date.parse(reading.timestamp);
    const gap = minutes(currentTime - previousTime);
    previousTime = currentTime;
    return Math.max(largest, gap);
  }, 0);
}

function positiveTrapezoidArea(first: number, second: number, elapsedMinutes: number): number {
  if (first <= 0 && second <= 0) return 0;
  if (first >= 0 && second >= 0) return ((first + second) / 2) * elapsedMinutes;
  if (first > 0) {
    const positiveDuration = elapsedMinutes * (first / (first - second));
    return (first * positiveDuration) / 2;
  }
  const positiveDuration = elapsedMinutes * (second / (second - first));
  return (second * positiveDuration) / 2;
}

function incrementalAuc(
  readings: readonly DemoGlucoseReading[],
  mealTime: number,
  baselineMgDl: number,
): number | undefined {
  if (readings.length < 2) return undefined;
  const points = [
    { timestamp: mealTime, valueMgDl: baselineMgDl },
    ...readings.map((reading) => ({
      timestamp: Date.parse(reading.timestamp),
      valueMgDl: reading.valueMgDl,
    })),
  ];
  let area = 0;
  let intervals = 0;
  for (let index = 1; index < points.length; index += 1) {
    const first = points[index - 1];
    const second = points[index];
    const elapsed = minutes(second.timestamp - first.timestamp);
    if (elapsed <= 0 || elapsed > mealResponseConfig.maximumIntegrationGapMinutes) continue;
    area += positiveTrapezoidArea(
      first.valueMgDl - baselineMgDl,
      second.valueMgDl - baselineMgDl,
      elapsed,
    );
    intervals += 1;
  }
  return intervals > 0 ? rounded(area) : undefined;
}

export function analyzeMealResponse(
  meal: DemoMeal,
  readings: readonly DemoGlucoseReading[],
): MealGlucoseResponse {
  const mealTime = Date.parse(meal.timestamp);
  const empty: MealGlucoseResponse = {
    mealId: meal.id,
    sampleCount: 0,
    dataQuality: "insufficient",
  };
  if (!Number.isFinite(mealTime)) return empty;

  const windowReadings = getMealResponseReadings(meal.timestamp, readings);
  const baselineReadings = windowReadings.filter(
    (reading) => Date.parse(reading.timestamp) <= mealTime,
  );
  const postMealReadings = windowReadings.filter(
    (reading) => Date.parse(reading.timestamp) >= mealTime,
  );
  const latestBaseline = baselineReadings.at(-1);
  const baselineIsRecent = latestBaseline !== undefined
    && minutes(mealTime - Date.parse(latestBaseline.timestamp)) <= mealResponseConfig.baselineMaximumAgeMinutes;
  const hasBaseline = baselineReadings.length >= mealResponseConfig.baselineMinimumSamples && baselineIsRecent;
  const baseline = hasBaseline
    ? baselineReadings.reduce((sum, reading) => sum + reading.valueMgDl, 0) / baselineReadings.length
    : undefined;
  const peak = postMealReadings.reduce<DemoGlucoseReading | undefined>(
    (highest, reading) => !highest || reading.valueMgDl > highest.valueMgDl ? reading : highest,
    undefined,
  );
  const at60 = nearestReading(postMealReadings, mealTime + 60 * MINUTE_MS);
  const at120 = nearestReading(postMealReadings, mealTime + 120 * MINUTE_MS);
  const coverage = postMealReadings.length
    ? minutes(Date.parse(postMealReadings.at(-1)!.timestamp) - mealTime)
    : 0;
  const goodQuality = hasBaseline
    && postMealReadings.length >= mealResponseConfig.goodQualityMinimumPostSamples
    && coverage >= mealResponseConfig.goodQualityMinimumCoverageMinutes
    && at60 !== undefined
    && at120 !== undefined
    && largestGapMinutes(postMealReadings, mealTime) <= mealResponseConfig.goodQualityMaximumGapMinutes;
  const dataQuality: MealGlucoseResponse["dataQuality"] = postMealReadings.length < 2
    ? "insufficient"
    : goodQuality
      ? "good"
      : "limited";

  let returnToBaselineMinutes: number | undefined;
  if (baseline !== undefined && peak && peak.valueMgDl > baseline + mealResponseConfig.returnToBaselineToleranceMgDl) {
    const peakTime = Date.parse(peak.timestamp);
    const returned = postMealReadings.find((reading) => {
      const timestamp = Date.parse(reading.timestamp);
      return timestamp > peakTime
        && minutes(timestamp - mealTime) >= mealResponseConfig.returnSearchStartMinutes
        && Math.abs(reading.valueMgDl - baseline) <= mealResponseConfig.returnToBaselineToleranceMgDl;
    });
    if (returned) returnToBaselineMinutes = rounded(minutes(Date.parse(returned.timestamp) - mealTime));
  }
  const areaAboveBaseline = baseline !== undefined
    ? incrementalAuc(postMealReadings, mealTime, baseline)
    : undefined;

  return {
    mealId: meal.id,
    sampleCount: windowReadings.length,
    dataQuality,
    ...(baseline !== undefined ? { baselineGlucoseMgDl: rounded(baseline) } : {}),
    ...(peak ? {
      peakGlucoseMgDl: peak.valueMgDl,
      timeToPeakMinutes: rounded(minutes(Date.parse(peak.timestamp) - mealTime)),
    } : {}),
    ...(baseline !== undefined && peak ? { glucoseRiseMgDl: rounded(peak.valueMgDl - baseline) } : {}),
    ...(at60 ? { glucoseAt60MinutesMgDl: at60.valueMgDl } : {}),
    ...(at120 ? { glucoseAt120MinutesMgDl: at120.valueMgDl } : {}),
    ...(areaAboveBaseline !== undefined
      ? { incrementalAuc: areaAboveBaseline }
      : {}),
    ...(returnToBaselineMinutes !== undefined ? { returnToBaselineMinutes } : {}),
  };
}

export function analyzeMealResponses(
  meals: readonly DemoMeal[],
  readings: readonly DemoGlucoseReading[],
): MealGlucoseResponse[] {
  return meals.map((meal) => analyzeMealResponse(meal, readings));
}
