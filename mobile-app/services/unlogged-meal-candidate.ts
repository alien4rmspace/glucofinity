import type { GlucoseReading, MealEntry } from '@/types/health';

const MINUTE_MS = 60_000;

export const UNLOGGED_MEAL_CANDIDATE_CONFIG = {
  minimumRiseMgDl: 30,
  minimumRiseMinutes: 20,
  maximumRiseMinutes: 120,
  minimumSampleCount: 4,
  maximumGapMinutes: 20,
  mealLookbackMinutes: 120,
  mealGraceAfterRiseMinutes: 15,
} as const;

export interface UnloggedMealCandidate {
  id: string;
  startedAt: string;
  endedAt: string;
  suggestedMealTimestamp: string;
  observedRiseMgDl: number;
  durationMinutes: number;
  sampleCount: number;
}

interface TimedReading {
  reading: GlucoseReading;
  timestamp: number;
}

function hasNearbyMeal(
  meals: readonly MealEntry[],
  startTime: number,
  endTime: number
): boolean {
  const coverageStart =
    startTime - UNLOGGED_MEAL_CANDIDATE_CONFIG.mealLookbackMinutes * MINUTE_MS;
  const coverageEnd =
    endTime + UNLOGGED_MEAL_CANDIDATE_CONFIG.mealGraceAfterRiseMinutes * MINUTE_MS;

  return meals.some((meal) => {
    const mealTime = Date.parse(meal.timestamp);
    return Number.isFinite(mealTime) && mealTime >= coverageStart && mealTime <= coverageEnd;
  });
}

export function findUnloggedMealCandidate(
  readings: readonly GlucoseReading[],
  meals: readonly MealEntry[]
): UnloggedMealCandidate | null {
  const timedReadings = readings
    .map<TimedReading | null>((reading) => {
      const timestamp = Date.parse(reading.timestamp);
      return Number.isFinite(timestamp) ? { reading, timestamp } : null;
    })
    .filter((item): item is TimedReading => item !== null)
    .sort((first, second) => first.timestamp - second.timestamp);
  let best: UnloggedMealCandidate | null = null;

  for (let startIndex = 0; startIndex < timedReadings.length - 1; startIndex += 1) {
    const start = timedReadings[startIndex];
    let segmentHasLargeGap = false;

    for (let endIndex = startIndex + 1; endIndex < timedReadings.length; endIndex += 1) {
      const end = timedReadings[endIndex];
      const previous = timedReadings[endIndex - 1];
      const gapMinutes = (end.timestamp - previous.timestamp) / MINUTE_MS;
      if (gapMinutes > UNLOGGED_MEAL_CANDIDATE_CONFIG.maximumGapMinutes) {
        segmentHasLargeGap = true;
      }

      const durationMinutes = (end.timestamp - start.timestamp) / MINUTE_MS;
      if (durationMinutes > UNLOGGED_MEAL_CANDIDATE_CONFIG.maximumRiseMinutes) break;
      if (
        durationMinutes < UNLOGGED_MEAL_CANDIDATE_CONFIG.minimumRiseMinutes ||
        endIndex - startIndex + 1 < UNLOGGED_MEAL_CANDIDATE_CONFIG.minimumSampleCount ||
        segmentHasLargeGap
      ) {
        continue;
      }

      const observedRiseMgDl = end.reading.valueMgDl - start.reading.valueMgDl;
      if (observedRiseMgDl < UNLOGGED_MEAL_CANDIDATE_CONFIG.minimumRiseMgDl) continue;
      if (hasNearbyMeal(meals, start.timestamp, end.timestamp)) continue;

      const candidate: UnloggedMealCandidate = {
        id: `${start.reading.id}:${end.reading.id}`,
        startedAt: start.reading.timestamp,
        endedAt: end.reading.timestamp,
        suggestedMealTimestamp: start.reading.timestamp,
        observedRiseMgDl,
        durationMinutes,
        sampleCount: endIndex - startIndex + 1,
      };

      if (
        !best ||
        candidate.observedRiseMgDl > best.observedRiseMgDl ||
        (candidate.observedRiseMgDl === best.observedRiseMgDl &&
          Date.parse(candidate.endedAt) > Date.parse(best.endedAt))
      ) {
        best = candidate;
      }
    }
  }

  return best;
}
