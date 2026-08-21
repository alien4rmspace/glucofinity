import type { GlucoseReading } from '@/types/health';
import { normalizeGlucoseReadings } from '@/utils/glucose-normalization';

export interface HealthKitBloodGlucoseSample {
  uuid?: string;
  startDate: Date | string;
  quantity: number;
  unit: string;
  sourceRevision?: {
    source?: {
      bundleIdentifier?: string;
      name?: string;
    };
  };
}

export function mapHealthKitBloodGlucoseSamples(
  samples: readonly HealthKitBloodGlucoseSample[]
): GlucoseReading[] {
  return normalizeGlucoseReadings(
    samples.map((sample) => ({
      timestamp: sample.startDate,
      value: sample.quantity,
      unit: sample.unit,
      source: 'healthkit' as const,
      sourceRecordId: sample.uuid,
      deviceName:
        sample.sourceRevision?.source?.name ??
        sample.sourceRevision?.source?.bundleIdentifier,
    }))
  );
}
