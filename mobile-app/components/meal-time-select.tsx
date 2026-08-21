import { Check, ChevronDown, Clock, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { palette, radii, spacing } from '@/constants/design';

interface MealTimeSelectProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minutes = (index % 4) * 15;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});

export function nearestLocalMealTime(date = new Date()): string {
  const roundedMinutes = Math.round(date.getMinutes() / 15) * 15;
  const rounded = new Date(date);
  rounded.setMinutes(roundedMinutes, 0, 0);
  return `${String(rounded.getHours()).padStart(2, '0')}:${String(rounded.getMinutes()).padStart(2, '0')}`;
}

export function formatMealTime(value: string): string {
  const [hourValue, minuteValue] = value.split(':').map(Number);
  if (!Number.isInteger(hourValue) || !Number.isInteger(minuteValue)) return value;
  const period = hourValue >= 12 ? 'PM' : 'AM';
  const hour = hourValue % 12 || 12;
  return `${hour}:${String(minuteValue).padStart(2, '0')} ${period}`;
}

export function MealTimeSelect({ value, onChange, label = 'Meal time (local)' }: MealTimeSelectProps) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => TIME_OPTIONS, []);
  return (
    <View style={styles.group}>
      <AppText variant="bodyStrong">{label}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatMealTime(value)}`}
        accessibilityHint="Opens a list of times in 15-minute intervals."
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
        <View style={styles.triggerContent}>
          <Clock size={18} color={palette.blue} />
          <AppText variant="body">{formatMealTime(value)}</AppText>
        </View>
        <ChevronDown size={18} color={palette.textMuted} />
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <View>
              <AppText variant="subtitle">Select meal time</AppText>
              <AppText variant="caption" color={palette.textMuted}>Times are shown in your local timezone.</AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close time picker" onPress={() => setOpen(false)} style={styles.closeButton}>
              <X size={22} color={palette.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.options} showsVerticalScrollIndicator={false}>
            {options.map((option) => {
              const selected = option === value;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}>
                  <AppText variant={selected ? 'bodyStrong' : 'body'} color={selected ? palette.blue : palette.text}>
                    {formatMealTime(option)}
                  </AppText>
                  {selected ? <Check size={19} color={palette.blue} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flex: 1, gap: spacing.sm },
  trigger: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.sm,
    backgroundColor: palette.surface,
  },
  triggerContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  modal: { flex: 1, backgroundColor: palette.background },
  modalHeader: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    backgroundColor: palette.surface,
  },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  options: { padding: spacing.lg, gap: spacing.sm },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.sm,
    backgroundColor: palette.surface,
  },
  optionSelected: { borderColor: palette.blue, backgroundColor: palette.blueSoft },
  pressed: { opacity: 0.76 },
});
