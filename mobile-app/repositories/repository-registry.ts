import type { GlucoseDataSource } from '@/types/health';
import type { FitnessRepository } from './fitness-repository';
import {
  AsyncStorageFeelingCheckInRepository,
  type FeelingCheckInRepository,
} from './feeling-check-in-repository';
import type { GlucoseRepository } from './glucose-repository';
import { EmptyGlucoseRepository } from './empty-glucose-repository';
import { HealthConnectGlucoseRepository } from './health-connect-glucose-repository';
import { HealthKitGlucoseRepository } from './healthkit-glucose-repository';
import { HealthKitFitnessRepository } from './healthkit-fitness-repository';
import { MockGlucoseRepository } from './mock-glucose-repository';
import { AsyncStorageMealRepository, type MealRepository } from './meal-repository';
import {
  AsyncStorageMedicationRepository,
  type MedicationRepository,
} from './medication-repository';
import {
  AsyncStorageSettingsRepository,
  type SettingsRepository,
} from './settings-repository';

export interface RepositoryRegistry {
  glucose: Record<GlucoseDataSource, GlucoseRepository>;
  fitness: {
    healthkit: FitnessRepository;
  };
  feelingCheckIns: FeelingCheckInRepository;
  meals: MealRepository;
  medications: MedicationRepository;
  settings: SettingsRepository;
}

export const repositories: RepositoryRegistry = {
  glucose: {
    mock: new MockGlucoseRepository(),
    healthkit: new HealthKitGlucoseRepository(),
    'health-connect': new HealthConnectGlucoseRepository(),
    none: new EmptyGlucoseRepository(),
  },
  fitness: {
    healthkit: new HealthKitFitnessRepository(),
  },
  feelingCheckIns: new AsyncStorageFeelingCheckInRepository(),
  meals: new AsyncStorageMealRepository(),
  medications: new AsyncStorageMedicationRepository(),
  settings: new AsyncStorageSettingsRepository(),
};
