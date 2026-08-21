import { router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, CheckCircle2, Trash2, X } from 'lucide-react-native';
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
import { FormField, FormRow } from '@/components/ui/form-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatePanel } from '@/components/ui/state-panel';
import {
  VoiceMedicationEntry,
  type AppliedVoiceMedicationDraft,
} from '@/components/voice-medication-entry';
import { palette, spacing } from '@/constants/design';
import { useAppData } from '@/hooks/use-app-data';
import {
  findPotentialDuplicateMedicationLog,
  MEDICATION_DOSE_UNITS,
  MEDICATION_ROUTES,
} from '@/services/medication-logs';
import type {
  MedicationDoseUnit,
  MedicationEntry,
  MedicationLogStatus,
  MedicationRoute,
} from '@/types/health';
import {
  formatMealDateTime,
  parseLocalDateTime,
  toDateInputValue,
  toTimeInputValue,
} from '@/utils/date';

type MedicationRouteParams = { id: string | string[] };

const statusOptions: { label: string; value: MedicationLogStatus }[] = [
  { label: 'Taken', value: 'taken' },
  { label: 'Skipped', value: 'skipped' },
  { label: 'Missed', value: 'missed' },
];

const routeOptions: { label: string; value: MedicationRoute | 'not-recorded' }[] = [
  { label: 'Not recorded', value: 'not-recorded' },
  ...MEDICATION_ROUTES,
];

function firstRouteParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function MedicationLogFormScreen() {
  const params = useLocalSearchParams<MedicationRouteParams>();
  const medicationId = firstRouteParam(params.id);
  const isNew = medicationId === 'new';
  const {
    medicationEntries,
    isLoading,
    saveMedicationEntry,
    deleteMedicationEntry,
  } = useAppData();
  const existingEntry = useMemo(
    () => medicationEntries.find((entry) => entry.id === medicationId),
    [medicationEntries, medicationId],
  );
  const [initialized, setInitialized] = useState(false);
  const [medicationName, setMedicationName] = useState('');
  const [dateValue, setDateValue] = useState('');
  const [timeValue, setTimeValue] = useState('');
  const [doseAmount, setDoseAmount] = useState('');
  const [doseUnit, setDoseUnit] = useState<MedicationDoseUnit>('mg');
  const [route, setRoute] = useState<MedicationRoute | 'not-recorded'>('not-recorded');
  const [status, setStatus] = useState<MedicationLogStatus>('taken');
  const [notes, setNotes] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [dateTimeError, setDateTimeError] = useState<string>();
  const [doseError, setDoseError] = useState<string>();
  const [duplicateEntry, setDuplicateEntry] = useState<MedicationEntry>();
  const [lastSavedMedicationName, setLastSavedMedicationName] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isLoading || initialized) return;
    const timestamp = existingEntry?.timestamp ?? new Date().toISOString();
    setMedicationName(existingEntry?.medicationName ?? '');
    setDateValue(toDateInputValue(timestamp));
    setTimeValue(toTimeInputValue(timestamp));
    setDoseAmount(existingEntry?.doseAmount === undefined ? '' : String(existingEntry.doseAmount));
    setDoseUnit(existingEntry?.doseUnit ?? 'mg');
    setRoute(existingEntry?.route ?? 'not-recorded');
    setStatus(existingEntry?.status ?? 'taken');
    setNotes(existingEntry?.notes ?? '');
    setInitialized(true);
  }, [existingEntry, initialized, isLoading]);

  function buildEntry(): MedicationEntry | undefined {
    const trimmedName = medicationName.trim();
    const timestamp = parseLocalDateTime(dateValue, timeValue);
    const trimmedDose = doseAmount.trim();
    const parsedDose = trimmedDose ? Number(trimmedDose) : undefined;
    const nextNameError = !trimmedName
      ? 'Enter the medication name.'
      : trimmedName.length > 120
        ? 'Use 120 characters or fewer.'
        : undefined;
    const nextDateTimeError = timestamp
      ? undefined
      : 'Use a valid date (YYYY-MM-DD) and time (HH:mm).';
    const nextDoseError = parsedDose !== undefined &&
      (!Number.isFinite(parsedDose) || parsedDose <= 0 || parsedDose > 1_000_000)
      ? 'Enter a dose greater than 0 using numbers only.'
      : undefined;

    setNameError(nextNameError);
    setDateTimeError(nextDateTimeError);
    setDoseError(nextDoseError);
    if (nextNameError || nextDateTimeError || nextDoseError || !timestamp) return undefined;

    return {
      id: existingEntry?.id ?? `medication-${Date.now()}`,
      timestamp: timestamp.toISOString(),
      timezoneOffsetMinutes:
        existingEntry?.timezoneOffsetMinutes ?? timestamp.getTimezoneOffset(),
      medicationName: trimmedName,
      ...(parsedDose === undefined ? {} : { doseAmount: parsedDose, doseUnit }),
      ...(route === 'not-recorded' ? {} : { route }),
      status,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      source: 'manual',
    };
  }

  function resetNewEntryForm() {
    const timestamp = new Date().toISOString();
    setMedicationName('');
    setDateValue(toDateInputValue(timestamp));
    setTimeValue(toTimeInputValue(timestamp));
    setDoseAmount('');
    setDoseUnit('mg');
    setRoute('not-recorded');
    setStatus('taken');
    setNotes('');
    setNameError(undefined);
    setDateTimeError(undefined);
    setDoseError(undefined);
    setDuplicateEntry(undefined);
  }

  function applyVoiceDraft(draft: AppliedVoiceMedicationDraft) {
    setMedicationName(draft.medicationName);
    setStatus(draft.status);
    if (draft.doseAmount !== undefined && draft.doseUnit) {
      setDoseAmount(String(draft.doseAmount));
      setDoseUnit(draft.doseUnit);
    } else {
      setDoseAmount('');
    }
    setRoute(draft.route ?? 'not-recorded');
    if (draft.occurredAt) {
      setDateValue(toDateInputValue(draft.occurredAt));
      setTimeValue(toTimeInputValue(draft.occurredAt));
    }
    setNameError(undefined);
    setDateTimeError(undefined);
    setDoseError(undefined);
    setDuplicateEntry(undefined);
    setLastSavedMedicationName(undefined);
  }

  async function submit(confirmedDuplicate = false) {
    setDuplicateEntry(undefined);
    const entry = buildEntry();
    if (!entry) return;
    const possibleDuplicate = findPotentialDuplicateMedicationLog(
      medicationEntries,
      entry,
    );
    if (possibleDuplicate && !confirmedDuplicate) {
      setDuplicateEntry(possibleDuplicate);
      return;
    }

    setIsSaving(true);
    try {
      await saveMedicationEntry(entry);
      if (isNew) {
        setLastSavedMedicationName(entry.medicationName);
        resetNewEntryForm();
      } else {
        router.back();
      }
    } catch (caughtError) {
      Alert.alert(
        'Medication log not saved',
        caughtError instanceof Error
          ? caughtError.message
          : 'The medication log could not be saved.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDelete() {
    if (!existingEntry) return;
    Alert.alert(
      'Delete medication log?',
      `${existingEntry.medicationName} will be removed from this device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void deleteMedicationEntry(existingEntry.id).then(() => router.back()),
        },
      ],
    );
  }

  if (isLoading || !initialized) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <StatePanel loading title="Loading medication log" message="Preparing the local form." />
        </View>
      </SafeAreaView>
    );
  }

  if (!isNew && !existingEntry) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <StatePanel
            title="Medication log not found"
            message="This user-recorded entry may have been deleted."
            action={<AppButton label="Close" onPress={() => router.back()} />}
          />
        </View>
      </SafeAreaView>
    );
  }

  const displayedTimestamp = parseLocalDateTime(dateValue, timeValue)?.toISOString();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close medication log form"
            hitSlop={10}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <X size={24} color={palette.text} />
          </Pressable>
          <AppText variant="subtitle">{isNew ? 'Medication log' : 'Edit medication log'}</AppText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.flex}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          <Card style={styles.introCard} accessibilityRole="summary">
            <AppText variant="subtitle" color={palette.navy}>Record a medication event</AppText>
            <AppText variant="caption" color={palette.textMuted}>
              {displayedTimestamp
                ? `${isNew ? 'Started' : 'Recorded'} ${formatMealDateTime(displayedTimestamp)}.`
                : 'Enter when this event occurred.'}{' '}
              This is a user-entered record and does not verify a prescription.
            </AppText>
          </Card>

          {isNew ? <VoiceMedicationEntry onApply={applyVoiceDraft} /> : null}

          {lastSavedMedicationName ? (
            <Card style={styles.savedCard} accessibilityRole="summary">
              <CheckCircle2 size={20} color={palette.green} />
              <View style={styles.flex}>
                <AppText variant="bodyStrong" color={palette.green}>
                  Medication event added
                </AppText>
                <AppText variant="caption" color={palette.textMuted}>
                  {lastSavedMedicationName} was saved. Add another event or close this screen when you are finished.
                </AppText>
              </View>
            </Card>
          ) : null}

          {duplicateEntry ? (
            <Card style={styles.warningCard} accessibilityRole="alert">
              <View style={styles.warningHeading}>
                <AlertTriangle size={20} color={palette.amber} />
                <AppText variant="bodyStrong" color={palette.navy}>Possible duplicate</AppText>
              </View>
              <AppText variant="caption" color={palette.textMuted}>
                {duplicateEntry.medicationName} was already recorded as taken at{' '}
                {formatMealDateTime(duplicateEntry.timestamp)}. Review the time before saving another entry.
              </AppText>
              <AppButton
                label="Save another entry anyway"
                variant="ghost"
                onPress={() => void submit(true)}
              />
            </Card>
          ) : null}

          <Card style={styles.formCard}>
            <FormField
              label="Medication name *"
              value={medicationName}
              onChangeText={(value) => {
                setMedicationName(value);
                setNameError(undefined);
                setDuplicateEntry(undefined);
              }}
              placeholder="Medication name"
              autoCapitalize="words"
              error={nameError}
              maxLength={120}
            />
            <SegmentedControl
              label="Medication event status"
              options={statusOptions}
              value={status}
              onChange={(value) => {
                setStatus(value);
                setDuplicateEntry(undefined);
              }}
            />
          </Card>

          <Card style={styles.formCard}>
            <AppText variant="subtitle">When</AppText>
            <FormRow>
              <FormField
                label="Date *"
                value={dateValue}
                onChangeText={(value) => {
                  setDateValue(value);
                  setDateTimeError(undefined);
                  setDuplicateEntry(undefined);
                }}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
                error={dateTimeError}
              />
              <FormField
                label="Time *"
                value={timeValue}
                onChangeText={(value) => {
                  setTimeValue(value);
                  setDateTimeError(undefined);
                  setDuplicateEntry(undefined);
                }}
                placeholder="HH:mm"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
            </FormRow>
          </Card>

          <Card style={styles.formCard}>
            <AppText variant="subtitle">Dose (optional)</AppText>
            <FormField
              label="Amount"
              value={doseAmount}
              onChangeText={(value) => {
                setDoseAmount(value);
                setDoseError(undefined);
              }}
              placeholder="For example, 500"
              keyboardType="decimal-pad"
              error={doseError}
              helper="Enter only what was recorded or known."
            />
            <SegmentedControl
              label="Medication dose unit"
              options={[...MEDICATION_DOSE_UNITS]}
              value={doseUnit}
              onChange={setDoseUnit}
              wrap
            />
          </Card>

          <Card style={styles.formCard}>
            <AppText variant="subtitle">Route (optional)</AppText>
            <SegmentedControl
              label="Medication route"
              options={routeOptions}
              value={route}
              onChange={setRoute}
              wrap
            />
          </Card>

          <Card style={styles.formCard}>
            <FormField
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything you want to remember"
              helper={`${notes.length}/500 characters`}
              maxLength={500}
              multiline
            />
          </Card>

          <AppText variant="caption" color={palette.textMuted}>
            GlucoFinity records what you enter. It does not prescribe, verify doses, check interactions, or recommend medication changes.
          </AppText>

          {!isNew ? (
            <AppButton
              label="Delete medication log"
              variant="danger"
              icon={<Trash2 size={18} color={palette.red} />}
              onPress={confirmDelete}
            />
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <AppButton
            label={isNew ? 'Add to session' : 'Save changes'}
            loading={isSaving}
            onPress={() => void submit()}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  introCard: { gap: spacing.sm, backgroundColor: palette.cyanSoft },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: palette.greenSoft,
  },
  warningCard: { gap: spacing.md, backgroundColor: palette.amberSoft },
  warningHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  formCard: { gap: spacing.lg },
  footer: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
  },
  pressed: { opacity: 0.76 },
});
