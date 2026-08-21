import { useCallback, useEffect, useState } from 'react';

import { repositories } from '@/repositories/repository-registry';
import {
  analyzeMealResponse,
  getMealAnalysisWindow,
} from '@/services/meal-glucose-response';
import type {
  GlucoseDataSource,
  GlucoseReading,
  MealEntry,
  MealGlucoseResponse,
} from '@/types/health';

export function useMealGlucoseResponse(
  meal: MealEntry | undefined,
  source: GlucoseDataSource
) {
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [response, setResponse] = useState<MealGlucoseResponse | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(meal));
  const [error, setError] = useState<string | null>(null);

  const mealId = meal?.id;
  const mealTimestamp = meal?.timestamp;
  const refresh = useCallback(async () => {
    if (!meal || !mealId || !mealTimestamp) {
      setReadings([]);
      setResponse(null);
      setIsLoading(false);
      return;
    }

    const window = getMealAnalysisWindow(mealTimestamp);
    if (!window) {
      setReadings([]);
      setResponse(analyzeMealResponse(meal, []));
      setError('The saved meal time is invalid.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const loadedReadings = await repositories.glucose[source].getReadings(
        window.startDate,
        window.endDate
      );
      setReadings(loadedReadings);
      setResponse(analyzeMealResponse(meal, loadedReadings));
    } catch (caughtError) {
      setReadings([]);
      setResponse(analyzeMealResponse(meal, []));
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Glucose response data could not be loaded.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [meal, mealId, mealTimestamp, source]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { readings, response, isLoading, error, refresh };
}
