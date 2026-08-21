import { healthConnectService } from '@/services/health-connect-service';
import type { GlucoseReading } from '@/types/health';
import { mapHealthConnectBloodGlucoseRecords } from '@/utils/health-connect';
import type { GlucoseRepository } from './glucose-repository';

export class HealthConnectGlucoseRepository implements GlucoseRepository {
  async getReadings(startDate: Date, endDate: Date): Promise<GlucoseReading[]> {
    const records = await healthConnectService.readBloodGlucoseRecords(startDate, endDate);
    return mapHealthConnectBloodGlucoseRecords(records);
  }

  async getLatestReading(): Promise<GlucoseReading | null> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
    return (await this.getReadings(startDate, endDate)).at(-1) ?? null;
  }
}
