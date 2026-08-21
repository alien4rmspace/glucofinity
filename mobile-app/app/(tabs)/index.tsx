import { router, type Href } from 'expo-router';
import { Image } from 'expo-image';
import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Database,
  HeartPulse,
  Plus,
  Utensils,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';

import { GlucoseChart } from '@/components/glucose-chart';
import { DailyFitnessSummarySection } from '@/components/daily-fitness-summary';
import { FeelingCheckInCard } from '@/components/feeling-check-in-card';
import { MealCard } from '@/components/meal-card';
import { StatusPill } from '@/components/status-pill';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { MetricCard, MetricGrid } from '@/components/ui/metric-card';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatePanel } from '@/components/ui/state-panel';
import { palette, spacing } from '@/constants/design';
import { useAppData } from '@/hooks/use-app-data';
import { useGlucoseReadings } from '@/hooks/use-glucose-readings';
import { useDailyFitness } from '@/hooks/use-daily-fitness';
import { findUnloggedMealCandidate } from '@/services/unlogged-meal-candidate';
import type { GlucoseTrend } from '@/types/health';
import { glucoseChartPointIntervalMinutes } from '@/utils/chart-time';
import { formatReadingTime, isSameLocalDay } from '@/utils/date';
import {
  averageGlucose,
  classifyGlucoseStatus,
  glucoseMinMax,
  timeInRangePercentage,
  trendDescription,
} from '@/utils/glucose-metrics';
import { useMemo, useState } from 'react';

const rangeOptions = [
  { label: '3h', value: 3 },
  { label: '6h', value: 6 },
  { label: '12h', value: 12 },
  { label: '24h', value: 24 },
  { label: '7d', value: 7 * 24 },
  { label: '30d', value: 30 * 24 },
  { label: '1y', value: 365 * 24 },
];

const trendIcons: Record<GlucoseTrend, LucideIcon> = {
  'rapidly-rising': ArrowUp,
  rising: ArrowUpRight,
  steady: ArrowRight,
  falling: ArrowDownRight,
  'rapidly-falling': ArrowDown,
};

export default function DashboardScreen() {
  const [rangeHours, setRangeHours] = useState(6);
  const [healthPromptDismissed, setHealthPromptDismissed] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [dismissedCandidateId, setDismissedCandidateId] = useState<string | null>(null);
  const {
    feelingCheckIns,
    meals,
    medicationEntries,
    settings,
    isLoading: appDataLoading,
    error: appDataError,
  } = useAppData();
  const selectedData = useGlucoseReadings(rangeHours, settings.glucoseDataSource);
  const dailyData = useGlucoseReadings(24, settings.glucoseDataSource);
  const latest = selectedData.readings.at(-1) ?? null;
  const average = averageGlucose(dailyData.readings);
  const minMax = glucoseMinMax(dailyData.readings);
  const timeInRange = timeInRangePercentage(dailyData.readings, settings.targetRange);
  const unloggedMealCandidate = useMemo(
    () => findUnloggedMealCandidate(dailyData.readings, meals),
    [dailyData.readings, meals]
  );
  const visibleUnloggedMealCandidate =
    unloggedMealCandidate?.id === dismissedCandidateId ? null : unloggedMealCandidate;
  const todayMeals = meals.filter((meal) => isSameLocalDay(meal.timestamp, new Date()));
  const TrendIcon = latest ? trendIcons[latest.trend] : ArrowRight;
  const isLoading = appDataLoading || selectedData.isLoading || dailyData.isLoading;
  const error = appDataError ?? selectedData.error ?? dailyData.error;
  const isMockData = settings.glucoseDataSource === 'mock';
  const isHealthKit = settings.glucoseDataSource === 'healthkit';
  const isHealthConnect = settings.glucoseDataSource === 'health-connect';
  const isNativeHealth = isHealthKit || isHealthConnect;
  const nativeHealthApp = Platform.OS === 'ios'
    ? 'Apple Health'
    : Platform.OS === 'android'
      ? 'Health Connect'
      : undefined;
  const showHealthConnectionPrompt = Boolean(
    nativeHealthApp && !isNativeHealth && !healthPromptDismissed
  );
  const dailyFitness = useDailyFitness(Platform.OS === 'ios' && isHealthKit);
  const connectionRecordDescription = Platform.OS === 'ios'
    ? 'blood glucose and fitness records'
    : 'blood glucose records';
  const refreshDashboard = async () => {
    if (isManualRefreshing) return;

    setIsManualRefreshing(true);
    try {
      await Promise.all([
        selectedData.refresh(),
        dailyData.refresh(),
        dailyFitness.refresh(),
      ]);
    } finally {
      setIsManualRefreshing(false);
    }
  };

  return (
    <Screen
      testID="dashboard-screen"
      refreshing={isManualRefreshing}
      onRefresh={() => void refreshDashboard()}>
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <Image
            source={require('../../assets/images/android-icon-foreground.png')}
            style={styles.brandMarkImage}
            contentFit="contain"
            accessible={false}
          />
        </View>
        <View style={styles.headerCopy}>
          <AppText variant="title" color={palette.navy}>
            GlucoFinity
          </AppText>
          <AppText variant="caption" color={palette.textMuted}>
            A calm view of glucose context
          </AppText>
        </View>
      </View>

      {showHealthConnectionPrompt ? (
        <Card style={styles.healthPrompt} accessibilityRole="summary">
          <View style={styles.healthPromptHeader}>
            <View style={styles.healthPromptIcon}>
              <HeartPulse size={22} color={palette.green} />
            </View>
            <View style={styles.flex}>
              <AppText variant="subtitle">Connect {nativeHealthApp}</AppText>
              <AppText variant="caption" color={palette.textMuted}>
                Optionally display {connectionRecordDescription} that you choose to share with GlucoFinity.
              </AppText>
            </View>
          </View>
          <AppText variant="caption" color={palette.textMuted}>
            Access is read-only. GlucoFinity does not add, change, delete, or upload records from {nativeHealthApp}. You will review the permission request before anything is connected.
          </AppText>
          <View style={styles.healthPromptActions}>
            <AppButton
              label={`Connect ${nativeHealthApp}`}
              onPress={() => router.push('/settings')}
            />
            <AppButton
              label="Not now"
              variant="ghost"
              onPress={() => setHealthPromptDismissed(true)}
            />
          </View>
        </Card>
      ) : null}

      {isLoading && !latest ? (
        <StatePanel loading title="Loading dashboard" message="Preparing glucose readings and local meals." />
      ) : error ? (
        <StatePanel
          title="Dashboard unavailable"
          message={error}
          action={<AppButton label="Try again" variant="secondary" onPress={() => void selectedData.refresh()} />}
        />
      ) : settings.glucoseDataSource === 'none' ? (
        <StatePanel
          icon={<Database size={30} color={palette.textMuted} />}
          title="No glucose source selected"
          message={
            nativeHealthApp
              ? `Connect ${nativeHealthApp} in Settings to display permitted blood glucose records.`
              : 'Choose an available data source in Settings.'
          }
        />
      ) : !latest ? (
        <StatePanel
          title="No glucose readings"
          message={
            isNativeHealth
              ? `${isHealthKit ? 'Apple Health' : 'Health Connect'} has no permitted blood glucose records in the selected time range.`
              : 'No sample readings are available for the selected range.'
          }
        />
      ) : (
        <>
          <Card style={styles.currentCard} accessibilityLabel={`Latest displayed glucose reading ${latest.valueMgDl} milligrams per deciliter, ${trendDescription(latest.trend)}`}>
            <View style={styles.currentTopRow}>
              <View>
                <AppText variant="label" color={palette.textMuted}>
                  {isHealthKit
                    ? 'Latest Apple Health record'
                    : isHealthConnect
                      ? 'Latest Health Connect record'
                      : 'Latest sample reading'}
                </AppText>
                <View style={styles.valueRow}>
                  <AppText variant="display" color={palette.navy}>
                    {latest.valueMgDl}
                  </AppText>
                  <AppText variant="bodyStrong" color={palette.textMuted}>
                    mg/dL
                  </AppText>
                </View>
              </View>
              <StatusPill status={classifyGlucoseStatus(latest.valueMgDl, settings.targetRange)} />
            </View>
            <View style={styles.trendRow}>
              <View style={styles.trendIcon}>
                <TrendIcon size={22} color={palette.blue} />
              </View>
              <View>
                <AppText variant="bodyStrong">
                  {isNativeHealth
                    ? `Estimated display trend: ${trendDescription(latest.trend).toLowerCase()}`
                    : trendDescription(latest.trend)}
                </AppText>
                <AppText variant="caption" color={palette.textMuted}>
                  {isNativeHealth
                    ? `Derived from nearby imported records; latest at ${formatReadingTime(latest.timestamp)}`
                    : `Most recent sample at ${formatReadingTime(latest.timestamp)}`}
                </AppText>
              </View>
            </View>
          </Card>

          <View style={styles.section}>
            <SectionHeader
              title="Glucose overview"
              description={
                selectedData.timeRange?.endsAtLatestReading
                  ? 'The selected duration ends at the latest available imported record. Tap the chart to inspect a reading.'
                  : 'Tap the chart to inspect a displayed reading.'
              }
            />
            <SegmentedControl
              label="Glucose chart time range"
              options={rangeOptions}
              value={rangeHours}
              onChange={setRangeHours}
              wrap
            />
            <Card>
              {selectedData.timeRange ? (
                <GlucoseChart
                  readings={selectedData.readings}
                  timeRange={selectedData.timeRange}
                  targetRange={settings.targetRange}
                  meals={meals}
                  onMealPress={(meal) =>
                    router.push({ pathname: '/meal/[id]', params: { id: meal.id } })
                  }
                  medicationEntries={medicationEntries}
                  onMedicationPress={(entry) =>
                    router.push(`/medication/${entry.id}` as Href)
                  }
                  pointIntervalMinutes={glucoseChartPointIntervalMinutes(rangeHours)}
                />
              ) : null}
            </Card>
          </View>

          {visibleUnloggedMealCandidate ? (
            <Card style={styles.unloggedMealCard} accessibilityRole="summary">
              <View style={styles.unloggedMealHeader}>
                <View style={styles.unloggedMealIcon}>
                  <Utensils size={21} color={palette.amber} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="subtitle" color={palette.navy}>
                    Possible unlogged event
                  </AppText>
                  <AppText variant="caption" color={palette.textMuted}>
                    {isMockData ? 'Sample readings' : 'Displayed readings'} rose by about{' '}
                    {Math.round(visibleUnloggedMealCandidate.observedRiseMgDl)} mg/dL from{' '}
                    {formatReadingTime(visibleUnloggedMealCandidate.startedAt)} to{' '}
                    {formatReadingTime(visibleUnloggedMealCandidate.endedAt)}, with no saved meal found nearby.
                  </AppText>
                </View>
              </View>
              <AppText variant="caption" color={palette.textMuted}>
                This pattern cannot determine whether food or anything else caused the rise. Add a log only if you remember eating, and review the suggested time before saving.
              </AppText>
              <View style={styles.unloggedMealActions}>
                <AppButton
                  label="Add meal log"
                  icon={<Utensils size={18} color="#FFFFFF" />}
                  accessibilityHint="Open a new meal form with the start of the observed rise as the suggested time."
                  onPress={() =>
                    router.push({
                      pathname: '/meal/[id]',
                      params: {
                        id: 'new',
                        entryContext: 'possible-unlogged-rise',
                        suggestedTimestamp: visibleUnloggedMealCandidate.suggestedMealTimestamp,
                        observedRiseMgDl: String(
                          Math.round(visibleUnloggedMealCandidate.observedRiseMgDl)
                        ),
                      },
                    })
                  }
                />
                <AppButton
                  label="Not now"
                  variant="ghost"
                  onPress={() => setDismissedCandidateId(visibleUnloggedMealCandidate.id)}
                />
              </View>
            </Card>
          ) : null}

          <View style={styles.section}>
            <SectionHeader title="Today at a glance" description="Calculated from the last 24 hours of displayed readings." />
            <MetricGrid>
              <MetricCard label="Daily average" value={average === null ? '—' : `${Math.round(average)}`} helper="mg/dL" />
              <MetricCard label="Observed range" value={minMax ? `${minMax.minimum}–${minMax.maximum}` : '—'} helper="mg/dL" />
              <MetricCard label="In display range" value={timeInRange === null ? '—' : `${Math.round(timeInRange)}%`} helper={`${settings.targetRange.lowMgDl}–${settings.targetRange.highMgDl} mg/dL`} />
              <MetricCard label="Meals logged" value={String(todayMeals.length)} helper="today" />
            </MetricGrid>
          </View>
        </>
      )}

      <View style={styles.section}>
        <SectionHeader
          title="Feeling check-in"
          description="Record a timestamped description for future glucose-pattern comparisons."
        />
        <Card style={styles.feelingPrompt} accessibilityRole="summary">
          <View style={styles.feelingPromptHeader}>
            <View style={styles.feelingPromptIcon}>
              <HeartPulse size={22} color={palette.purple} />
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyStrong" color={palette.navy}>How are you feeling right now?</AppText>
              <AppText variant="caption" color={palette.textMuted}>
                Overall feeling takes one tap. Energy, stress, focus, hunger, sensations, and notes are optional.
              </AppText>
            </View>
          </View>
          <AppButton
            label="Check in now"
            onPress={() => router.push('/check-in/new' as Href)}
          />
          {feelingCheckIns.length > 0 ? (
            <AppButton
              label="View check-in history"
              variant="ghost"
              onPress={() => router.push('/check-ins' as Href)}
            />
          ) : null}
        </Card>
        {feelingCheckIns[0] ? (
          <View style={styles.latestFeeling}>
            <AppText variant="label" color={palette.textMuted}>Latest check-in</AppText>
            <FeelingCheckInCard
              checkIn={feelingCheckIns[0]}
              compact
              onPress={() => router.push(`/check-in/${feelingCheckIns[0].id}` as Href)}
            />
          </View>
        ) : null}
      </View>

      {Platform.OS === 'ios' ? (
        <DailyFitnessSummarySection
          connected={isHealthKit}
          summary={dailyFitness.summary}
          isLoading={dailyFitness.isLoading}
          error={dailyFitness.error}
          onConnect={() => router.push('/settings')}
          onRetry={() => void dailyFitness.refresh()}
        />
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          title="Recent meals"
          description="Saved on this device."
          action={
            <AppButton
              label="Add"
              variant="secondary"
              icon={<Plus size={18} color={palette.blue} />}
              onPress={() => router.push({ pathname: '/meal/[id]', params: { id: 'new' } })}
            />
          }
        />
        {meals.slice(0, 3).map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            compact
            onPress={() => router.push({ pathname: '/meal/[id]', params: { id: meal.id } })}
          />
        ))}
        {meals.length === 0 ? (
          <StatePanel title="No meals logged" message="Add a meal to compare its timing with displayed glucose patterns." />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brandMark: {
    width: 64,
    height: 48,
    borderRadius: 8,
    backgroundColor: palette.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandMarkImage: { width: 64, height: 64, transform: [{ scale: 1.35 }] },
  headerCopy: { flex: 1 },
  healthPrompt: { gap: spacing.md, backgroundColor: palette.greenSoft },
  healthPromptHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  healthPromptIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  healthPromptActions: { gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
  currentCard: { gap: spacing.lg },
  currentTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.xs },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  trendIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  section: { gap: spacing.md },
  unloggedMealCard: { gap: spacing.md, backgroundColor: palette.amberSoft },
  unloggedMealHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  unloggedMealIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  unloggedMealActions: { gap: spacing.sm },
  feelingPrompt: { gap: spacing.md, backgroundColor: palette.purpleSoft },
  feelingPromptHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  feelingPromptIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  latestFeeling: { gap: spacing.sm },
});
