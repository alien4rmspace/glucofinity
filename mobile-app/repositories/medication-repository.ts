import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  normalizeMedicationEntry,
  sortMedicationEntries,
} from '@/services/medication-logs';
import type { MedicationEntry } from '@/types/health';

const MEDICATION_LOGS_STORAGE_KEY = '@glucofinity/medication-logs/v1';

interface StoredMedicationLogs {
  schemaVersion: 1;
  entries: unknown[];
}

export interface MedicationRepository {
  getAll(): Promise<MedicationEntry[]>;
  save(entry: MedicationEntry): Promise<void>;
  remove(id: string): Promise<void>;
  replaceAll(entries: readonly MedicationEntry[]): Promise<void>;
}

export class AsyncStorageMedicationRepository implements MedicationRepository {
  async getAll(): Promise<MedicationEntry[]> {
    const stored = await AsyncStorage.getItem(MEDICATION_LOGS_STORAGE_KEY);
    if (!stored) {
      await this.replaceAll([]);
      return [];
    }

    const parsed = JSON.parse(stored) as Partial<StoredMedicationLogs>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.entries)) return [];
    return sortMedicationEntries(
      parsed.entries
        .map(normalizeMedicationEntry)
        .filter((entry): entry is MedicationEntry => Boolean(entry)),
    );
  }

  async save(entry: MedicationEntry): Promise<void> {
    const normalized = normalizeMedicationEntry(entry);
    if (!normalized) throw new Error('The medication log is invalid.');
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

  async replaceAll(entries: readonly MedicationEntry[]): Promise<void> {
    const normalizedEntries = entries.map((entry) => {
      const normalized = normalizeMedicationEntry(entry);
      if (!normalized) throw new Error('A medication log could not be stored.');
      return normalized;
    });
    const payload: StoredMedicationLogs = {
      schemaVersion: 1,
      entries: sortMedicationEntries(normalizedEntries),
    };
    await AsyncStorage.setItem(MEDICATION_LOGS_STORAGE_KEY, JSON.stringify(payload));
  }
}
