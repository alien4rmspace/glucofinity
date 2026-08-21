import { Image } from 'expo-image';
import { ChevronRight, Trash2, Utensils } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatMealDateTime } from '@/utils/date';
import { palette, radii, spacing } from '@/constants/design';
import type { MealEntry } from '@/types/health';
import { AppText } from './ui/app-text';
import { Card } from './ui/card';

interface MealCardProps {
  meal: MealEntry;
  onPress?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}

export function MealCard({ meal, onPress, onDelete, compact = false }: MealCardProps) {
  const nutrition = [
    meal.estimatedCarbsGrams === undefined ? null : `${meal.estimatedCarbsGrams}g carbs`,
    meal.proteinGrams === undefined ? null : `${meal.proteinGrams}g protein`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card padded={false}>
      <View style={[styles.row, compact && styles.compactRow]}>
        <Pressable
          accessibilityRole={onPress ? 'button' : undefined}
          accessibilityLabel={`${meal.name}, ${formatMealDateTime(meal.timestamp)}${nutrition ? `, ${nutrition}` : ''}`}
          accessibilityHint={onPress ? 'Opens this meal for editing' : undefined}
          disabled={!onPress}
          onPress={onPress}
          style={({ pressed }) => [styles.mainAction, pressed && styles.pressed]}>
          {meal.imageUri ? (
            <Image source={{ uri: meal.imageUri }} style={styles.image} contentFit="cover" />
          ) : (
            <View style={styles.placeholder}>
              <Utensils size={22} color={palette.purple} />
            </View>
          )}
          <View style={styles.copy}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {meal.name}
            </AppText>
            <AppText variant="caption" color={palette.textMuted}>
              {formatMealDateTime(meal.timestamp)}
            </AppText>
            {nutrition ? (
              <AppText variant="caption" color={palette.textMuted} numberOfLines={1}>
                {nutrition}
              </AppText>
            ) : null}
          </View>
          {!onDelete && onPress ? <ChevronRight size={20} color={palette.textMuted} /> : null}
        </Pressable>
        {onDelete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${meal.name}`}
            hitSlop={10}
            onPress={onDelete}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Trash2 size={20} color={palette.red} />
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 88,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainAction: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  compactRow: {
    minHeight: 76,
  },
  image: {
    width: 58,
    height: 58,
    borderRadius: radii.sm,
    backgroundColor: palette.surfaceMuted,
  },
  placeholder: {
    width: 58,
    height: 58,
    borderRadius: radii.sm,
    backgroundColor: palette.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  iconButton: {
    width: 44,
    height: 44,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  pressed: {
    opacity: 0.7,
  },
});
