import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import {
  HealthKitAuthorizationRequiredError,
  HealthKitUnavailableError,
} from '@/repositories/glucose-repository';

type HealthKitModule = typeof import('@kingstinct/react-native-healthkit');
type BloodGlucoseSample = Awaited<
  ReturnType<HealthKitModule['queryQuantitySamples']>
>[number];
type QuantityStatistics = Awaited<
  ReturnType<HealthKitModule['queryStatisticsForQuantity']>
>;
type WorkoutSample = Awaited<
  ReturnType<HealthKitModule['queryWorkoutSamples']>
>[number];

const BLOOD_GLUCOSE_TYPE = 'HKQuantityTypeIdentifierBloodGlucose' as const;
const STEP_COUNT_TYPE = 'HKQuantityTypeIdentifierStepCount' as const;
const ACTIVE_ENERGY_TYPE = 'HKQuantityTypeIdentifierActiveEnergyBurned' as const;
const WORKOUT_TYPE = 'HKWorkoutTypeIdentifier' as const;
const BLOOD_GLUCOSE_READ_REQUEST = { toRead: [BLOOD_GLUCOSE_TYPE] } as const;
const FITNESS_READ_REQUEST = {
  toRead: [STEP_COUNT_TYPE, ACTIVE_ENERGY_TYPE, WORKOUT_TYPE],
} as const;
const HEALTHKIT_READ_REQUEST = {
  toRead: [
    BLOOD_GLUCOSE_TYPE,
    STEP_COUNT_TYPE,
    ACTIVE_ENERGY_TYPE,
    WORKOUT_TYPE,
  ],
} as const;

export interface HealthKitFitnessQueryResult {
  stepStatistics: QuantityStatistics;
  activeEnergyStatistics: QuantityStatistics;
  workouts: readonly WorkoutSample[];
}

export type HealthKitAvailability =
  | 'available'
  | 'unavailable'
  | 'expo-go'
  | 'native-build-required'
  | 'unsupported-platform';

export type HealthKitAuthorizationRequestStatus =
  | 'should-request'
  | 'unnecessary'
  | 'unknown';

export interface HealthKitAccessState {
  availability: HealthKitAvailability;
  authorizationRequestStatus: HealthKitAuthorizationRequestStatus;
}

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

async function loadModule(): Promise<HealthKitModule> {
  return import('@kingstinct/react-native-healthkit');
}

async function getReadyModule(): Promise<HealthKitModule> {
  if (Platform.OS !== 'ios') {
    throw new HealthKitUnavailableError('Apple Health is only available on iOS.');
  }
  if (isExpoGo()) {
    throw new HealthKitUnavailableError(
      'Apple Health requires an iOS development build and cannot run in Expo Go.'
    );
  }

  let healthKit: HealthKitModule;
  try {
    healthKit = await loadModule();
  } catch {
    throw new HealthKitUnavailableError(
      'This app build does not include Apple Health. Rebuild the iOS app with the configured native module.'
    );
  }

  if (!(await healthKit.isHealthDataAvailableAsync())) {
    throw new HealthKitUnavailableError('Apple Health is unavailable on this iOS device.');
  }
  return healthKit;
}

function mapRequestStatus(
  healthKit: HealthKitModule,
  status: number
): HealthKitAuthorizationRequestStatus {
  if (status === healthKit.AuthorizationRequestStatus.shouldRequest) return 'should-request';
  if (status === healthKit.AuthorizationRequestStatus.unnecessary) return 'unnecessary';
  return 'unknown';
}

export const healthKitService = {
  async getAccessState(): Promise<HealthKitAccessState> {
    if (Platform.OS !== 'ios') {
      return {
        availability: 'unsupported-platform',
        authorizationRequestStatus: 'unknown',
      };
    }
    if (isExpoGo()) {
      return { availability: 'expo-go', authorizationRequestStatus: 'unknown' };
    }

    let healthKit: HealthKitModule;
    try {
      healthKit = await loadModule();
    } catch {
      return {
        availability: 'native-build-required',
        authorizationRequestStatus: 'unknown',
      };
    }

    try {
      if (!(await healthKit.isHealthDataAvailableAsync())) {
        return { availability: 'unavailable', authorizationRequestStatus: 'unknown' };
      }
      const status = await healthKit.getRequestStatusForAuthorization(
        HEALTHKIT_READ_REQUEST
      );
      return {
        availability: 'available',
        authorizationRequestStatus: mapRequestStatus(healthKit, status),
      };
    } catch {
      return {
        availability: 'native-build-required',
        authorizationRequestStatus: 'unknown',
      };
    }
  },

  async requestReadAccess(): Promise<boolean> {
    const healthKit = await getReadyModule();
    return healthKit.requestAuthorization(HEALTHKIT_READ_REQUEST);
  },

  async readBloodGlucoseSamples(
    startDate: Date,
    endDate: Date
  ): Promise<readonly BloodGlucoseSample[]> {
    const healthKit = await getReadyModule();
    const requestStatus = await healthKit.getRequestStatusForAuthorization(
      BLOOD_GLUCOSE_READ_REQUEST
    );
    if (requestStatus !== healthKit.AuthorizationRequestStatus.unnecessary) {
      throw new HealthKitAuthorizationRequiredError();
    }

    return healthKit.queryQuantitySamples(BLOOD_GLUCOSE_TYPE, {
      filter: {
        date: {
          startDate,
          endDate,
          strictStartDate: true,
          strictEndDate: true,
        },
      },
      limit: 0,
      ascending: true,
      unit: 'mg/dL',
    });
  },

  async readFitnessData(
    startDate: Date,
    endDate: Date
  ): Promise<HealthKitFitnessQueryResult> {
    const healthKit = await getReadyModule();
    const requestStatus = await healthKit.getRequestStatusForAuthorization(
      FITNESS_READ_REQUEST
    );
    if (requestStatus !== healthKit.AuthorizationRequestStatus.unnecessary) {
      throw new HealthKitAuthorizationRequiredError();
    }

    const dateFilter = {
      date: {
        startDate,
        endDate,
        strictStartDate: true,
        strictEndDate: true,
      },
    } as const;
    const [stepStatistics, activeEnergyStatistics, workouts] = await Promise.all([
      healthKit.queryStatisticsForQuantity(STEP_COUNT_TYPE, ['cumulativeSum'], {
        filter: dateFilter,
        unit: 'count',
      }),
      healthKit.queryStatisticsForQuantity(ACTIVE_ENERGY_TYPE, ['cumulativeSum'], {
        filter: dateFilter,
        unit: 'kcal',
      }),
      healthKit.queryWorkoutSamples({
        filter: dateFilter,
        limit: 0,
        ascending: true,
      }),
    ]);

    return { stepStatistics, activeEnergyStatistics, workouts };
  },
};
