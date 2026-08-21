import { healthKitService } from '@/services/healthkit-service';
import type { DailyFitnessSummary } from '@/types/health';
import { createHealthKitDailyFitnessSummary } from '@/utils/healthkit-fitness';
import type { FitnessRepository } from './fitness-repository';

export class HealthKitFitnessRepository implements FitnessRepository {
  async getSummary(startDate: Date, endDate: Date): Promise<DailyFitnessSummary> {
    const result = await healthKitService.readFitnessData(startDate, endDate);
    return createHealthKitDailyFitnessSummary(
      startDate,
      endDate,
      result.stepStatistics,
      result.activeEnergyStatistics,
      result.workouts
    );
  }
}
