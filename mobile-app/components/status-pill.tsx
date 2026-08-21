import { StyleSheet, View } from 'react-native';

import { palette, radii, spacing } from '@/constants/design';
import type { GlucoseStatus } from '@/types/health';
import { AppText } from './ui/app-text';

const statusDetails: Record<GlucoseStatus, { label: string; foreground: string; background: string }> = {
  'below-range': { label: 'Below range', foreground: palette.red, background: palette.redSoft },
  'in-range': { label: 'In range', foreground: palette.green, background: palette.greenSoft },
  elevated: { label: 'Elevated', foreground: palette.amber, background: palette.amberSoft },
  'very-high': { label: 'Very high', foreground: palette.red, background: palette.redSoft },
};

export function StatusPill({ status }: { status: GlucoseStatus }) {
  const details = statusDetails[status];
  return (
    <View
      accessibilityLabel={`Glucose status: ${details.label}`}
      style={[styles.pill, { backgroundColor: details.background }]}>
      <View style={[styles.dot, { backgroundColor: details.foreground }]} />
      <AppText variant="caption" color={details.foreground} style={styles.label}>
        {details.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontWeight: '700',
  },
});
