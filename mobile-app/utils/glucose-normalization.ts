import type {
  GlucoseReading,
  GlucoseReadingSource,
  GlucoseTrend,
} from '@/types/health';

const MG_DL_PER_MMOL_L = 18.015588;
const MINUTE_MS = 60_000;
const MAX_TREND_GAP_MINUTES = 20;

export interface RawGlucoseReading {
  timestamp: string | Date;
  value: number;
  unit: string;
  source: GlucoseReadingSource;
  sourceRecordId?: string;
  deviceName?: string;
}

interface NormalizedReadingWithoutTrend
  extends Omit<GlucoseReading, 'trend'> {}

function cleanOptionalMetadata(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function stableReadingId(reading: {
  timestamp: string;
  valueMgDl: number;
  source: GlucoseReadingSource;
  sourceRecordId?: string;
  deviceName?: string;
}): string {
  if (reading.sourceRecordId) {
    return `${reading.source}:${reading.sourceRecordId}`;
  }

  return [
    reading.source,
    reading.timestamp,
    reading.valueMgDl,
    reading.deviceName ?? 'unknown',
  ].join(':');
}

export function convertGlucoseToMgDl(value: number, unit: string): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;

  const normalizedUnit = unit.trim().toLowerCase().replaceAll(' ', '');
  if (normalizedUnit === 'mg/dl' || normalizedUnit.includes('mg/dl')) {
    return value;
  }
  if (normalizedUnit === 'mmol/l' || normalizedUnit.includes('mmol')) {
    return value * MG_DL_PER_MMOL_L;
  }
  return null;
}

function inferDisplayTrend(
  previous: NormalizedReadingWithoutTrend | undefined,
  current: NormalizedReadingWithoutTrend
): GlucoseTrend {
  if (!previous) return 'steady';

  const elapsedMinutes =
    (Date.parse(current.timestamp) - Date.parse(previous.timestamp)) / MINUTE_MS;
  if (elapsedMinutes <= 0 || elapsedMinutes > MAX_TREND_GAP_MINUTES) return 'steady';

  const changePerMinute = (current.valueMgDl - previous.valueMgDl) / elapsedMinutes;
  if (changePerMinute >= 2) return 'rapidly-rising';
  if (changePerMinute >= 0.5) return 'rising';
  if (changePerMinute <= -2) return 'rapidly-falling';
  if (changePerMinute <= -0.5) return 'falling';
  return 'steady';
}

/**
 * Converts provider records into the single application model. Invalid records are
 * ignored, timestamps are canonical UTC ISO strings, and duplicates are removed by
 * their provider record ID (or a deterministic composite ID when none is available).
 */
export function normalizeGlucoseReadings(
  readings: readonly RawGlucoseReading[]
): GlucoseReading[] {
  const normalized = readings.flatMap((reading): NormalizedReadingWithoutTrend[] => {
    const timestampMs = new Date(reading.timestamp).getTime();
    const converted = convertGlucoseToMgDl(reading.value, reading.unit);
    if (!Number.isFinite(timestampMs) || converted === null) return [];

    const timestamp = new Date(timestampMs).toISOString();
    const valueMgDl = Math.round(converted);
    const sourceRecordId = cleanOptionalMetadata(reading.sourceRecordId);
    const deviceName = cleanOptionalMetadata(reading.deviceName);
    const normalizedReading = {
      timestamp,
      valueMgDl,
      source: reading.source,
      ...(sourceRecordId ? { sourceRecordId } : {}),
      ...(deviceName ? { deviceName } : {}),
    };

    return [
      {
        ...normalizedReading,
        id: stableReadingId(normalizedReading),
      },
    ];
  });

  normalized.sort(
    (first, second) => Date.parse(first.timestamp) - Date.parse(second.timestamp)
  );

  const seenIds = new Set<string>();
  const unique = normalized.filter((reading) => {
    if (seenIds.has(reading.id)) return false;
    seenIds.add(reading.id);
    return true;
  });

  return unique.map((reading, index) => ({
    ...reading,
    trend: inferDisplayTrend(unique[index - 1], reading),
  }));
}
