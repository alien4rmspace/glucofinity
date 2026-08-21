import * as Application from 'expo-application';
import { Platform } from 'react-native';

import appConfig from '@/app.json';
import {
  resolveAppVersionInfo,
  type AppVersionInfo,
} from '@/services/app-version-format';

export function getAppVersionInfo(): AppVersionInfo {
  const configuredBuild = Platform.OS === 'android'
    ? appConfig.expo.android.versionCode
    : appConfig.expo.ios.buildNumber;

  return resolveAppVersionInfo({
    nativeVersion: Application.nativeApplicationVersion,
    nativeBuild: Application.nativeBuildVersion,
    configuredVersion: appConfig.expo.version,
    configuredBuild,
  });
}
