import AsyncStorage from '@react-native-async-storage/async-storage';

import { defaultSettings } from '@/constants/design';
import {
  normalizeStoredSettings,
  serializeSettings,
  SETTINGS_STORAGE_VERSION,
  type StoredUserSettings,
} from '@/repositories/settings-migration';
import type { UserSettings } from '@/types/health';

const SETTINGS_STORAGE_KEY = '@glucofinity/settings/v1';

export interface SettingsRepository {
  get(): Promise<UserSettings>;
  save(settings: UserSettings): Promise<void>;
  reset(): Promise<UserSettings>;
}

export class AsyncStorageSettingsRepository implements SettingsRepository {
  async get(): Promise<UserSettings> {
    const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) return defaultSettings;
    const parsed = JSON.parse(stored) as StoredUserSettings;
    const settings = normalizeStoredSettings(parsed);

    if (parsed.storageVersion !== SETTINGS_STORAGE_VERSION) {
      await this.save(settings);
    }

    return settings;
  }

  async save(settings: UserSettings): Promise<void> {
    await AsyncStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(serializeSettings(settings))
    );
  }

  async reset(): Promise<UserSettings> {
    await this.save(defaultSettings);
    return defaultSettings;
  }
}
