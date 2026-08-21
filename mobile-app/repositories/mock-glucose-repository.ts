import { generateMockGlucoseReadings } from '@/data/mock-glucose';
import type { GlucoseReading } from '@/types/health';
import type { GlucoseRepository } from './glucose-repository';

const HOUR_MS = 60 * 60 * 1000;

export function mockGlucoseSampleIntervalMinutes(durationMs: number): number {
  if (durationMs <= 48 * HOUR_MS) return 5;
  if (durationMs <= 8 * 24 * HOUR_MS) return 60;
  if (durationMs <= 32 * 24 * HOUR_MS) return 6 * 60;
  return 7 * 24 * 60;
}

export class MockGlucoseRepository implements GlucoseRepository {
  async getReadings(startDate: Date, endDate: Date): Promise<GlucoseReading[]> {
    const readings = generateMockGlucoseReadings(
      endDate,
      startDate,
      mockGlucoseSampleIntervalMinutes(endDate.getTime() - startDate.getTime())
    );
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    return readings.filter((reading) => {
      const timestamp = new Date(reading.timestamp).getTime();
      return timestamp >= startTime && timestamp <= endTime;
    });
  }

  async getLatestReading(): Promise<GlucoseReading | null> {
    return generateMockGlucoseReadings().at(-1) ?? null;
  }
}
