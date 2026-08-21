import type {
  FeelingCheckIn,
  FeelingRating,
  FeelingSensation,
  GlucoseReading,
} from '@/types/health';

export const FEELING_SENSATIONS: readonly {
  value: FeelingSensation;
  label: string;
}[] = [
  { value: 'tired', label: 'Tired' },
  { value: 'shaky', label: 'Shaky' },
  { value: 'lightheaded', label: 'Lightheaded' },
  { value: 'headache', label: 'Headache' },
  { value: 'thirsty', label: 'Thirsty' },
  { value: 'nauseated', label: 'Nauseated' },
  { value: 'difficulty-concentrating', label: 'Difficulty concentrating' },
  { value: 'other', label: 'Other' },
] as const;

const SENSATION_VALUES = new Set<FeelingSensation>(
  FEELING_SENSATIONS.map(({ value }) => value),
);

export interface FeelingGlucosePair {
  checkIn: FeelingCheckIn;
  nearestReading?: GlucoseReading;
  minutesFromReading?: number;
}

export function isFeelingRating(value: unknown): value is FeelingRating {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;
}

export function feelingRatingLabel(value: FeelingRating): string {
  const labels: Record<FeelingRating, string> = {
    1: 'Very difficult',
    2: 'Difficult',
    3: 'Okay',
    4: 'Good',
    5: 'Very good',
  };
  return labels[value];
}

export function feelingSensationLabel(value: FeelingSensation): string {
  return FEELING_SENSATIONS.find((candidate) => candidate.value === value)?.label ?? value;
}

export function sortFeelingCheckIns(
  entries: readonly FeelingCheckIn[],
): FeelingCheckIn[] {
  return [...entries].sort(
    (first, second) => Date.parse(second.timestamp) - Date.parse(first.timestamp),
  );
}

export function normalizeFeelingCheckIn(value: unknown): FeelingCheckIn | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.id !== 'string' || !value.id.trim()) return undefined;
  if (typeof value.timestamp !== 'string' || !Number.isFinite(Date.parse(value.timestamp))) {
    return undefined;
  }
  if (
    typeof value.timezoneOffsetMinutes !== 'number' ||
    !Number.isInteger(value.timezoneOffsetMinutes) ||
    value.timezoneOffsetMinutes < -840 ||
    value.timezoneOffsetMinutes > 840
  ) {
    return undefined;
  }
  if (!isFeelingRating(value.overallFeeling) || value.source !== 'manual') return undefined;

  const energy = value.energy;
  const stress = value.stress;
  const focus = value.focus;
  const hunger = value.hunger;
  if (energy !== undefined && !isFeelingRating(energy)) return undefined;
  if (stress !== undefined && !isFeelingRating(stress)) return undefined;
  if (focus !== undefined && !isFeelingRating(focus)) return undefined;
  if (hunger !== undefined && !isFeelingRating(hunger)) return undefined;
  if (!Array.isArray(value.sensations)) return undefined;
  const sensations = [...new Set(value.sensations)].filter(
    (candidate): candidate is FeelingSensation =>
      typeof candidate === 'string' && SENSATION_VALUES.has(candidate as FeelingSensation),
  );
  if (sensations.length !== value.sensations.length) return undefined;
  if (value.notes !== undefined && typeof value.notes !== 'string') return undefined;
  const notes = typeof value.notes === 'string' ? value.notes.trim() : '';
  if (notes.length > 500) return undefined;

  return {
    id: value.id.trim(),
    timestamp: new Date(value.timestamp).toISOString(),
    timezoneOffsetMinutes: value.timezoneOffsetMinutes,
    overallFeeling: value.overallFeeling,
    ...(energy === undefined ? {} : { energy }),
    ...(stress === undefined ? {} : { stress }),
    ...(focus === undefined ? {} : { focus }),
    ...(hunger === undefined ? {} : { hunger }),
    sensations,
    ...(notes ? { notes } : {}),
    source: 'manual',
  };
}

export function pairFeelingCheckInsWithGlucose(
  checkIns: readonly FeelingCheckIn[],
  readings: readonly GlucoseReading[],
  maximumDistanceMinutes = 15,
): FeelingGlucosePair[] {
  const maximumDistanceMs = Math.max(0, maximumDistanceMinutes) * 60_000;
  const validReadings = readings
    .map((reading) => ({ reading, timestamp: Date.parse(reading.timestamp) }))
    .filter(({ timestamp }) => Number.isFinite(timestamp));

  return checkIns.map((checkIn) => {
    const checkInTimestamp = Date.parse(checkIn.timestamp);
    const nearest = validReadings.reduce<
      { reading: GlucoseReading; distanceMs: number } | undefined
    >((current, candidate) => {
      const distanceMs = Math.abs(candidate.timestamp - checkInTimestamp);
      if (!current || distanceMs < current.distanceMs) {
        return { reading: candidate.reading, distanceMs };
      }
      return current;
    }, undefined);

    if (!nearest || nearest.distanceMs > maximumDistanceMs) return { checkIn };
    return {
      checkIn,
      nearestReading: nearest.reading,
      minutesFromReading: Math.round((nearest.distanceMs / 60_000) * 10) / 10,
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
