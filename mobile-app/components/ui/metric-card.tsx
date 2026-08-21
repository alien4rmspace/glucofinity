import { StyleSheet, View } from 'react-native';

import { palette, spacing } from '@/constants/design';
import { AppText } from './app-text';
import { Card } from './card';

interface MetricCardProps {
  label: string;
  value: string;
  helper?: string;
}

export function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <Card style={styles.card} accessibilityLabel={`${label}: ${value}${helper ? `, ${helper}` : ''}`}>
      <AppText variant="caption" color={palette.textMuted}>
        {label}
      </AppText>
      <AppText variant="title">{value}</AppText>
      {helper ? (
        <AppText variant="caption" color={palette.textMuted}>
          {helper}
        </AppText>
      ) : null}
    </Card>
  );
}

export function MetricGrid({ children }: React.PropsWithChildren) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    minWidth: '46%',
    flexGrow: 1,
    flexBasis: 0,
    gap: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});
