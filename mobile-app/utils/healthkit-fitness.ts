import type { DailyFitnessSummary, ExerciseEntry } from '@/types/health';

export interface HealthKitQuantityStatistics {
  sumQuantity?: {
    quantity: number;
    unit: string;
  };
}

export interface HealthKitWorkoutSample {
  uuid?: string;
  startDate: Date | string;
  endDate: Date | string;
  duration?: {
    quantity: number;
    unit: string;
  };
  workoutActivityType: number;
  sourceRevision?: {
    source?: {
      bundleIdentifier?: string;
      name?: string;
    };
  };
}

const workoutLabels: Readonly<Record<number, string>> = {
  1: 'American football',
  2: 'Archery',
  3: 'Australian football',
  4: 'Badminton',
  5: 'Baseball',
  6: 'Basketball',
  7: 'Bowling',
  8: 'Boxing',
  9: 'Climbing',
  10: 'Cricket',
  11: 'Cross training',
  12: 'Curling',
  13: 'Cycling',
  14: 'Dance',
  15: 'Dance-inspired training',
  16: 'Elliptical',
  17: 'Equestrian sports',
  18: 'Fencing',
  19: 'Fishing',
  20: 'Functional strength training',
  21: 'Golf',
  22: 'Gymnastics',
  23: 'Handball',
  24: 'Hiking',
  25: 'Hockey',
  26: 'Hunting',
  27: 'Lacrosse',
  28: 'Martial arts',
  29: 'Mind and body',
  30: 'Mixed metabolic cardio training',
  31: 'Paddle sports',
  32: 'Play',
  33: 'Preparation and recovery',
  34: 'Racquetball',
  35: 'Rowing',
  36: 'Rugby',
  37: 'Running',
  38: 'Sailing',
  39: 'Skating sports',
  40: 'Snow sports',
  41: 'Soccer',
  42: 'Softball',
  43: 'Squash',
  44: 'Stair climbing',
  45: 'Surfing sports',
  46: 'Swimming',
  47: 'Table tennis',
  48: 'Tennis',
  49: 'Track and field',
  50: 'Traditional strength training',
  51: 'Volleyball',
  52: 'Walking',
  53: 'Water fitness',
  54: 'Water polo',
  55: 'Water sports',
  56: 'Wrestling',
  57: 'Yoga',
  58: 'Barre',
  59: 'Core training',
  60: 'Cross-country skiing',
  61: 'Downhill skiing',
  62: 'Flexibility',
  63: 'High-intensity interval training',
  64: 'Jump rope',
  65: 'Kickboxing',
  66: 'Pilates',
  67: 'Snowboarding',
  68: 'Stairs',
  69: 'Step training',
  70: 'Wheelchair walk pace',
  71: 'Wheelchair run pace',
  72: 'Tai chi',
  73: 'Mixed cardio',
  74: 'Hand cycling',
  75: 'Disc sports',
  76: 'Fitness gaming',
  77: 'Cardio dance',
  78: 'Social dance',
  79: 'Pickleball',
  80: 'Cooldown',
  82: 'Swim-bike-run',
  83: 'Transition',
  84: 'Underwater diving',
  3000: 'Other workout',
};

function rounded(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function finiteDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function statisticValue(
  statistics: HealthKitQuantityStatistics,
  expectedUnit: string,
  digits: number
): number | undefined {
  const quantity = statistics.sumQuantity;
  if (
    !quantity ||
    quantity.unit !== expectedUnit ||
    !Number.isFinite(quantity.quantity) ||
    quantity.quantity < 0
  ) {
    return undefined;
  }
  return rounded(quantity.quantity, digits);
}

function durationInMinutes(
  duration: HealthKitWorkoutSample['duration'],
  startDate: Date,
  endDate: Date
): number | null {
  if (duration && Number.isFinite(duration.quantity) && duration.quantity >= 0) {
    if (duration.unit === 's') return rounded(duration.quantity / 60);
    if (duration.unit === 'min') return rounded(duration.quantity);
    if (duration.unit === 'hr') return rounded(duration.quantity * 60);
  }

  const derivedMinutes = (endDate.getTime() - startDate.getTime()) / 60_000;
  return Number.isFinite(derivedMinutes) && derivedMinutes >= 0
    ? rounded(derivedMinutes)
    : null;
}

export function workoutActivityLabel(activityType: number): string {
  return workoutLabels[activityType] ?? 'Workout';
}

export function mapHealthKitWorkoutSamples(
  samples: readonly HealthKitWorkoutSample[],
  rangeStart: Date,
  rangeEnd: Date
): ExerciseEntry[] {
  const startBoundary = rangeStart.getTime();
  const endBoundary = rangeEnd.getTime();
  if (!Number.isFinite(startBoundary) || !Number.isFinite(endBoundary)) return [];

  const seenIds = new Set<string>();
  const workouts: ExerciseEntry[] = [];

  for (const sample of samples) {
    const sourceRecordId = sample.uuid?.trim();
    const startDate = finiteDate(sample.startDate);
    const endDate = finiteDate(sample.endDate);
    if (!sourceRecordId || seenIds.has(sourceRecordId) || !startDate || !endDate) {
      continue;
    }
    if (
      startDate.getTime() < startBoundary ||
      endDate.getTime() > endBoundary ||
      endDate.getTime() < startDate.getTime()
    ) {
      continue;
    }

    const durationMinutes = durationInMinutes(sample.duration, startDate, endDate);
    if (durationMinutes === null) continue;

    const source = sample.sourceRevision?.source;
    seenIds.add(sourceRecordId);
    workouts.push({
      id: `healthkit-workout:${sourceRecordId}`,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      durationMinutes,
      activityType: workoutActivityLabel(sample.workoutActivityType),
      source: 'healthkit',
      sourceRecordId,
      sourceName: source?.name ?? source?.bundleIdentifier,
    });
  }

  return workouts.sort(
    (first, second) => Date.parse(first.startTime) - Date.parse(second.startTime)
  );
}

export function createHealthKitDailyFitnessSummary(
  startDate: Date,
  endDate: Date,
  stepStatistics: HealthKitQuantityStatistics,
  activeEnergyStatistics: HealthKitQuantityStatistics,
  workoutSamples: readonly HealthKitWorkoutSample[]
): DailyFitnessSummary {
  return {
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
    stepCount: statisticValue(stepStatistics, 'count', 0),
    activeEnergyKilocalories: statisticValue(
      activeEnergyStatistics,
      'kcal',
      1
    ),
    workouts: mapHealthKitWorkoutSamples(workoutSamples, startDate, endDate),
    source: 'healthkit',
  };
}
