import type { GlucoseReading } from '@/types/health';
import { normalizeGlucoseReadings } from '@/utils/glucose-normalization';

export interface HealthConnectBloodGlucoseRecord {
  time: string;
  level: {
    inMilligramsPerDeciliter: number;
  };
  metadata?: {
    id?: string;
    dataOrigin?: string;
  };
}

export function mapHealthConnectBloodGlucoseRecords(
  records: readonly HealthConnectBloodGlucoseRecord[]
): GlucoseReading[] {
  return normalizeGlucoseReadings(
    records.map((record) => ({
      timestamp: record.time,
      value: record.level.inMilligramsPerDeciliter,
      unit: 'mg/dL',
      source: 'health-connect' as const,
      sourceRecordId: record.metadata?.id,
      deviceName: record.metadata?.dataOrigin,
    }))
  );
}
