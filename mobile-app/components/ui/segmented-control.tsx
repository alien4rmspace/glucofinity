import { Pressable, StyleSheet, View } from 'react-native';

import { palette, radii, spacing } from '@/constants/design';
import { AppText } from './app-text';

interface SegmentedOption<T extends string | number> {
  label: string;
  value: T;
}

interface SegmentedControlProps<T extends string | number> {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  wrap?: boolean;
}

export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  wrap = false,
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.group, wrap && styles.groupWrap]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              wrap && styles.optionWrap,
              selected && styles.selected,
              pressed && styles.pressed,
            ]}>
            <AppText
              variant="bodyStrong"
              color={selected ? palette.surface : palette.textMuted}
              style={styles.optionText}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.sm,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  groupWrap: {
    flexWrap: 'wrap',
  },
  option: {
    flex: 1,
    minHeight: 42,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionWrap: {
    flexBasis: '22%',
  },
  selected: {
    backgroundColor: palette.navy,
  },
  pressed: {
    opacity: 0.78,
  },
  optionText: {
    textAlign: 'center',
  },
});
