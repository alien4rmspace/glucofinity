import { defaultSettings } from '@/constants/design';
import type {
  GlucoseDataSource,
  GlucoseDisplayRangePreset,
  TargetRange,
  UserSettings,
} from '@/types/health';

export const SETTINGS_STORAGE_VERSION = 3;
const EXPLICIT_DATA_SOURCE_STORAGE_VERSION = 2;

export interface StoredUserSettings {
  storageVersion?: number;
  units?: UserSettings['units'];
  targetRange?: Partial<TargetRange>;
  glucoseDisplayRangePreset?: GlucoseDisplayRangePreset;
  glucoseDataSource?: GlucoseDataSource;
  showMockData?: boolean;
}

export interface CurrentStoredUserSettings extends UserSettings {
  storageVersion: typeof SETTINGS_STORAGE_VERSION;
}

function migratedGlucoseDataSource(stored: StoredUserSettings): GlucoseDataSource {
  if ((stored.storageVersion ?? 0) >= EXPLICIT_DATA_SOURCE_STORAGE_VERSION) {
    return stored.glucoseDataSource ?? defaultSettings.glucoseDataSource;
  }

  // Earlier builds enabled fictional readings by default, so an old `mock`
  // value does not prove that the user opted into demo mode. Preserve only a
  // real native source across the production-default migration.
  if (
    stored.glucoseDataSource === 'healthkit' ||
    stored.glucoseDataSource === 'health-connect'
  ) {
    return stored.glucoseDataSource;
  }

  return 'none';
}

function migratedDisplayRangePreset(
  stored: StoredUserSettings
): GlucoseDisplayRangePreset {
  if (
    stored.storageVersion === SETTINGS_STORAGE_VERSION &&
    (stored.glucoseDisplayRangePreset === 'diabetes' ||
      stored.glucoseDisplayRangePreset === 'prediabetes-or-no-diabetes' ||
      stored.glucoseDisplayRangePreset === 'custom')
  ) {
    return stored.glucoseDisplayRangePreset;
  }

  // An existing numerical range does not establish the user's health status.
  return 'custom';
}

export function normalizeStoredSettings(stored: StoredUserSettings): UserSettings {
  return {
    units: 'mg/dL',
    targetRange: {
      ...defaultSettings.targetRange,
      ...stored.targetRange,
    },
    glucoseDisplayRangePreset: migratedDisplayRangePreset(stored),
    glucoseDataSource: migratedGlucoseDataSource(stored),
  };
}

export function serializeSettings(settings: UserSettings): CurrentStoredUserSettings {
  return {
    ...settings,
    storageVersion: SETTINGS_STORAGE_VERSION,
  };
}
