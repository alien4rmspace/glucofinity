import type { GlucoseReading } from '@/types/health';

export interface GlucoseRepository {
  getReadings(startDate: Date, endDate: Date): Promise<GlucoseReading[]>;
  getLatestReading(): Promise<GlucoseReading | null>;
}

export class HealthConnectUnavailableError extends Error {
  constructor(message = 'Health Connect is unavailable. Check the connection in Settings.') {
    super(message);
    this.name = 'HealthConnectUnavailableError';
  }
}

export class HealthConnectPermissionError extends Error {
  constructor() {
    super('Blood glucose access is not granted. Connect Health Connect in Settings.');
    this.name = 'HealthConnectPermissionError';
  }
}

export class HealthKitUnavailableError extends Error {
  constructor(message = 'Apple Health is unavailable. Check the connection in Settings.') {
    super(message);
    this.name = 'HealthKitUnavailableError';
  }
}

export class HealthKitAuthorizationRequiredError extends Error {
  constructor() {
    super('Choose Apple Health access in Settings before loading permitted health records.');
    this.name = 'HealthKitAuthorizationRequiredError';
  }
}
