import { useCallback, useEffect, useState } from 'react';

import { repositories } from '@/repositories/repository-registry';
import type { DailyFitnessSummary } from '@/types/health';

export function useDailyFitness(enabled: boolean) {
  const [summary, setSummary] = useState<DailyFitnessSummary | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setSummary(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setHours(0, 0, 0, 0);
      setSummary(await repositories.fitness.healthkit.getSummary(startDate, endDate));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Apple Health fitness data could not be loaded.'
      );
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { summary, isLoading, error, refresh };
}
