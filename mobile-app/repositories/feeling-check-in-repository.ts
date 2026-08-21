import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  normalizeFeelingCheckIn,
  sortFeelingCheckIns,
} from '@/services/feeling-check-ins';
import type { FeelingCheckIn } from '@/types/health';

const FEELING_CHECK_INS_STORAGE_KEY = '@glucofinity/feeling-check-ins/v1';

interface StoredFeelingCheckIns {
  schemaVersion: 1;
  entries: unknown[];
}

export interface FeelingCheckInRepository {
  getAll(): Promise<FeelingCheckIn[]>;
  save(entry: FeelingCheckIn): Promise<void>;
  remove(id: string): Promise<void>;
  replaceAll(entries: readonly FeelingCheckIn[]): Promise<void>;
}

export class AsyncStorageFeelingCheckInRepository implements FeelingCheckInRepository {
  async getAll(): Promise<FeelingCheckIn[]> {
    const stored = await AsyncStorage.getItem(FEELING_CHECK_INS_STORAGE_KEY);
    if (!stored) {
      await this.replaceAll([]);
      return [];
    }

    const parsed = JSON.parse(stored) as Partial<StoredFeelingCheckIns>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.entries)) return [];
    return sortFeelingCheckIns(
      parsed.entries
        .map(normalizeFeelingCheckIn)
        .filter((entry): entry is FeelingCheckIn => Boolean(entry)),
    );
  }

  async save(entry: FeelingCheckIn): Promise<void> {
    const normalized = normalizeFeelingCheckIn(entry);
    if (!normalized) throw new Error('The feeling check-in is invalid.');
    const entries = await this.getAll();
    const nextEntries = entries.some((candidate) => candidate.id === normalized.id)
      ? entries.map((candidate) => candidate.id === normalized.id ? normalized : candidate)
      : [normalized, ...entries];
    await this.replaceAll(nextEntries);
  }

  async remove(id: string): Promise<void> {
    const entries = await this.getAll();
    await this.replaceAll(entries.filter((entry) => entry.id !== id));
  }

  async replaceAll(entries: readonly FeelingCheckIn[]): Promise<void> {
    const normalizedEntries = entries.map((entry) => {
      const normalized = normalizeFeelingCheckIn(entry);
      if (!normalized) throw new Error('A feeling check-in could not be stored.');
      return normalized;
    });
    const payload: StoredFeelingCheckIns = {
      schemaVersion: 1,
      entries: sortFeelingCheckIns(normalizedEntries),
    };
    await AsyncStorage.setItem(FEELING_CHECK_INS_STORAGE_KEY, JSON.stringify(payload));
  }
}
