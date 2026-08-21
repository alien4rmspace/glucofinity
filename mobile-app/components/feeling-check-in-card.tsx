import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { palette, spacing } from '@/constants/design';
import {
  feelingRatingLabel,
  feelingSensationLabel,
} from '@/services/feeling-check-ins';
import type { FeelingCheckIn } from '@/types/health';
import { formatMealDateTime } from '@/utils/date';

export function FeelingCheckInCard({
  checkIn,
  onPress,
  compact = false,
}: {
  checkIn: FeelingCheckIn;
  onPress: () => void;
  compact?: boolean;
}) {
  const details = [
    checkIn.energy === undefined ? undefined : `Energy ${checkIn.energy}/5`,
    checkIn.stress === undefined ? undefined : `Stress ${checkIn.stress}/5`,
    checkIn.focus === undefined ? undefined : `Focus ${checkIn.focus}/5`,
    checkIn.hunger === undefined ? undefined : `Hunger ${checkIn.hunger}/5`,
  ].filter((detail): detail is string => Boolean(detail));
  const sensationLabels = checkIn.sensations.map(feelingSensationLabel);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${feelingRatingLabel(checkIn.overallFeeling)} feeling check-in from ${formatMealDateTime(checkIn.timestamp)}`}
      accessibilityHint="Open this feeling check-in to review or edit it."
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.card}>
        <View style={styles.heading}>
          <View style={styles.flex}>
            <AppText variant="bodyStrong" color={palette.navy}>
              {feelingRatingLabel(checkIn.overallFeeling)}
            </AppText>
            <AppText variant="caption" color={palette.textMuted}>
              {formatMealDateTime(checkIn.timestamp)}
            </AppText>
          </View>
          <AppText variant="label" color={palette.purple}>
            {checkIn.overallFeeling}/5
          </AppText>
        </View>
        {!compact && details.length > 0 ? (
          <AppText variant="caption" color={palette.textMuted}>
            {details.join(' · ')}
          </AppText>
        ) : null}
        {!compact && sensationLabels.length > 0 ? (
          <AppText variant="caption" color={palette.textMuted}>
            Noticed: {sensationLabels.join(', ')}
          </AppText>
        ) : null}
        {!compact && checkIn.notes ? (
          <AppText variant="caption" numberOfLines={2}>
            {checkIn.notes}
          </AppText>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1 },
  pressed: { opacity: 0.78 },
});
