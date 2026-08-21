import { useCallback, useEffect, useState } from 'react';

import { repositories } from '@/repositories/repository-registry';
import type {
  GlucoseDataSource,
  GlucoseReading,
  GlucoseReadingTimeRange,
} from '@/types/health';
import {
  GLUCOSE_IMPORT_LOOKBACK_BUFFER_MS,
  selectGlucoseDisplayWindow,
} from '@/utils/glucose-display-window';

export function useGlucoseReadings(hours: number, source: GlucoseDataSource) {
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [timeRange, setTimeRange] = useState<GlucoseReadingTimeRange | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const endDate = new Date();
      const startDate = new Date(
        endDate.getTime() - hours * 60 * 60 * 1000 - GLUCOSE_IMPORT_LOOKBACK_BUFFER_MS
      );
      const fetchedReadings = await repositories.glucose[source].getReadings(startDate, endDate);
      const displayWindow = selectGlucoseDisplayWindow(fetchedReadings, hours, endDate);
      setReadings(displayWindow.readings);
      setTimeRange(displayWindow.timeRange);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Glucose data could not be loaded.');
      setReadings([]);
      setTimeRange(null);
    } finally {
      setIsLoading(false);
    }
  }, [hours, source]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { readings, timeRange, isLoading, error, refresh };
}
