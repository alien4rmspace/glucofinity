import { Activity, BarChart3 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { HourlyChart } from '@/components/hourly-chart';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { MetricCard, MetricGrid } from '@/components/ui/metric-card';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { StatePanel } from '@/components/ui/state-panel';
import { palette, spacing } from '@/constants/design';
import { useAppData } from '@/hooks/use-app-data';
import { useGlucoseReadings } from '@/hooks/use-glucose-readings';
import { analyzeMealResponses } from '@/services/meal-glucose-response';
import {
  averageGlucose,
  glucoseMinMax,
  glucoseStandardDeviation,
  hourlyGlucoseSummary,
  largestObservedRise,
  timeInRangePercentage,
} from '@/utils/glucose-metrics';

function rounded(value: number | null): string {
  return value === null ? '—' : String(Math.round(value));
}

export default function TrendsScreen() {
  const { meals, settings } = useAppData();
  const { readings, isLoading, error, refresh } = useGlucoseReadings(
    24,
    settings.glucoseDataSource
  );
  const average = averageGlucose(readings);
  const minMax = glucoseMinMax(readings);
  const timeInRange = timeInRangePercentage(readings, settings.targetRange);
  const variability = glucoseStandardDeviation(readings);
  const largestRise = largestObservedRise(readings);
  const mealResponses = analyzeMealResponses(meals, readings).filter(
    (response) => response.dataQuality !== 'insufficient'
  );
  const baselineResponses = mealResponses.filter(
    (response) => response.baselineGlucoseMgDl !== undefined
  );
  const oneHourResponses = mealResponses.filter(
    (response) => response.glucoseAt60MinutesMgDl !== undefined
  );
  const averageBeforeMeals =
    baselineResponses.length === 0
      ? null
      : baselineResponses.reduce(
          (sum, response) => sum + (response.baselineGlucoseMgDl ?? 0),
          0
        ) / baselineResponses.length;
  const averageAfterMeals =
    oneHourResponses.length === 0
      ? null
      : oneHourResponses.reduce(
          (sum, response) => sum + (response.glucoseAt60MinutesMgDl ?? 0),
          0
        ) / oneHourResponses.length;
  const hourly = hourlyGlucoseSummary(readings);

  return (
    <Screen testID="trends-screen" refreshing={isLoading} onRefresh={() => void refresh()}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <BarChart3 size={23} color={palette.purple} />
        </View>
        <View style={styles.flex}>
          <AppText variant="title" color={palette.navy}>
            Trends
          </AppText>
          <AppText color={palette.textMuted}>Descriptive calculations from the displayed data.</AppText>
        </View>
      </View>

      {isLoading ? (
        <StatePanel loading title="Calculating trends" message="Summarizing the last 24 hours of displayed readings." />
      ) : error ? (
        <StatePanel title="Trends unavailable" message={error} />
      ) : readings.length === 0 ? (
        <StatePanel
          icon={<Activity size={32} color={palette.textMuted} />}
          title="Not enough data"
          message="Choose a data source in Settings and make sure it has enough readings."
        />
      ) : (
        <>
          <View style={styles.section}>
            <SectionHeader title="24-hour summary" description="Calculated rather than hard-coded." />
            <MetricGrid>
              <MetricCard label="Average glucose" value={rounded(average)} helper="mg/dL" />
              <MetricCard label="Minimum / maximum" value={minMax ? `${minMax.minimum} / ${minMax.maximum}` : '—'} helper="mg/dL" />
              <MetricCard label="Time in range" value={timeInRange === null ? '—' : `${Math.round(timeInRange)}%`} helper={`${settings.targetRange.lowMgDl}–${settings.targetRange.highMgDl} mg/dL`} />
              <MetricCard label="Variability" value={rounded(variability)} helper="SD in mg/dL" />
              <MetricCard label="Largest 1-hour rise" value={largestRise ? `${Math.max(0, Math.round(largestRise.riseMgDl))}` : '—'} helper="observed mg/dL" />
              <MetricCard label="Meal comparisons" value={String(mealResponses.length)} helper="with enough data" />
            </MetricGrid>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Hourly pattern" description="Average displayed glucose value within each clock hour." />
            <Card>
              <HourlyChart data={hourly} />
            </Card>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Meal-window context" description="Uses recent baseline readings and the nearest reading around one hour after logged meals." />
            <MetricGrid>
              <MetricCard label="Average before meals" value={rounded(averageBeforeMeals)} helper="mg/dL" />
              <MetricCard label="Average ~1 hour after" value={rounded(averageAfterMeals)} helper="mg/dL" />
            </MetricGrid>
            {mealResponses.length === 0 ? (
              <Card>
                <AppText color={palette.textMuted}>
                  No meal has enough surrounding readings for a comparison yet.
                </AppText>
              </Card>
            ) : null}
          </View>

          <View style={styles.section}>
            <SectionHeader title="What the metrics mean" />
            <Card style={styles.explanations}>
              <Explanation title="Average glucose" body="The arithmetic mean of displayed readings." />
              <Explanation title="Time in range" body="The share of readings within the display range configured in Settings." />
              <Explanation title="Variability" body="Standard deviation describes how spread out the displayed readings were." />
              <Explanation title="Meal-window comparison" body="Estimates a baseline from recent pre-meal readings and selects a nearby reading around one hour later. Missing data stays unavailable, and association does not establish causation." />
            </Card>
          </View>
        </>
      )}
    </Screen>
  );
}

function Explanation({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.explanation}>
      <AppText variant="bodyStrong">{title}</AppText>
      <AppText variant="caption" color={palette.textMuted}>
        {body}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.purpleSoft },
  flex: { flex: 1 },
  section: { gap: spacing.md },
  explanations: { gap: spacing.lg },
  explanation: { gap: spacing.xs },
});
