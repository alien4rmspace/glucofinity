import type { GlucoseReading } from '@/types/health';
import {
  normalizeGlucoseReadings,
  type RawGlucoseReading,
} from '@/utils/glucose-normalization';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const DAY_MINUTES = 24 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

function circularMinuteDistance(minute: number, center: number): number {
  return ((minute - center + DAY_MINUTES / 2) % DAY_MINUTES) - DAY_MINUTES / 2;
}

function mealRise(minuteOfDay: number, center: number, amplitude: number): number {
  const distance = circularMinuteDistance(minuteOfDay, center);
  const widthMinutes = 52;
  return amplitude * Math.exp(-(distance * distance) / (2 * widthMinutes * widthMinutes));
}

function valueAt(timestamp: number): number {
  const date = new Date(timestamp);
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  const slowVariation = 7 * Math.sin((minuteOfDay / DAY_MINUTES) * Math.PI * 2 - 0.7);
  const shortVariation = 3.5 * Math.sin((minuteOfDay / 95) * Math.PI * 2);
  const breakfast = mealRise(minuteOfDay, 8 * 60 + 35, 38);
  const lunch = mealRise(minuteOfDay, 13 * 60 + 15, 47);
  const dinner = mealRise(minuteOfDay, 19 * 60 + 10, 42);
  const dayIndex = Math.floor(timestamp / DAY_MS);
  const multiDayVariation =
    5 * Math.sin((dayIndex / 21) * Math.PI * 2) +
    3 * Math.sin((dayIndex / 180) * Math.PI * 2 - 0.4);
  return Math.round(
    Math.max(
      68,
      Math.min(
        208,
        101 +
          slowVariation +
          shortVariation +
          multiDayVariation +
          breakfast +
          lunch +
          dinner
      )
    )
  );
}

export function generateMockGlucoseReadings(
  referenceDate = new Date(),
  requestedStartDate?: Date,
  sampleIntervalMinutes = 5
): GlucoseReading[] {
  const endTime = Math.floor(referenceDate.getTime() / FIVE_MINUTES_MS) * FIVE_MINUTES_MS;
  const startTime = requestedStartDate?.getTime() ?? endTime - DAY_MS;
  const intervalMs = Math.max(1, Math.floor(sampleIntervalMinutes)) * 60 * 1000;
  const readings: RawGlucoseReading[] = [];

  for (let timestamp = endTime; timestamp >= startTime; timestamp -= intervalMs) {
    const valueMgDl = valueAt(timestamp);
    const isoTimestamp = new Date(timestamp).toISOString();

    readings.unshift({
      timestamp: isoTimestamp,
      value: valueMgDl,
      unit: 'mg/dL',
      source: 'mock',
      sourceRecordId: `mock-${isoTimestamp}`,
      deviceName: 'Deterministic demo generator',
    });
  }

  return normalizeGlucoseReadings(readings);
}
