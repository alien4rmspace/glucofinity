import type { DailyFitnessSummary } from '@/types/health';

export interface FitnessRepository {
  getSummary(startDate: Date, endDate: Date): Promise<DailyFitnessSummary>;
}
