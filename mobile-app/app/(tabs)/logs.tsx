import { router, type Href } from 'expo-router';
import { ClipboardList, HeartPulse, Pill, Plus, ScanBarcode, Utensils, X } from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FeelingCheckInCard } from '@/components/feeling-check-in-card';
import { MealCard } from '@/components/meal-card';
import { MedicationCard } from '@/components/medication-card';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatePanel } from '@/components/ui/state-panel';
import { palette, radii, spacing } from '@/constants/design';
import { useAppData } from '@/hooks/use-app-data';
import type { FeelingCheckIn, MealEntry, MedicationEntry } from '@/types/health';

type LogFilter = 'all' | 'meals' | 'medications' | 'feelings';

type TimelineLog =
  | { id: string; timestamp: string; kind: 'meal'; item: MealEntry }
  | { id: string; timestamp: string; kind: 'medication'; item: MedicationEntry }
  | { id: string; timestamp: string; kind: 'feeling'; item: FeelingCheckIn };

const filterOptions: { label: string; value: LogFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Meals', value: 'meals' },
  { label: 'Meds', value: 'medications' },
  { label: 'Feelings', value: 'feelings' },
];

export default function LogsScreen() {
  const {
    feelingCheckIns,
    meals,
    medicationEntries,
    isLoading,
    error,
    refresh,
  } = useAppData();
  const [filter, setFilter] = useState<LogFilter>('all');
  const [showAddChoices, setShowAddChoices] = useState(false);
  const timeline = useMemo<TimelineLog[]>(
    () => [
      ...meals.map((item) => ({
        id: `meal:${item.id}`,
        timestamp: item.timestamp,
        kind: 'meal' as const,
        item,
      })),
      ...medicationEntries.map((item) => ({
        id: `medication:${item.id}`,
        timestamp: item.timestamp,
        kind: 'medication' as const,
        item,
      })),
      ...feelingCheckIns.map((item) => ({
        id: `feeling:${item.id}`,
        timestamp: item.timestamp,
        kind: 'feeling' as const,
        item,
      })),
    ].sort((first, second) => Date.parse(second.timestamp) - Date.parse(first.timestamp)),
    [feelingCheckIns, meals, medicationEntries],
  );
  const filteredTimeline = timeline.filter((entry) =>
    filter === 'all' ||
    (filter === 'meals' && entry.kind === 'meal') ||
    (filter === 'medications' && entry.kind === 'medication') ||
    (filter === 'feelings' && entry.kind === 'feeling')
  );

  const emptyMessage = filter === 'all'
    ? 'Add a meal, medication event, or feeling check-in to build a reviewable timeline.'
    : filter === 'meals'
      ? 'No meals have been recorded yet.'
      : filter === 'medications'
        ? 'No user-recorded medication events yet.'
        : 'No feeling check-ins have been recorded yet.';

  return (
    <Screen testID="logs-screen" refreshing={isLoading} onRefresh={() => void refresh()}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText variant="title" color={palette.navy}>Logs</AppText>
          <AppText color={palette.textMuted}>
            Review daily context in one chronological timeline.
          </AppText>
        </View>
        <AppButton
          label={showAddChoices ? 'Close' : 'Add log'}
          icon={showAddChoices
            ? <X size={19} color="#FFFFFF" />
            : <Plus size={19} color="#FFFFFF" />}
          onPress={() => setShowAddChoices((current) => !current)}
        />
      </View>

      {showAddChoices ? (
        <Card style={styles.addCard} accessibilityRole="summary">
          <AppText variant="bodyStrong" color={palette.navy}>Add context or review a product</AppText>
          <View style={styles.addChoices}>
            <AddLogChoice
              label="Meal"
              icon={<Utensils size={21} color={palette.purple} />}
              color={palette.purpleSoft}
              onPress={() => router.push({ pathname: '/meal/[id]', params: { id: 'new' } })}
            />
            <AddLogChoice
              label="Medication"
              icon={<Pill size={21} color={palette.cyan} />}
              color={palette.cyanSoft}
              onPress={() => router.push('/medication/new' as Href)}
            />
            <AddLogChoice
              label="Feeling"
              icon={<HeartPulse size={21} color={palette.blue} />}
              color={palette.blueSoft}
              onPress={() => router.push('/check-in/new' as Href)}
            />
            <AddLogChoice
              label="Scan product"
              accessibilityLabel="Open product barcode scanner"
              icon={<ScanBarcode size={21} color={palette.green} />}
              color={palette.greenSoft}
              onPress={() => router.push('/product-scan' as Href)}
            />
          </View>
        </Card>
      ) : null}

      <SegmentedControl
        label="Filter logs"
        options={filterOptions}
        value={filter}
        onChange={setFilter}
      />

      {isLoading ? (
        <StatePanel loading title="Loading logs" message="Reading locally stored entries." />
      ) : error ? (
        <StatePanel
          title="Logs unavailable"
          message={error}
          action={<AppButton label="Try again" variant="secondary" onPress={() => void refresh()} />}
        />
      ) : filteredTimeline.length === 0 ? (
        <StatePanel
          icon={<ClipboardList size={32} color={palette.blue} />}
          title={filter === 'all' ? 'No logs yet' : `No ${filter} logs`}
          message={emptyMessage}
          action={timeline.length === 0
            ? <AppButton label="Add your first log" onPress={() => setShowAddChoices(true)} />
            : undefined}
        />
      ) : (
        <View style={styles.list}>
          {filteredTimeline.map((entry) => {
            if (entry.kind === 'meal') {
              return (
                <MealCard
                  key={entry.id}
                  meal={entry.item}
                  compact
                  onPress={() => router.push({
                    pathname: '/meal/[id]',
                    params: { id: entry.item.id },
                  })}
                />
              );
            }
            if (entry.kind === 'medication') {
              return (
                <MedicationCard
                  key={entry.id}
                  entry={entry.item}
                  compact
                  onPress={() => router.push(`/medication/${entry.item.id}` as Href)}
                />
              );
            }
            return (
              <FeelingCheckInCard
                key={entry.id}
                checkIn={entry.item}
                compact
                onPress={() => router.push(`/check-in/${entry.item.id}` as Href)}
              />
            );
          })}
        </View>
      )}

      <AppText variant="caption" color={palette.textMuted} style={styles.note}>
        Medication events and feeling check-ins are user-recorded. Nutrition values are optional estimates. These logs provide context and do not verify prescriptions or establish what caused a glucose pattern.
      </AppText>
    </Screen>
  );
}

function AddLogChoice({
  label,
  accessibilityLabel,
  icon,
  color,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  icon: ReactNode;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Add ${label.toLowerCase()} log`}
      onPress={onPress}
      style={({ pressed }) => [styles.addChoice, { backgroundColor: color }, pressed && styles.pressed]}>
      {icon}
      <AppText variant="caption" color={palette.navy} style={styles.addChoiceLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: { flex: 1, gap: spacing.xs },
  addCard: { gap: spacing.md },
  addChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  addChoice: {
    flex: 1,
    minWidth: 80,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
  },
  addChoiceLabel: { textAlign: 'center' },
  list: { gap: spacing.md },
  note: { textAlign: 'center', paddingHorizontal: spacing.lg },
  pressed: { opacity: 0.76 },
});
