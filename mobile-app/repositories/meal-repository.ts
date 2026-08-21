import AsyncStorage from '@react-native-async-storage/async-storage';

import { withoutLegacySeededMeals } from '@/services/legacy-demo-data';
import type { MealEntry } from '@/types/health';

const MEALS_STORAGE_KEY = '@glucofinity/meals/v1';

interface StoredMeals {
  initialized: true;
  entries: MealEntry[];
}

export interface MealRepository {
  getAll(): Promise<MealEntry[]>;
  save(entry: MealEntry): Promise<void>;
  remove(id: string): Promise<void>;
  replaceAll(entries: MealEntry[]): Promise<void>;
  removeLegacySeededMeals(): Promise<MealEntry[]>;
}

function sortMeals(entries: readonly MealEntry[]): MealEntry[] {
  return [...entries].sort(
    (first, second) =>
      new Date(second.timestamp).getTime() - new Date(first.timestamp).getTime()
  );
}

export class AsyncStorageMealRepository implements MealRepository {
  async getAll(): Promise<MealEntry[]> {
    const stored = await AsyncStorage.getItem(MEALS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as StoredMeals;
      return sortMeals(parsed.entries);
    }

    await this.replaceAll([]);
    return [];
  }

  async save(entry: MealEntry): Promise<void> {
    const entries = await this.getAll();
    const nextEntries = entries.some((candidate) => candidate.id === entry.id)
      ? entries.map((candidate) => (candidate.id === entry.id ? entry : candidate))
      : [entry, ...entries];
    await this.replaceAll(nextEntries);
  }

  async remove(id: string): Promise<void> {
    const entries = await this.getAll();
    await this.replaceAll(entries.filter((entry) => entry.id !== id));
  }

  async replaceAll(entries: MealEntry[]): Promise<void> {
    const payload: StoredMeals = { initialized: true, entries: sortMeals(entries) };
    await AsyncStorage.setItem(MEALS_STORAGE_KEY, JSON.stringify(payload));
  }

  async removeLegacySeededMeals(): Promise<MealEntry[]> {
    const entries = await this.getAll();
    const remainingEntries = withoutLegacySeededMeals(entries);
    if (remainingEntries.length !== entries.length) {
      await this.replaceAll(remainingEntries);
    }
    return remainingEntries;
  }
}
