import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { palette, spacing } from '@/constants/design';
import { AppText } from './app-text';
import { Card } from './card';

interface StatePanelProps {
  title: string;
  message: string;
  icon?: ReactNode;
  loading?: boolean;
  action?: ReactNode;
}

export function StatePanel({ title, message, icon, loading = false, action }: StatePanelProps) {
  return (
    <Card style={styles.card} accessibilityRole="summary">
      {loading ? <ActivityIndicator color={palette.blue} size="large" /> : icon}
      <View style={styles.copy}>
        <AppText variant="subtitle" style={styles.centered}>
          {title}
        </AppText>
        <AppText color={palette.textMuted} style={styles.centered}>
          {message}
        </AppText>
      </View>
      {action}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  copy: {
    gap: spacing.xs,
    maxWidth: 300,
  },
  centered: {
    textAlign: 'center',
  },
});
