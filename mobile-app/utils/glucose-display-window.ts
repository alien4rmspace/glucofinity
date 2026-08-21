import type { GlucoseReading, GlucoseReadingTimeRange } from '@/types/health';

const HOUR_MS = 60 * 60 * 1000;
const FRESH_READING_TOLERANCE_MS = 15 * 60 * 1000;

export const GLUCOSE_IMPORT_LOOKBACK_BUFFER_MS = 12 * HOUR_MS;

interface GlucoseDisplayWindow {
  readings: GlucoseReading[];
  timeRange: GlucoseReadingTimeRange;
}

export function selectGlucoseDisplayWindow(
  readings: readonly GlucoseReading[],
  hours: number,
  requestedEndDate: Date
): GlucoseDisplayWindow {
  const requestedEndTime = requestedEndDate.getTime();
  const validReadings = readings
    .map((reading) => ({ reading, timestamp: Date.parse(reading.timestamp) }))
    .filter(
      (item) => Number.isFinite(item.timestamp) && item.timestamp <= requestedEndTime
    )
    .sort((first, second) => first.timestamp - second.timestamp);
  const latestReadingTime = validReadings.at(-1)?.timestamp;
  const endsAtLatestReading =
    latestReadingTime !== undefined &&
    requestedEndTime - latestReadingTime > FRESH_READING_TOLERANCE_MS;
  const displayEndTime = endsAtLatestReading ? latestReadingTime : requestedEndTime;
  const displayStartTime = displayEndTime - hours * HOUR_MS;

  return {
    readings: validReadings
      .filter(
        (item) => item.timestamp >= displayStartTime && item.timestamp <= displayEndTime
      )
      .map((item) => item.reading),
    timeRange: {
      startTime: new Date(displayStartTime).toISOString(),
      endTime: new Date(displayEndTime).toISOString(),
      endsAtLatestReading,
    },
  };
}
