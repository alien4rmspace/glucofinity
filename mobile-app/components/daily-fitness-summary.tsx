import { Activity, Footprints } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { DailyFitnessSummary } from '@/types/health';
import { formatReadingTime } from '@/utils/date';
import { palette, spacing } from '@/constants/design';
import { AppButton } from './ui/app-button';
import { AppText } from './ui/app-text';
import { Card } from './ui/card';
import { MetricCard, MetricGrid } from './ui/metric-card';
import { SectionHeader } from './ui/section-header';
import { StatePanel } from './ui/state-panel';

interface DailyFitnessSummaryProps {
  connected: boolean;
  summary: DailyFitnessSummary | null;
  isLoading: boolean;
  error: string | null;
  onConnect: () => void;
  onRetry: () => void;
}

function formattedNumber(value: number | undefined): string {
  return value === undefined ? '—' : new Intl.NumberFormat().format(value);
}

export function DailyFitnessSummarySection({
  connected,
  summary,
  isLoading,
  error,
  onConnect,
  onRetry,
}: DailyFitnessSummaryProps) {
  const workoutMinutes = summary?.workouts.length
    ? Math.round(
        summary.workouts.reduce(
          (total, workout) => total + workout.durationMinutes,
          0
        )
      )
    : undefined;
  const hasFitnessData = Boolean(
    summary &&
      (summary.stepCount !== undefined ||
        summary.activeEnergyKilocalories !== undefined ||
        summary.workouts.length > 0)
  );

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Today’s fitness context"
        description="Observed Apple Health activity may provide context for glucose patterns, but it does not establish cause."
      />
      {!connected ? (
        <StatePanel
          icon={<Footprints size={30} color={palette.textMuted} />}
          title="Apple Health is not selected"
          message="Connect Apple Health in Settings to display any step, active-energy, and workout records you choose to share."
          action={
            <AppButton
              label="Open Settings"
              variant="secondary"
              onPress={onConnect}
            />
          }
        />
      ) : isLoading ? (
        <StatePanel
          loading
          title="Loading fitness context"
          message="Reading today’s permitted Apple Health activity records."
        />
      ) : error ? (
        <StatePanel
          title="Fitness context unavailable"
          message={error}
          action={
            <View style={styles.actions}>
              <AppButton label="Try again" variant="secondary" onPress={onRetry} />
              <AppButton label="Review in Settings" variant="ghost" onPress={onConnect} />
            </View>
          }
        />
      ) : summary ? (
        <>
          <MetricGrid>
            <MetricCard
              label="Steps"
              value={formattedNumber(summary.stepCount)}
              helper={summary.stepCount === undefined ? 'No permitted total' : 'observed today'}
            />
            <MetricCard
              label="Active energy"
              value={formattedNumber(summary.activeEnergyKilocalories)}
              helper={
                summary.activeEnergyKilocalories === undefined
                  ? 'No permitted total'
                  : 'kcal observed'
              }
            />
            <MetricCard
              label="Workout time"
              value={formattedNumber(workoutMinutes)}
              helper={workoutMinutes === undefined ? 'No permitted workouts' : 'minutes observed'}
            />
            <MetricCard
              label="Workouts"
              value={summary.workouts.length > 0 ? String(summary.workouts.length) : '—'}
              helper={summary.workouts.length > 0 ? 'observed today' : 'No permitted records'}
            />
          </MetricGrid>

          {summary.workouts.length > 0 ? (
            <Card style={styles.workoutCard} accessibilityLabel="Recent Apple Health workouts">
              <View style={styles.workoutTitleRow}>
                <Activity size={20} color={palette.purple} />
                <AppText variant="bodyStrong">Recent workouts</AppText>
              </View>
              {summary.workouts
                .slice()
                .reverse()
                .slice(0, 3)
                .map((workout, index) => (
                  <View
                    key={workout.id}
                    style={[styles.workoutRow, index > 0 && styles.dividedRow]}
                    accessibilityLabel={`${workout.activityType}, ${workout.durationMinutes} minutes, started ${formatReadingTime(workout.startTime)}`}>
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong">{workout.activityType}</AppText>
                      <AppText variant="caption" color={palette.textMuted}>
                        Started {formatReadingTime(workout.startTime)}
                        {workout.sourceName ? ` · ${workout.sourceName}` : ''}
                      </AppText>
                    </View>
                    <AppText color={palette.textMuted}>
                      {Math.round(workout.durationMinutes)} min
                    </AppText>
                  </View>
                ))}
            </Card>
          ) : null}

          {!hasFitnessData ? (
            <Card style={styles.emptyNotice} accessibilityRole="summary">
              <AppText variant="bodyStrong">No permitted fitness records today</AppText>
              <AppText variant="caption" color={palette.textMuted}>
                This can mean no activity was recorded or that read access was not allowed.
                GlucoFinity cannot distinguish those cases on iOS.
              </AppText>
            </Card>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  workoutCard: { gap: spacing.md },
  workoutTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  workoutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dividedRow: {
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  emptyNotice: { gap: spacing.xs, backgroundColor: palette.surfaceMuted },
  actions: { gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
});
