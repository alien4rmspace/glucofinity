import { ChevronRight, Pill } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { palette, radii, spacing } from '@/constants/design';
import {
  formatMedicationDose,
  medicationRouteLabel,
  medicationStatusLabel,
} from '@/services/medication-logs';
import type { MedicationEntry } from '@/types/health';
import { formatMealDateTime } from '@/utils/date';

export function MedicationCard({
  entry,
  onPress,
  compact = false,
}: {
  entry: MedicationEntry;
  onPress: () => void;
  compact?: boolean;
}) {
  const dose = formatMedicationDose(entry);
  const details = [
    dose,
    entry.route ? medicationRouteLabel(entry.route) : undefined,
  ].filter((detail): detail is string => Boolean(detail));
  const statusColor = entry.status === 'taken'
    ? palette.green
    : entry.status === 'missed'
      ? palette.red
      : palette.amber;
  const statusBackground = entry.status === 'taken'
    ? palette.greenSoft
    : entry.status === 'missed'
      ? palette.redSoft
      : palette.amberSoft;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.medicationName}, ${medicationStatusLabel(entry.status)}, ${formatMealDateTime(entry.timestamp)}${dose ? `, ${dose}` : ''}`}
      accessibilityHint="Open this user-recorded medication log to review or edit it."
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}>
      <Card style={[styles.card, compact && styles.compactCard]}>
        <View style={styles.iconWrap}>
          <Pill size={22} color={palette.cyan} strokeWidth={2.25} />
        </View>
        <View style={styles.copy}>
          <View style={styles.heading}>
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.name}>
              {entry.medicationName}
            </AppText>
            <View style={[styles.status, { backgroundColor: statusBackground }]}>
              <AppText variant="caption" color={statusColor}>
                {medicationStatusLabel(entry.status)}
              </AppText>
            </View>
          </View>
          <AppText variant="caption" color={palette.textMuted}>
            {formatMealDateTime(entry.timestamp)}
          </AppText>
          {details.length > 0 ? (
            <AppText variant="caption" color={palette.textMuted} numberOfLines={1}>
              {details.join(' · ')}
            </AppText>
          ) : null}
          {!compact && entry.notes ? (
            <AppText variant="caption" numberOfLines={2}>
              {entry.notes}
            </AppText>
          ) : null}
        </View>
        <ChevronRight size={20} color={palette.textMuted} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  compactCard: { minHeight: 76 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cyanSoft,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1 },
  status: {
    minHeight: 24,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  pressed: { opacity: 0.78 },
});
