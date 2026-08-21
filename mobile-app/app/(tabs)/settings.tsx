import { useFocusEffect } from 'expo-router';
import { Database, HeartPulse, Info, RotateCcw, ShieldCheck, Smartphone } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { FormField, FormRow } from '@/components/ui/form-field';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { palette, spacing } from '@/constants/design';
import { useAppData } from '@/hooks/use-app-data';
import {
  healthConnectService,
  type HealthConnectAccessState,
} from '@/services/health-connect-service';
import {
  healthKitService,
  type HealthKitAccessState,
} from '@/services/healthkit-service';
import { getAppVersionInfo } from '@/services/app-version';
import {
  nutritionCatalog,
  type NutritionCatalogStatus,
} from '@/services/nutrition-catalog';
import type { GlucoseDisplayRangePreset } from '@/types/health';
import {
  displayRangePresetDescription,
  targetRangeForDisplayPreset,
} from '@/utils/glucose-display-range';

const displayRangePresetOptions: {
  label: string;
  value: GlucoseDisplayRangePreset;
}[] = [
  { label: 'Diabetes', value: 'diabetes' },
  { label: 'No diabetes', value: 'prediabetes-or-no-diabetes' },
  { label: 'Custom', value: 'custom' },
];

const initialHealthConnectState: HealthConnectAccessState = {
  availability: Platform.OS === 'android' ? 'native-build-required' : 'unsupported-platform',
  permissionGranted: false,
};

const initialHealthKitState: HealthKitAccessState = {
  availability: Platform.OS === 'ios' ? 'native-build-required' : 'unsupported-platform',
  authorizationRequestStatus: 'unknown',
};

const initialNutritionCatalogStatus: NutritionCatalogStatus = {
  coreFoodCount: 0,
  brandedFoodCount: 0,
  brandedProductCount: 0,
  brandedState: 'not-configured',
};

export default function SettingsScreen() {
  const appVersion = getAppVersionInfo();
  const { settings, updateSettings, resetLocalData } = useAppData();
  const [lowValue, setLowValue] = useState(String(settings.targetRange.lowMgDl));
  const [highValue, setHighValue] = useState(String(settings.targetRange.highMgDl));
  const [displayRangePreset, setDisplayRangePreset] = useState(
    settings.glucoseDisplayRangePreset
  );
  const [healthConnectState, setHealthConnectState] = useState(initialHealthConnectState);
  const [healthKitState, setHealthKitState] = useState(initialHealthKitState);
  const [isCheckingNativeHealth, setIsCheckingNativeHealth] = useState(
    Platform.OS === 'android' || Platform.OS === 'ios'
  );
  const [nutritionCatalogStatus, setNutritionCatalogStatus] = useState(
    initialNutritionCatalogStatus,
  );
  const [isRetryingNutritionCatalog, setIsRetryingNutritionCatalog] = useState(false);

  useEffect(() => {
    setLowValue(String(settings.targetRange.lowMgDl));
    setHighValue(String(settings.targetRange.highMgDl));
    setDisplayRangePreset(settings.glucoseDisplayRangePreset);
  }, [
    settings.glucoseDisplayRangePreset,
    settings.targetRange.highMgDl,
    settings.targetRange.lowMgDl,
  ]);

  useFocusEffect(useCallback(() => {
    let active = true;
    let refreshInFlight = false;
    const refreshCatalogStatus = async () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      try {
        const nextStatus = await nutritionCatalog.initialize();
        if (!active) return;
        setNutritionCatalogStatus(nextStatus);
      } catch (error) {
        if (!active) return;
        setNutritionCatalogStatus({
          coreFoodCount: 0,
          brandedFoodCount: 0,
          brandedProductCount: 0,
          brandedState: 'error',
          error: error instanceof Error ? error.message : 'The local food catalog is unavailable.',
        });
      } finally {
        refreshInFlight = false;
      }
    };
    void refreshCatalogStatus();
    const refreshInterval = setInterval(() => void refreshCatalogStatus(), 1500);
    return () => {
      active = false;
      clearInterval(refreshInterval);
    };
  }, []));

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsCheckingNativeHealth(Platform.OS === 'android' || Platform.OS === 'ios');

      if (Platform.OS === 'android') {
        void healthConnectService.getAccessState().then((state) => {
          if (!isActive) return;
          setHealthConnectState(state);
          setIsCheckingNativeHealth(false);
        });
      } else if (Platform.OS === 'ios') {
        void healthKitService.getAccessState().then((state) => {
          if (!isActive) return;
          setHealthKitState(state);
          setIsCheckingNativeHealth(false);
        });
      }

      return () => {
        isActive = false;
      };
    }, [])
  );

  async function handleHealthConnectAction() {
    setIsCheckingNativeHealth(true);
    try {
      if (healthConnectState.permissionGranted) {
        if (settings.glucoseDataSource === 'health-connect') {
          await healthConnectService.openSettings();
        } else {
          await updateSettings({ ...settings, glucoseDataSource: 'health-connect' });
        }
        return;
      }

      const permissionGranted = await healthConnectService.requestBloodGlucoseReadPermission();
      if (!permissionGranted) {
        Alert.alert(
          'Permission not granted',
          'GlucoFinity can only read blood glucose records after you allow that specific Health Connect permission.'
        );
        return;
      }
      await updateSettings({ ...settings, glucoseDataSource: 'health-connect' });
      Alert.alert(
        'Health Connect connected',
        'GlucoFinity will now display read-only blood glucose records available in Health Connect.'
      );
    } catch (caughtError) {
      Alert.alert(
        'Health Connect unavailable',
        caughtError instanceof Error
          ? caughtError.message
          : 'Health Connect could not be opened.'
      );
    } finally {
      setHealthConnectState(await healthConnectService.getAccessState());
      setIsCheckingNativeHealth(false);
    }
  }

  async function handleHealthKitAction() {
    setIsCheckingNativeHealth(true);
    try {
      if (
        settings.glucoseDataSource === 'healthkit' &&
        healthKitState.authorizationRequestStatus === 'unnecessary'
      ) {
        Alert.alert(
          'Review Apple Health access',
          'To change access, open the Health app, tap your profile, then choose Apps and Services and GlucoFinity.'
        );
        return;
      }

      if (healthKitState.authorizationRequestStatus !== 'unnecessary') {
        const requestCompleted = await healthKitService.requestReadAccess();
        if (!requestCompleted) {
          Alert.alert(
            'Apple Health request incomplete',
            'GlucoFinity could not finish the Apple Health authorization request.'
          );
          return;
        }
      }

      await updateSettings({ ...settings, glucoseDataSource: 'healthkit' });
      Alert.alert(
        'Apple Health selected',
        'GlucoFinity will display permitted blood glucose, step, active-energy, and workout records. For privacy, iOS does not tell apps whether read access was denied.'
      );
    } catch (caughtError) {
      Alert.alert(
        'Apple Health unavailable',
        caughtError instanceof Error
          ? caughtError.message
          : 'Apple Health could not be opened.'
      );
    } finally {
      setHealthKitState(await healthKitService.getAccessState());
      setIsCheckingNativeHealth(false);
    }
  }

  function persistTargetRange() {
    const lowMgDl = Number(lowValue);
    const highMgDl = Number(highValue);
    if (!Number.isFinite(lowMgDl) || !Number.isFinite(highMgDl) || lowMgDl < 40 || highMgDl > 400 || lowMgDl >= highMgDl) {
      Alert.alert('Check target range', 'Enter a lower value from 40–399 and a higher value up to 400 mg/dL.');
      setLowValue(String(settings.targetRange.lowMgDl));
      setHighValue(String(settings.targetRange.highMgDl));
      setDisplayRangePreset(settings.glucoseDisplayRangePreset);
      return;
    }
    setDisplayRangePreset('custom');
    void updateSettings({
      ...settings,
      targetRange: { lowMgDl, highMgDl },
      glucoseDisplayRangePreset: 'custom',
    });
  }

  function applyDisplayRangePreset(preset: GlucoseDisplayRangePreset) {
    setDisplayRangePreset(preset);
    const targetRange = targetRangeForDisplayPreset(preset);

    if (!targetRange) {
      void updateSettings({ ...settings, glucoseDisplayRangePreset: 'custom' });
      return;
    }

    setLowValue(String(targetRange.lowMgDl));
    setHighValue(String(targetRange.highMgDl));
    void updateSettings({
      ...settings,
      targetRange,
      glucoseDisplayRangePreset: preset,
    });
  }

  function confirmReset() {
    Alert.alert('Reset local app data?', 'Locally stored meals, medication logs, feeling check-ins, and preferences will be cleared. This does not change Apple Health or Health Connect permissions.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => void resetLocalData() },
    ]);
  }

  async function retryNutritionCatalog() {
    setIsRetryingNutritionCatalog(true);
    try {
      setNutritionCatalogStatus(await nutritionCatalog.retryBrandedCatalog());
    } finally {
      setIsRetryingNutritionCatalog(false);
    }
  }

  return (
    <Screen testID="settings-screen">
      <View style={styles.header}>
        <View style={styles.icon}>
          <ShieldCheck size={23} color={palette.blue} />
        </View>
        <View style={styles.flex}>
          <AppText variant="title" color={palette.navy}>
            Settings
          </AppText>
          <AppText color={palette.textMuted}>Data sources, display preferences, and safety.</AppText>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Data source" />
        {Platform.OS === 'android' ? (
          <Card style={styles.connectionCard}>
            <View style={styles.cardHeader}>
              <View style={styles.healthConnectIcon}>
                <HeartPulse size={24} color={palette.green} />
              </View>
              <View style={styles.flex}>
                <AppText variant="subtitle">Health Connect</AppText>
                <AppText
                  variant="caption"
                  color={healthConnectState.permissionGranted ? palette.green : palette.red}>
                  {healthConnectStatusLabel(
                    healthConnectState,
                    settings.glucoseDataSource === 'health-connect'
                  )}
                </AppText>
              </View>
            </View>
            <AppText color={palette.textMuted}>
              {healthConnectDescription(healthConnectState)}
            </AppText>
            <AppText variant="caption" color={palette.textMuted}>
              Access is read-only and limited to blood glucose records. Source apps and devices
              decide what records appear in Health Connect.
            </AppText>
            <AppButton
              label={healthConnectButtonLabel(
                healthConnectState,
                settings.glucoseDataSource === 'health-connect'
              )}
              variant="secondary"
              disabled={healthConnectState.availability !== 'available'}
              loading={isCheckingNativeHealth}
              onPress={() => void handleHealthConnectAction()}
            />
          </Card>
        ) : Platform.OS === 'ios' ? (
          <Card style={styles.connectionCard}>
            <View style={styles.cardHeader}>
              <View style={styles.healthIcon}>
                <HeartPulse size={24} color={palette.red} />
              </View>
              <View style={styles.flex}>
                <AppText variant="subtitle">Apple Health</AppText>
                <AppText
                  variant="caption"
                  color={
                    settings.glucoseDataSource === 'healthkit' &&
                    healthKitState.authorizationRequestStatus === 'unnecessary'
                      ? palette.green
                      : healthKitState.availability === 'available'
                        ? palette.amber
                        : palette.red
                  }>
                  {healthKitStatusLabel(
                    healthKitState,
                    settings.glucoseDataSource === 'healthkit'
                  )}
                </AppText>
              </View>
            </View>
            <AppText color={palette.textMuted}>
              {healthKitDescription(healthKitState)}
            </AppText>
            <AppText variant="caption" color={palette.textMuted}>
              Access is read-only and limited to blood glucose, step count, active energy,
              and workout records. Apple Health controls which records are shared, and iOS
              does not disclose a read-permission status.
            </AppText>
            <AppButton
              label={healthKitButtonLabel(
                healthKitState,
                settings.glucoseDataSource === 'healthkit'
              )}
              variant="secondary"
              disabled={healthKitState.availability !== 'available'}
              loading={isCheckingNativeHealth}
              onPress={() => void handleHealthKitAction()}
            />
          </Card>
        ) : (
          <Card style={styles.connectionCard}>
            <AppText variant="subtitle">Native health data</AppText>
            <AppText color={palette.textMuted}>
              Apple Health is available on iOS and Health Connect is available on Android.
            </AppText>
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Glucose display" description="Display preferences and range context." />
        <Card style={styles.stack}>
          <SettingRow label="Units" value="mg/dL" />
          <View style={styles.divider} />
          <AppText variant="bodyStrong">Display range preset</AppText>
          <SegmentedControl
            label="Glucose display range preset"
            options={displayRangePresetOptions}
            value={displayRangePreset}
            onChange={applyDisplayRangePreset}
          />
          <AppText variant="caption" color={palette.textMuted}>
            {displayRangePresetDescription(displayRangePreset)}
          </AppText>
          <View style={styles.divider} />
          <AppText variant="bodyStrong">Display range values</AppText>
          <FormRow>
            <FormField
              label="Lower"
              value={lowValue}
              onChangeText={(value) => {
                setLowValue(value);
                setDisplayRangePreset('custom');
              }}
              onBlur={persistTargetRange}
              keyboardType="number-pad"
            />
            <FormField
              label="Upper"
              value={highValue}
              onChangeText={(value) => {
                setHighValue(value);
                setDisplayRangePreset('custom');
              }}
              onBlur={persistTargetRange}
              keyboardType="number-pad"
            />
          </FormRow>
          <AppText variant="caption" color={palette.textMuted}>
            This range controls chart shading and summary calculations. Presets are display
            guides only; they do not diagnose a condition or set a personalized treatment
            target. A clinician may recommend a different range.
          </AppText>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Sample data" />
        <Card>
          <View style={styles.switchRow}>
            <Database size={21} color={palette.cyan} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong">Use fictional sample data</AppText>
              <AppText variant="caption" color={palette.textMuted}>
                Off by default. Displays deterministic fictional readings instead of a native health source.
              </AppText>
            </View>
            <Switch
              accessibilityLabel="Use fictional sample glucose data"
              value={settings.glucoseDataSource === 'mock'}
              onValueChange={(useMockData) =>
                void updateSettings({
                  ...settings,
                  glucoseDataSource: useMockData
                    ? 'mock'
                    : preferredNativeHealthSource(healthConnectState, healthKitState),
                })
              }
              trackColor={{ false: palette.border, true: palette.blue }}
            />
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Offline food catalog"
          description="Food reference data only; saved meals and health records are stored separately."
        />
        <Card style={styles.stack}>
          <View style={styles.cardHeader}>
            <Database size={22} color={palette.cyan} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong">USDA FoodData Central</AppText>
              <AppText variant="caption" color={palette.textMuted}>
                SQLite searches stay on this device and load only matching foods.
              </AppText>
            </View>
          </View>
          <View style={styles.divider} />
          <SettingRow
            label="Core foods"
            value={nutritionCatalogStatus.coreFoodCount > 0
              ? nutritionCatalogStatus.coreFoodCount.toLocaleString()
              : 'Preparing'}
          />
          <View style={styles.divider} />
          <SettingRow
            label="Product catalog"
            value={brandedCatalogStatusLabel(nutritionCatalogStatus)}
          />
          {nutritionCatalogStatus.brandedState === 'downloading' ? (
            <CatalogDownloadProgress status={nutritionCatalogStatus} />
          ) : null}
          {nutritionCatalogStatus.brandedState === 'ready' ? (
            <>
              <View style={styles.divider} />
              <SettingRow
                label="Scannable products"
                value={nutritionCatalogStatus.brandedProductCount.toLocaleString()}
              />
            </>
          ) : null}
          {nutritionCatalogStatus.error ? (
            <AppText variant="caption" color={palette.red}>
              {nutritionCatalogStatus.error}
            </AppText>
          ) : null}
          {nutritionCatalogStatus.brandedState === 'error' ? (
            <AppButton
              label="Retry branded catalog"
              variant="secondary"
              loading={isRetryingNutritionCatalog}
              onPress={() => void retryNutritionCatalog()}
            />
          ) : null}
          <AppText variant="caption" color={palette.textMuted}>
            The app includes the generic core catalog. A versioned branded database with UPC/GTIN, manufacturer-submitted ingredient text, and available serving-level label nutrition downloads automatically when a verified catalog URL is configured for the build.
          </AppText>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Data and privacy" />
        <Card style={styles.stack}>
          <Info size={22} color={palette.purple} />
          <AppText variant="bodyStrong">Health information is sensitive</AppText>
          <AppText color={palette.textMuted}>
            Meal entries, medication logs, feeling check-ins, and preferences are stored locally on this
            device. When selected, Apple Health or Health Connect records are queried
            read-only and kept in memory for display; they are not copied to AsyncStorage or uploaded by GlucoFinity. Sample readings are fictional.
          </AppText>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Safety and local data" />
        <Card style={styles.stack}>
          <AppText variant="bodyStrong">Medical disclaimer</AppText>
          <AppText color={palette.textMuted}>
            GlucoFinity is educational and informational. It does not diagnose, prescribe treatment, recommend insulin doses, or replace a qualified healthcare professional.
          </AppText>
          <AppButton label="Reset local app data" variant="danger" icon={<RotateCcw size={18} color={palette.red} />} onPress={confirmReset} />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="About" />
        <Card style={styles.stack}>
          <View style={styles.cardHeader}>
            <View style={styles.icon}>
              <Smartphone size={22} color={palette.blue} />
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyStrong">GlucoFinity</AppText>
              <AppText variant="caption" color={palette.textMuted}>
                Installed application information
              </AppText>
            </View>
          </View>
          <View style={styles.divider} />
          <SettingRow label="Version" value={appVersion.version} />
          <View style={styles.divider} />
          <SettingRow label="Build" value={appVersion.build} />
        </Card>
      </View>
    </Screen>
  );
}

function healthConnectStatusLabel(
  state: HealthConnectAccessState,
  isActive: boolean
): string {
  if (state.permissionGranted) return isActive ? 'Connected and active' : 'Access granted';
  if (state.availability === 'available') return 'Permission needed';
  if (state.availability === 'expo-go') return 'Android development build required';
  if (state.availability === 'provider-update-required') return 'Install or update required';
  if (state.availability === 'native-build-required') return 'Native module not in this build';
  return 'Unavailable';
}

function healthConnectDescription(state: HealthConnectAccessState): string {
  switch (state.availability) {
    case 'available':
      return state.permissionGranted
        ? 'GlucoFinity has permission to read blood glucose records available in Health Connect.'
        : 'Connect to choose the Android system permission for reading blood glucose records.';
    case 'expo-go':
      return 'Expo Go does not include the Health Connect native bridge. Install an Android development build of GlucoFinity.';
    case 'native-build-required':
      return 'This Android build does not include Health Connect. Rebuild the native app with the configured module.';
    case 'provider-update-required':
      return 'Install or update Health Connect on this Android device, then reopen this screen.';
    case 'unavailable':
      return 'Health Connect is not available on this Android device.';
    default:
      return 'Health Connect is only available on Android.';
  }
}

function healthConnectButtonLabel(
  state: HealthConnectAccessState,
  isActive: boolean
): string {
  if (state.permissionGranted) return isActive ? 'Review Health Connect access' : 'Use Health Connect';
  if (state.availability === 'available') return 'Connect Health Connect';
  if (state.availability === 'expo-go') return 'Requires Android development build';
  if (state.availability === 'provider-update-required') return 'Health Connect update required';
  return 'Health Connect unavailable';
}

function healthKitStatusLabel(state: HealthKitAccessState, isActive: boolean): string {
  if (
    isActive &&
    state.availability === 'available' &&
    state.authorizationRequestStatus !== 'unnecessary'
  ) {
    return 'Additional permission choice needed';
  }
  if (isActive) return 'Selected';
  if (
    state.availability === 'available' &&
    state.authorizationRequestStatus === 'unnecessary'
  ) {
    return 'Access previously requested';
  }
  if (state.availability === 'available') return 'Permission choice needed';
  if (state.availability === 'expo-go') return 'iOS development build required';
  if (state.availability === 'native-build-required') return 'Native module not in this build';
  return 'Unavailable';
}

function healthKitDescription(state: HealthKitAccessState): string {
  switch (state.availability) {
    case 'available':
      return state.authorizationRequestStatus === 'unnecessary'
        ? 'The Apple Health authorization choice has already been presented. Select Apple Health to display any permitted blood glucose and fitness records.'
        : 'Connect to choose whether GlucoFinity may read blood glucose, step count, active energy, and workout records from Apple Health.';
    case 'expo-go':
      return 'Expo Go does not include the Apple Health native bridge. Install an iOS development build of GlucoFinity.';
    case 'native-build-required':
      return 'This iOS build does not include Apple Health. Rebuild the native app with the configured module and entitlement.';
    case 'unavailable':
      return 'Apple Health is not available on this iOS device.';
    default:
      return 'Apple Health is only available on iOS.';
  }
}

function healthKitButtonLabel(state: HealthKitAccessState, isActive: boolean): string {
  if (
    isActive &&
    state.availability === 'available' &&
    state.authorizationRequestStatus !== 'unnecessary'
  ) {
    return 'Update Apple Health access';
  }
  if (isActive) return 'Review Apple Health access';
  if (
    state.availability === 'available' &&
    state.authorizationRequestStatus === 'unnecessary'
  ) {
    return 'Use Apple Health';
  }
  if (state.availability === 'available') return 'Connect Apple Health';
  if (state.availability === 'expo-go') return 'Requires iOS development build';
  return 'Apple Health unavailable';
}

function preferredNativeHealthSource(
  healthConnectState: HealthConnectAccessState,
  healthKitState: HealthKitAccessState
): 'health-connect' | 'healthkit' | 'none' {
  if (Platform.OS === 'android' && healthConnectState.permissionGranted) {
    return 'health-connect';
  }
  if (
    Platform.OS === 'ios' &&
    healthKitState.availability === 'available' &&
    healthKitState.authorizationRequestStatus === 'unnecessary'
  ) {
    return 'healthkit';
  }
  return 'none';
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settingRow} accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="bodyStrong">{label}</AppText>
      <AppText color={palette.textMuted}>{value}</AppText>
    </View>
  );
}

function CatalogDownloadProgress({ status }: { status: NutritionCatalogStatus }) {
  const total = Math.max(0, status.brandedBytesTotal ?? 0);
  const downloaded = Math.min(total, Math.max(0, status.brandedBytesDownloaded ?? 0));
  const percentage = total > 0 ? Math.round((downloaded / total) * 100) : 0;
  const progressLabel = total > 0
    ? `${formatCatalogMegabytes(downloaded)} of ${formatCatalogMegabytes(total)}`
    : 'Preparing download';

  return (
    <View
      style={styles.catalogProgress}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="USDA product catalog download"
      accessibilityValue={{ min: 0, max: 100, now: percentage, text: progressLabel }}>
      <View style={styles.catalogProgressTrack}>
        <View
          style={[
            styles.catalogProgressFill,
            { width: `${percentage}%` as `${number}%` },
          ]}
        />
      </View>
      <View style={styles.catalogProgressLabels}>
        <AppText variant="caption" color={palette.textMuted}>{progressLabel}</AppText>
        <AppText variant="caption" color={palette.cyan}>{percentage}%</AppText>
      </View>
    </View>
  );
}

function formatCatalogMegabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(bytes >= 100_000_000 ? 0 : 1)} MB`;
}

function brandedCatalogStatusLabel(status: NutritionCatalogStatus): string {
  if (status.brandedState === 'ready') {
    return `${status.brandedFoodCount.toLocaleString()} available`;
  }
  if (status.brandedState === 'downloading') {
    const total = status.brandedBytesTotal ?? 0;
    const downloaded = status.brandedBytesDownloaded ?? 0;
    return total > 0
      ? `Downloading ${Math.round((downloaded / total) * 100)}%`
      : 'Starting download';
  }
  if (status.brandedState === 'verifying') return 'Download complete · Verifying';
  if (status.brandedState === 'error') return 'Download unavailable';
  return 'Not configured';
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  healthIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.redSoft, alignItems: 'center', justifyContent: 'center' },
  healthConnectIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.greenSoft, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  section: { gap: spacing.md },
  connectionCard: { gap: spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stack: { gap: spacing.md },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: palette.border },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  catalogProgress: { gap: spacing.sm },
  catalogProgressTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: palette.surfaceMuted,
  },
  catalogProgressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: palette.cyan,
  },
  catalogProgressLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
