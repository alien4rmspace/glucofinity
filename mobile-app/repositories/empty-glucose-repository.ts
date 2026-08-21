import type { GlucoseReading } from '@/types/health';
import type { GlucoseRepository } from './glucose-repository';

export class EmptyGlucoseRepository implements GlucoseRepository {
  async getReadings(): Promise<GlucoseReading[]> {
    return [];
  }

  async getLatestReading(): Promise<GlucoseReading | null> {
    return null;
  }
}
