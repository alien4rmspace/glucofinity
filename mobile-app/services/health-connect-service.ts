import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type {
  Permission,
  RecordResult,
} from 'react-native-health-connect';

import {
  HealthConnectPermissionError,
  HealthConnectUnavailableError,
} from '@/repositories/glucose-repository';

type HealthConnectModule = typeof import('react-native-health-connect');

export type HealthConnectAvailability =
  | 'available'
  | 'provider-update-required'
  | 'unavailable'
  | 'expo-go'
  | 'native-build-required'
  | 'unsupported-platform';

export interface HealthConnectAccessState {
  availability: HealthConnectAvailability;
  permissionGranted: boolean;
}

const bloodGlucoseReadPermission: Permission = {
  accessType: 'read',
  recordType: 'BloodGlucose',
};

function isBloodGlucoseReadPermission(permission: Permission): boolean {
  return permission.accessType === 'read' && permission.recordType === 'BloodGlucose';
}

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

async function loadModule(): Promise<HealthConnectModule> {
  return import('react-native-health-connect');
}

async function getReadyModule(): Promise<HealthConnectModule> {
  if (Platform.OS !== 'android') {
    throw new HealthConnectUnavailableError('Health Connect is only available on Android.');
  }
  if (isExpoGo()) {
    throw new HealthConnectUnavailableError(
      'Health Connect requires an Android development build and cannot run in Expo Go.'
    );
  }

  let healthConnect: HealthConnectModule;
  try {
    healthConnect = await loadModule();
  } catch {
    throw new HealthConnectUnavailableError(
      'This app build does not include Health Connect. Rebuild the Android app after installing the native module.'
    );
  }

  const sdkStatus = await healthConnect.getSdkStatus();
  if (sdkStatus === healthConnect.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    throw new HealthConnectUnavailableError(
      'Health Connect must be installed or updated before GlucoFinity can read glucose records.'
    );
  }
  if (sdkStatus !== healthConnect.SdkAvailabilityStatus.SDK_AVAILABLE) {
    throw new HealthConnectUnavailableError('Health Connect is unavailable on this Android device.');
  }

  const initialized = await healthConnect.initialize();
  if (!initialized) {
    throw new HealthConnectUnavailableError('Health Connect could not be initialized on this device.');
  }
  return healthConnect;
}

async function getGrantedBloodGlucosePermission(
  healthConnect: HealthConnectModule
): Promise<boolean> {
  const grantedPermissions = await healthConnect.getGrantedPermissions();
  return grantedPermissions.some((permission) =>
    isBloodGlucoseReadPermission(permission as Permission)
  );
}

export const healthConnectService = {
  async getAccessState(): Promise<HealthConnectAccessState> {
    if (Platform.OS !== 'android') {
      return { availability: 'unsupported-platform', permissionGranted: false };
    }
    if (isExpoGo()) {
      return { availability: 'expo-go', permissionGranted: false };
    }

    let healthConnect: HealthConnectModule;
    try {
      healthConnect = await loadModule();
    } catch {
      return { availability: 'native-build-required', permissionGranted: false };
    }

    try {
      const sdkStatus = await healthConnect.getSdkStatus();
      if (sdkStatus === healthConnect.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        return { availability: 'provider-update-required', permissionGranted: false };
      }
      if (sdkStatus !== healthConnect.SdkAvailabilityStatus.SDK_AVAILABLE) {
        return { availability: 'unavailable', permissionGranted: false };
      }
      const initialized = await healthConnect.initialize();
      if (!initialized) {
        return { availability: 'unavailable', permissionGranted: false };
      }
      return {
        availability: 'available',
        permissionGranted: await getGrantedBloodGlucosePermission(healthConnect),
      };
    } catch {
      return { availability: 'native-build-required', permissionGranted: false };
    }
  },

  async requestBloodGlucoseReadPermission(): Promise<boolean> {
    const healthConnect = await getReadyModule();
    const grantedPermissions = await healthConnect.requestPermission([
      bloodGlucoseReadPermission,
    ]);
    return grantedPermissions.some((permission) =>
      isBloodGlucoseReadPermission(permission as Permission)
    );
  },

  async readBloodGlucoseRecords(
    startDate: Date,
    endDate: Date
  ): Promise<RecordResult<'BloodGlucose'>[]> {
    const healthConnect = await getReadyModule();
    if (!(await getGrantedBloodGlucosePermission(healthConnect))) {
      throw new HealthConnectPermissionError();
    }

    const records: RecordResult<'BloodGlucose'>[] = [];
    const seenPageTokens = new Set<string>();
    let pageToken: string | undefined;
    do {
      const page = await healthConnect.readRecords('BloodGlucose', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
        ascendingOrder: true,
        pageSize: 1000,
        ...(pageToken ? { pageToken } : {}),
      });
      records.push(...page.records);
      pageToken = page.pageToken;
      if (pageToken && seenPageTokens.has(pageToken)) break;
      if (pageToken) seenPageTokens.add(pageToken);
    } while (pageToken);

    return records;
  },

  async openSettings(): Promise<void> {
    const healthConnect = await getReadyModule();
    healthConnect.openHealthConnectSettings();
  },
};
