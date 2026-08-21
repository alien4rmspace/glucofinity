import { createContext, type PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';

import { defaultSettings } from '@/constants/design';
import { repositories } from '@/repositories/repository-registry';
import { sortFeelingCheckIns } from '@/services/feeling-check-ins';
import { sortMedicationEntries } from '@/services/medication-logs';
import type {
  FeelingCheckIn,
  MealEntry,
  MedicationEntry,
  UserSettings,
} from '@/types/health';

interface AppDataContextValue {
  feelingCheckIns: FeelingCheckIn[];
  meals: MealEntry[];
  medicationEntries: MedicationEntry[];
  settings: UserSettings;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveFeelingCheckIn: (entry: FeelingCheckIn) => Promise<void>;
  deleteFeelingCheckIn: (id: string) => Promise<void>;
  saveMeal: (entry: MealEntry) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;
  saveMedicationEntry: (entry: MedicationEntry) => Promise<void>;
  deleteMedicationEntry: (id: string) => Promise<void>;
  updateSettings: (settings: UserSettings) => Promise<void>;
  resetLocalData: () => Promise<void>;
}

export const AppDataContext = createContext<AppDataContextValue | null>(null);

function sortMeals(meals: readonly MealEntry[]): MealEntry[] {
  return [...meals].sort(
    (first, second) =>
      new Date(second.timestamp).getTime() - new Date(first.timestamp).getTime()
  );
}

function usesNativeHealth(settings: UserSettings): boolean {
  return (
    settings.glucoseDataSource === 'healthkit' ||
    settings.glucoseDataSource === 'health-connect'
  );
}

export function AppDataProvider({ children }: PropsWithChildren) {
  const [feelingCheckIns, setFeelingCheckIns] = useState<FeelingCheckIn[]>([]);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [medicationEntries, setMedicationEntries] = useState<MedicationEntry[]>([]);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [storedFeelingCheckIns, storedMeals, storedMedicationEntries, storedSettings] = await Promise.all([
        repositories.feelingCheckIns.getAll(),
        repositories.meals.getAll(),
        repositories.medications.getAll(),
        repositories.settings.get(),
      ]);
      const currentMeals = usesNativeHealth(storedSettings)
        ? await repositories.meals.removeLegacySeededMeals()
        : storedMeals;
      setFeelingCheckIns(sortFeelingCheckIns(storedFeelingCheckIns));
      setMeals(sortMeals(currentMeals));
      setMedicationEntries(sortMedicationEntries(storedMedicationEntries));
      setSettings(storedSettings);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Local data could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveFeelingCheckIn = useCallback(async (entry: FeelingCheckIn) => {
    await repositories.feelingCheckIns.save(entry);
    setFeelingCheckIns((current) => sortFeelingCheckIns([
      ...current.filter((checkIn) => checkIn.id !== entry.id),
      entry,
    ]));
  }, []);

  const deleteFeelingCheckIn = useCallback(async (id: string) => {
    await repositories.feelingCheckIns.remove(id);
    setFeelingCheckIns((current) => current.filter((checkIn) => checkIn.id !== id));
  }, []);

  const saveMeal = useCallback(async (entry: MealEntry) => {
    await repositories.meals.save(entry);
    setMeals((current) => sortMeals([...current.filter((meal) => meal.id !== entry.id), entry]));
  }, []);

  const deleteMeal = useCallback(async (id: string) => {
    await repositories.meals.remove(id);
    setMeals((current) => current.filter((meal) => meal.id !== id));
  }, []);

  const saveMedicationEntry = useCallback(async (entry: MedicationEntry) => {
    await repositories.medications.save(entry);
    setMedicationEntries((current) => sortMedicationEntries([
      ...current.filter((medication) => medication.id !== entry.id),
      entry,
    ]));
  }, []);

  const deleteMedicationEntry = useCallback(async (id: string) => {
    await repositories.medications.remove(id);
    setMedicationEntries((current) => current.filter((medication) => medication.id !== id));
  }, []);

  const updateSettings = useCallback(async (nextSettings: UserSettings) => {
    const remainingMeals = usesNativeHealth(nextSettings)
      ? await repositories.meals.removeLegacySeededMeals()
      : null;
    await repositories.settings.save(nextSettings);
    if (remainingMeals) {
      setMeals(sortMeals(remainingMeals));
    }
    setSettings(nextSettings);
  }, []);

  const resetLocalData = useCallback(async () => {
    const resetSettings = await repositories.settings.reset();
    await Promise.all([
      repositories.feelingCheckIns.replaceAll([]),
      repositories.meals.replaceAll([]),
      repositories.medications.replaceAll([]),
    ]);
    setFeelingCheckIns([]);
    setMeals([]);
    setMedicationEntries([]);
    setSettings(resetSettings);
  }, []);

  const value = useMemo<AppDataContextValue>(
    () => ({
      feelingCheckIns,
      meals,
      medicationEntries,
      settings,
      isLoading,
      error,
      refresh,
      saveFeelingCheckIn,
      deleteFeelingCheckIn,
      saveMeal,
      deleteMeal,
      saveMedicationEntry,
      deleteMedicationEntry,
      updateSettings,
      resetLocalData,
    }),
    [
      feelingCheckIns,
      meals,
      medicationEntries,
      settings,
      isLoading,
      error,
      refresh,
      saveFeelingCheckIn,
      deleteFeelingCheckIn,
      saveMeal,
      deleteMeal,
      saveMedicationEntry,
      deleteMedicationEntry,
      updateSettings,
      resetLocalData,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
