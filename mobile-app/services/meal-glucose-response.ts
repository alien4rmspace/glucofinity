import type {
  GlucoseReading,
  MealEntry,
  MealGlucoseResponse,
} from '@/types/health';

const MINUTE_MS = 60_000;

export interface MealResponseAnalysisConfig {
  preMealWindowMinutes: number;
  postMealWindowMinutes: number;
  baselineMinimumSamples: number;
  baselineMaximumAgeMinutes: number;
  pointToleranceMinutes: number;
  returnToBaselineToleranceMgDl: number;
  returnSearchStartMinutes: number;
  maximumIntegrationGapMinutes: number;
  goodQualityMinimumPostSamples: number;
  goodQualityMinimumCoverageMinutes: number;
  goodQualityMaximumGapMinutes: number;
}

export const DEFAULT_MEAL_RESPONSE_CONFIG: Readonly<MealResponseAnalysisConfig> = {
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
};

export interface MealAnalysisWindow {
  startDate: Date;
  endDate: Date;
}

function toMinutes(milliseconds: number): number {
  return milliseconds / MINUTE_MS;
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

function prepareReadings(readings: readonly GlucoseReading[]): GlucoseReading[] {
  const seenIds = new Set<string>();
  return readings
    .filter((reading) => {
      if (!reading.id || seenIds.has(reading.id)) return false;
      const timestampMs = Date.parse(reading.timestamp);
      if (
        !Number.isFinite(timestampMs) ||
        !Number.isFinite(reading.valueMgDl) ||
        reading.valueMgDl <= 0
      ) {
        return false;
      }
      seenIds.add(reading.id);
      return true;
    })
    .sort((first, second) => Date.parse(first.timestamp) - Date.parse(second.timestamp));
}

function readingNearestTarget(
  readings: readonly GlucoseReading[],
  targetTime: number,
  toleranceMinutes: number
): GlucoseReading | undefined {
  const toleranceMs = toleranceMinutes * MINUTE_MS;
  return readings.reduce<GlucoseReading | undefined>((nearest, reading) => {
    const distance = Math.abs(Date.parse(reading.timestamp) - targetTime);
    if (distance > toleranceMs) return nearest;
    if (!nearest) return reading;

    const nearestDistance = Math.abs(Date.parse(nearest.timestamp) - targetTime);
    if (distance < nearestDistance) return reading;
    if (distance === nearestDistance && reading.timestamp < nearest.timestamp) return reading;
    return nearest;
  }, undefined);
}

function largestGapMinutes(
  readings: readonly GlucoseReading[],
  startTime: number
): number {
  let previousTime = startTime;
  let largestGap = 0;
  readings.forEach((reading) => {
    const currentTime = Date.parse(reading.timestamp);
    largestGap = Math.max(largestGap, toMinutes(currentTime - previousTime));
    previousTime = currentTime;
  });
  return largestGap;
}

function positiveTrapezoidArea(
  firstValueAboveBaseline: number,
  secondValueAboveBaseline: number,
  elapsedMinutes: number
): number {
  if (firstValueAboveBaseline <= 0 && secondValueAboveBaseline <= 0) return 0;
  if (firstValueAboveBaseline >= 0 && secondValueAboveBaseline >= 0) {
    return ((firstValueAboveBaseline + secondValueAboveBaseline) / 2) * elapsedMinutes;
  }

  if (firstValueAboveBaseline > 0) {
    const positiveDuration =
      elapsedMinutes *
      (firstValueAboveBaseline /
        (firstValueAboveBaseline - secondValueAboveBaseline));
    return (firstValueAboveBaseline * positiveDuration) / 2;
  }

  const positiveDuration =
    elapsedMinutes *
    (secondValueAboveBaseline /
      (secondValueAboveBaseline - firstValueAboveBaseline));
  return (secondValueAboveBaseline * positiveDuration) / 2;
}

function incrementalAuc(
  readings: readonly GlucoseReading[],
  mealTime: number,
  baselineMgDl: number,
  maximumGapMinutes: number
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
  let integratedIntervals = 0;

  for (let index = 1; index < points.length; index += 1) {
    const first = points[index - 1];
    const second = points[index];
    const elapsedMinutes = toMinutes(second.timestamp - first.timestamp);
    if (elapsedMinutes <= 0 || elapsedMinutes > maximumGapMinutes) continue;

    area += positiveTrapezoidArea(
      first.valueMgDl - baselineMgDl,
      second.valueMgDl - baselineMgDl,
      elapsedMinutes
    );
    integratedIntervals += 1;
  }

  return integratedIntervals > 0 ? rounded(area) : undefined;
}

export function getMealAnalysisWindow(
  mealTimestamp: string,
  config: MealResponseAnalysisConfig = DEFAULT_MEAL_RESPONSE_CONFIG
): MealAnalysisWindow | null {
  const mealTime = Date.parse(mealTimestamp);
  if (!Number.isFinite(mealTime)) return null;
  return {
    startDate: new Date(mealTime - config.preMealWindowMinutes * MINUTE_MS),
    endDate: new Date(mealTime + config.postMealWindowMinutes * MINUTE_MS),
  };
}

export function analyzeMealResponse(
  meal: MealEntry,
  readings: readonly GlucoseReading[],
  config: MealResponseAnalysisConfig = DEFAULT_MEAL_RESPONSE_CONFIG
): MealGlucoseResponse {
  const mealTime = Date.parse(meal.timestamp);
  const emptyResult: MealGlucoseResponse = {
    mealId: meal.id,
    sampleCount: 0,
    dataQuality: 'insufficient',
  };
  if (!Number.isFinite(mealTime)) return emptyResult;

  const validReadings = prepareReadings(readings);
  const windowStart = mealTime - config.preMealWindowMinutes * MINUTE_MS;
  const windowEnd = mealTime + config.postMealWindowMinutes * MINUTE_MS;
  const windowReadings = validReadings.filter((reading) => {
    const timestamp = Date.parse(reading.timestamp);
    return timestamp >= windowStart && timestamp <= windowEnd;
  });
  const baselineReadings = windowReadings.filter((reading) => {
    const timestamp = Date.parse(reading.timestamp);
    return timestamp >= windowStart && timestamp <= mealTime;
  });
  const postMealReadings = windowReadings.filter((reading) => {
    const timestamp = Date.parse(reading.timestamp);
    return timestamp >= mealTime && timestamp <= windowEnd;
  });

  const latestBaseline = baselineReadings.at(-1);
  const baselineIsRecent =
    latestBaseline !== undefined &&
    toMinutes(mealTime - Date.parse(latestBaseline.timestamp)) <=
      config.baselineMaximumAgeMinutes;
  const hasBaseline =
    baselineReadings.length >= config.baselineMinimumSamples && baselineIsRecent;
  const baselineGlucoseMgDl = hasBaseline
    ? baselineReadings.reduce((sum, reading) => sum + reading.valueMgDl, 0) /
      baselineReadings.length
    : undefined;

  const peak = postMealReadings.reduce<GlucoseReading | undefined>(
    (highest, reading) =>
      !highest || reading.valueMgDl > highest.valueMgDl ? reading : highest,
    undefined
  );
  const at60 = readingNearestTarget(
    postMealReadings,
    mealTime + 60 * MINUTE_MS,
    config.pointToleranceMinutes
  );
  const at120 = readingNearestTarget(
    postMealReadings,
    mealTime + 120 * MINUTE_MS,
    config.pointToleranceMinutes
  );

  const coverageMinutes = postMealReadings.length
    ? toMinutes(Date.parse(postMealReadings.at(-1)!.timestamp) - mealTime)
    : 0;
  const goodQuality =
    hasBaseline &&
    postMealReadings.length >= config.goodQualityMinimumPostSamples &&
    coverageMinutes >= config.goodQualityMinimumCoverageMinutes &&
    at60 !== undefined &&
    at120 !== undefined &&
    largestGapMinutes(postMealReadings, mealTime) <= config.goodQualityMaximumGapMinutes;
  const dataQuality: MealGlucoseResponse['dataQuality'] =
    windowReadings.length === 0 || postMealReadings.length < 2
      ? 'insufficient'
      : goodQuality
        ? 'good'
        : 'limited';

  let returnToBaselineMinutes: number | undefined;
  if (
    baselineGlucoseMgDl !== undefined &&
    peak &&
    peak.valueMgDl > baselineGlucoseMgDl + config.returnToBaselineToleranceMgDl
  ) {
    const peakTime = Date.parse(peak.timestamp);
    const returned = postMealReadings.find((reading) => {
      const timestamp = Date.parse(reading.timestamp);
      return (
        timestamp > peakTime &&
        toMinutes(timestamp - mealTime) >= config.returnSearchStartMinutes &&
        Math.abs(reading.valueMgDl - baselineGlucoseMgDl) <=
          config.returnToBaselineToleranceMgDl
      );
    });
    if (returned) {
      returnToBaselineMinutes = rounded(
        toMinutes(Date.parse(returned.timestamp) - mealTime)
      );
    }
  }

  const result: MealGlucoseResponse = {
    mealId: meal.id,
    sampleCount: windowReadings.length,
    dataQuality,
    ...(baselineGlucoseMgDl !== undefined
      ? { baselineGlucoseMgDl: rounded(baselineGlucoseMgDl) }
      : {}),
    ...(peak
      ? {
          peakGlucoseMgDl: peak.valueMgDl,
          timeToPeakMinutes: rounded(toMinutes(Date.parse(peak.timestamp) - mealTime)),
        }
      : {}),
    ...(baselineGlucoseMgDl !== undefined && peak
      ? { glucoseRiseMgDl: rounded(peak.valueMgDl - baselineGlucoseMgDl) }
      : {}),
    ...(at60 ? { glucoseAt60MinutesMgDl: at60.valueMgDl } : {}),
    ...(at120 ? { glucoseAt120MinutesMgDl: at120.valueMgDl } : {}),
    ...(baselineGlucoseMgDl !== undefined
      ? {
          incrementalAuc: incrementalAuc(
            postMealReadings,
            mealTime,
            baselineGlucoseMgDl,
            config.maximumIntegrationGapMinutes
          ),
        }
      : {}),
    ...(returnToBaselineMinutes !== undefined ? { returnToBaselineMinutes } : {}),
  };

  if (result.incrementalAuc === undefined) delete result.incrementalAuc;
  return result;
}

export function analyzeMealResponses(
  meals: readonly MealEntry[],
  readings: readonly GlucoseReading[],
  config: MealResponseAnalysisConfig = DEFAULT_MEAL_RESPONSE_CONFIG
): MealGlucoseResponse[] {
  return meals.map((meal) => analyzeMealResponse(meal, readings, config));
}
