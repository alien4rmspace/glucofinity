import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

import { palette, radii, spacing } from '@/constants/design';

interface CardProps extends ViewProps {
  padded?: boolean;
}

export function Card({ children, style, padded = true, ...props }: PropsWithChildren<CardProps>) {
  return (
    <View {...props} style={[styles.card, padded && styles.padded, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(16, 42, 67, 0.05)' },
      default: {
        shadowColor: palette.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  padded: {
    padding: spacing.lg,
  },
});
