import { router, useLocalSearchParams } from 'expo-router';
import { Trash2, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { StatePanel } from '@/components/ui/state-panel';
import { palette, radii, spacing } from '@/constants/design';
import { useAppData } from '@/hooks/use-app-data';
import {
  FEELING_SENSATIONS,
  feelingRatingLabel,
} from '@/services/feeling-check-ins';
import type {
  FeelingCheckIn,
  FeelingRating,
  FeelingSensation,
} from '@/types/health';
import { formatMealDateTime } from '@/utils/date';

type CheckInRouteParams = { id: string | string[] };

function firstRouteParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function FeelingCheckInFormScreen() {
  const params = useLocalSearchParams<CheckInRouteParams>();
  const checkInId = firstRouteParam(params.id);
  const isNew = checkInId === 'new';
  const {
    feelingCheckIns,
    isLoading,
    saveFeelingCheckIn,
    deleteFeelingCheckIn,
  } = useAppData();
  const existingCheckIn = useMemo(
    () => feelingCheckIns.find((checkIn) => checkIn.id === checkInId),
    [checkInId, feelingCheckIns],
  );
  const [initialized, setInitialized] = useState(false);
  const [timestamp, setTimestamp] = useState('');
  const [overallFeeling, setOverallFeeling] = useState<FeelingRating>();
  const [energy, setEnergy] = useState<FeelingRating>();
  const [stress, setStress] = useState<FeelingRating>();
  const [focus, setFocus] = useState<FeelingRating>();
  const [hunger, setHunger] = useState<FeelingRating>();
  const [sensations, setSensations] = useState<FeelingSensation[]>([]);
  const [notes, setNotes] = useState('');
  const [overallError, setOverallError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isLoading || initialized) return;
    setTimestamp(existingCheckIn?.timestamp ?? new Date().toISOString());
    setOverallFeeling(existingCheckIn?.overallFeeling);
    setEnergy(existingCheckIn?.energy);
    setStress(existingCheckIn?.stress);
    setFocus(existingCheckIn?.focus);
    setHunger(existingCheckIn?.hunger);
    setSensations(existingCheckIn?.sensations ?? []);
    setNotes(existingCheckIn?.notes ?? '');
    setInitialized(true);
  }, [existingCheckIn, initialized, isLoading]);

  function toggleSensation(value: FeelingSensation) {
    setSensations((current) => current.includes(value)
      ? current.filter((candidate) => candidate !== value)
      : [...current, value]);
  }

  async function submit() {
    if (!overallFeeling) {
      setOverallError('Choose an overall feeling before saving.');
      return;
    }
    setOverallError(undefined);
    setIsSaving(true);
    try {
      const recordedAt = new Date(timestamp);
      const checkIn: FeelingCheckIn = {
        id: existingCheckIn?.id ?? `feeling-${Date.now()}`,
        timestamp: recordedAt.toISOString(),
        timezoneOffsetMinutes:
          existingCheckIn?.timezoneOffsetMinutes ?? recordedAt.getTimezoneOffset(),
        overallFeeling,
        ...(energy === undefined ? {} : { energy }),
        ...(stress === undefined ? {} : { stress }),
        ...(focus === undefined ? {} : { focus }),
        ...(hunger === undefined ? {} : { hunger }),
        sensations,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        source: 'manual',
      };
      await saveFeelingCheckIn(checkIn);
      router.back();
    } catch (caughtError) {
      Alert.alert(
        'Check-in not saved',
        caughtError instanceof Error ? caughtError.message : 'The check-in could not be saved.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDelete() {
    if (!existingCheckIn) return;
    Alert.alert('Delete feeling check-in?', 'This check-in will be removed from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void deleteFeelingCheckIn(existingCheckIn.id).then(() => router.back()),
      },
    ]);
  }

  if (isLoading || !initialized) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <StatePanel loading title="Loading check-in" message="Preparing the local form." />
        </View>
      </SafeAreaView>
    );
  }

  if (!isNew && !existingCheckIn) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <StatePanel
            title="Check-in not found"
            message="This feeling check-in may have been deleted."
            action={<AppButton label="Close" onPress={() => router.back()} />}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close feeling check-in form"
            hitSlop={10}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <X size={24} color={palette.text} />
          </Pressable>
          <AppText variant="subtitle">{isNew ? 'Feeling check-in' : 'Edit check-in'}</AppText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.flex}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          <Card style={styles.introCard} accessibilityRole="summary">
            <AppText variant="subtitle" color={palette.navy}>How are you feeling right now?</AppText>
            <AppText variant="caption" color={palette.textMuted}>
              {isNew
                ? `Started ${formatMealDateTime(timestamp)}. Overall feeling is required; everything else is optional.`
                : `Recorded ${formatMealDateTime(timestamp)}. You can revise the self-reported details.`}
            </AppText>
          </Card>

          <Card style={styles.formCard}>
            <RatingScale
              label="Overall feeling"
              value={overallFeeling}
              onChange={(value) => {
                setOverallFeeling(value);
                setOverallError(undefined);
              }}
              required
              lowLabel="Very difficult"
              highLabel="Very good"
              valueLabel={feelingRatingLabel}
            />
            {overallError ? <AppText variant="caption" color={palette.red}>{overallError}</AppText> : null}
          </Card>

          <Card style={styles.formCard}>
            <AppText variant="subtitle">Optional details</AppText>
            <AppText variant="caption" color={palette.textMuted}>
              Separate ratings make future comparisons more consistent than notes alone.
            </AppText>
            <RatingScale label="Energy" value={energy} onChange={setEnergy} lowLabel="Low energy" highLabel="High energy" />
            <RatingScale label="Stress" value={stress} onChange={setStress} lowLabel="Low stress" highLabel="High stress" />
            <RatingScale label="Focus" value={focus} onChange={setFocus} lowLabel="Difficult to focus" highLabel="Clear focus" />
            <RatingScale label="Hunger" value={hunger} onChange={setHunger} lowLabel="Not hungry" highLabel="Very hungry" />
          </Card>

          <Card style={styles.formCard}>
            <View style={styles.fieldHeading}>
              <AppText variant="bodyStrong">What are you noticing? (optional)</AppText>
              {sensations.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear selected sensations"
                  onPress={() => setSensations([])}
                  hitSlop={8}>
                  <AppText variant="caption" color={palette.blue}>Clear</AppText>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.chipList}>
              {FEELING_SENSATIONS.map(({ value, label }) => {
                const selected = sensations.includes(value);
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="checkbox"
                    accessibilityLabel={label}
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggleSensation(value)}
                    style={({ pressed }) => [
                      styles.sensationChip,
                      selected && styles.sensationChipSelected,
                      pressed && styles.pressed,
                    ]}>
                    <AppText
                      variant="caption"
                      color={selected ? palette.purple : palette.text}>
                      {label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card style={styles.formCard}>
            <FormField
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything else you want to remember"
              helper={`${notes.length}/500 characters`}
              maxLength={500}
              multiline
            />
          </Card>

          <AppText variant="caption" color={palette.textMuted}>
            This records your description without interpreting symptoms or providing medical guidance. Future glucose comparisons will describe associations and cannot establish cause.
          </AppText>

          {!isNew ? (
            <AppButton
              label="Delete check-in"
              variant="danger"
              icon={<Trash2 size={18} color={palette.red} />}
              onPress={confirmDelete}
            />
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <AppButton
            label={isNew ? 'Save check-in' : 'Save changes'}
            loading={isSaving}
            onPress={() => void submit()}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RatingScale({
  label,
  value,
  onChange,
  required = false,
  lowLabel,
  highLabel,
  valueLabel = (rating) => `${rating}/5`,
}: {
  label: string;
  value?: FeelingRating;
  onChange: (value: FeelingRating | undefined) => void;
  required?: boolean;
  lowLabel: string;
  highLabel: string;
  valueLabel?: (rating: FeelingRating) => string;
}) {
  return (
    <View style={styles.ratingGroup}>
      <View style={styles.fieldHeading}>
        <AppText variant="bodyStrong">{label}{required ? ' *' : ''}</AppText>
        {!required && value !== undefined ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label.toLowerCase()} rating`}
            hitSlop={8}
            onPress={() => onChange(undefined)}>
            <AppText variant="caption" color={palette.blue}>Clear</AppText>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.ratingButtons}>
        {([1, 2, 3, 4, 5] as const).map((rating) => {
          const selected = value === rating;
          return (
            <Pressable
              key={rating}
              accessibilityRole="radio"
              accessibilityLabel={`${label}: ${rating} of 5`}
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(rating)}
              style={({ pressed }) => [
                styles.ratingButton,
                selected && styles.ratingButtonSelected,
                pressed && styles.pressed,
              ]}>
              <AppText variant="bodyStrong" color={selected ? '#FFFFFF' : palette.text}>
                {rating}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.scaleLabels}>
        <AppText variant="caption" color={palette.textMuted}>{lowLabel}</AppText>
        <AppText variant="caption" color={palette.textMuted}>{highLabel}</AppText>
      </View>
      {value ? (
        <AppText variant="caption" color={palette.purple}>{valueLabel(value)}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  header: {
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    backgroundColor: palette.surface,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  headerSpacer: { width: 44 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  loadingWrap: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  introCard: { gap: spacing.sm, backgroundColor: palette.purpleSoft },
  formCard: { gap: spacing.lg },
  ratingGroup: { gap: spacing.sm },
  fieldHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  ratingButtons: { flexDirection: 'row', gap: spacing.sm },
  ratingButton: {
    flex: 1,
    minWidth: 44,
    minHeight: 44,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.sm,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingButtonSelected: { backgroundColor: palette.purple, borderColor: palette.purple },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sensationChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.pill,
    backgroundColor: palette.surface,
  },
  sensationChipSelected: {
    borderColor: palette.purple,
    backgroundColor: palette.purpleSoft,
  },
  footer: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
  },
  pressed: { opacity: 0.76 },
});
