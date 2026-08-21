import { healthKitService } from '@/services/healthkit-service';
import type { GlucoseReading } from '@/types/health';
import { mapHealthKitBloodGlucoseSamples } from '@/utils/healthkit';
import type { GlucoseRepository } from './glucose-repository';

export class HealthKitGlucoseRepository implements GlucoseRepository {
  async getReadings(startDate: Date, endDate: Date): Promise<GlucoseReading[]> {
    const samples = await healthKitService.readBloodGlucoseSamples(startDate, endDate);
    return mapHealthKitBloodGlucoseSamples(samples);
  }

  async getLatestReading(): Promise<GlucoseReading | null> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
    return (await this.getReadings(startDate, endDate)).at(-1) ?? null;
  }
}
