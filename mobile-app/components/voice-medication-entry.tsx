import { AudioModule } from 'expo-audio';
import type { EventSubscription } from 'expo-modules-core';
import { CheckCircle2, Download, Mic, RefreshCw, ShieldCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { StatePanel } from '@/components/ui/state-panel';
import { palette, radii, spacing } from '@/constants/design';
import { useLocalMealModel } from '@/providers/local-meal-model-provider';
import {
  appleSpeechService,
  type AppleSpeechAvailability,
} from '@/services/apple-speech-service';
import { mergeLiveSpeechTranscript } from '@/services/live-speech-transcript';
import { localMealLanguageProvider } from '@/services/local-meal-language-provider';
import {
  extractGroundedMedicationFromTranscript,
  refineMedicationTranscript,
  type MedicationTranscriptExtraction,
} from '@/services/medication-transcript-extraction';
import { hasUnprocessedTranscriptChanges } from '@/services/voice-transcript-review';
import type { MedicationLogStatus } from '@/types/health';

export type AppliedVoiceMedicationDraft = MedicationTranscriptExtraction & {
  medicationName: string;
  status: MedicationLogStatus;
};

interface VoiceMedicationDraft {
  sourceTranscript: string;
  transcript: string;
  processedTranscript: string;
}

interface VoiceMedicationEntryProps {
  onApply: (draft: AppliedVoiceMedicationDraft) => void;
}

export function VoiceMedicationEntry({ onApply }: VoiceMedicationEntryProps) {
  const liveSubscription = useRef<EventSubscription | undefined>(undefined);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const recordingStartedAt = useRef<number | undefined>(undefined);
  const liveTranscriptRef = useRef('');
  const recordingHoldActive = useRef(false);
  const recordingActive = useRef(false);
  const recordingStartInProgress = useRef(false);
  const {
    access: localModelAccess,
    state: localModelState,
    progress: modelProgress,
    error: localModelError,
    retry: retryLocalModelPreparation,
  } = useLocalMealModel();
  const [speechAvailability, setSpeechAvailability] = useState<AppleSpeechAvailability>();
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [voiceDraft, setVoiceDraft] = useState<VoiceMedicationDraft>();

  useEffect(() => {
    let active = true;
    void appleSpeechService.getAvailability().then((speech) => {
      if (active) setSpeechAvailability(speech);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => {
    recordingHoldActive.current = false;
    recordingActive.current = false;
    recordingStartInProgress.current = false;
    liveSubscription.current?.remove();
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    void appleSpeechService.cancelLiveTranscription();
    localMealLanguageProvider.release();
  }, []);

  function replaceLiveTranscript(value: string) {
    liveTranscriptRef.current = value;
    setLiveTranscript(value);
  }

  function accumulateLiveTranscript(value: string) {
    replaceLiveTranscript(mergeLiveSpeechTranscript(liveTranscriptRef.current, value));
  }

  async function startVoiceRecording(): Promise<boolean> {
    if (recordingActive.current || recordingStartInProgress.current) return false;
    if (localModelState !== 'ready') {
      Alert.alert(
        'Local model is still loading',
        'Wait for the automatic on-device model setup to finish before recording.',
      );
      return false;
    }
    recordingStartInProgress.current = true;
    setIsStartingRecording(true);
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Microphone access needed',
          'Allow microphone access to transcribe a medication event on this device.',
        );
        return false;
      }
      if (!recordingHoldActive.current) {
        Alert.alert(
          'Microphone ready',
          'Press and hold the record button again, then release it when you are finished speaking.',
        );
        return false;
      }
      replaceLiveTranscript('');
      setRecordingDuration(0);
      setVoiceDraft(undefined);
      localMealLanguageProvider.release();
      const subscription = await appleSpeechService.startLiveTranscription(
        ({ transcript }) => accumulateLiveTranscript(transcript),
      );
      liveSubscription.current = subscription;
      recordingActive.current = true;
      recordingStartedAt.current = Date.now();
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(Date.now() - (recordingStartedAt.current ?? Date.now()));
      }, 250);
      setIsRecording(true);
      return true;
    } catch (caughtError) {
      recordingActive.current = false;
      setIsRecording(false);
      liveSubscription.current?.remove();
      liveSubscription.current = undefined;
      void appleSpeechService.cancelLiveTranscription();
      Alert.alert('Recording unavailable', errorMessage(caughtError));
      void appleSpeechService.getAvailability().then(setSpeechAvailability);
      return false;
    } finally {
      recordingStartInProgress.current = false;
      setIsStartingRecording(false);
    }
  }

  async function extractMedicationDetails(
    transcript: string,
  ): Promise<AppliedVoiceMedicationDraft> {
    const referenceDate = new Date();
    let extraction: MedicationTranscriptExtraction;
    try {
      await localMealLanguageProvider.prepare();
      extraction = await localMealLanguageProvider.extractMedication(
        transcript,
        referenceDate,
      );
    } catch {
      extraction = extractGroundedMedicationFromTranscript(transcript, referenceDate);
    } finally {
      localMealLanguageProvider.release();
    }
    if (!extraction.status) {
      throw new Error(
        'Describe an event that already happened, such as “I took…” or “I missed…”. Instructions and future plans are not logged.',
      );
    }
    if (!extraction.medicationName?.trim()) {
      throw new Error(
        'A medication name was not clear. Correct the transcript or record the event again.',
      );
    }
    return {
      ...extraction,
      medicationName: extraction.medicationName.trim(),
      status: extraction.status,
    };
  }

  async function processTranscript(sourceTranscript: string) {
    const refinedTranscript = refineMedicationTranscript(sourceTranscript);
    replaceLiveTranscript(refinedTranscript);
    const extraction = await extractMedicationDetails(refinedTranscript);
    setVoiceDraft({
      sourceTranscript,
      transcript: refinedTranscript,
      processedTranscript: refinedTranscript,
    });
    onApply(extraction);
  }

  async function stopAndProcessVoiceRecording() {
    if (!recordingActive.current) return;
    recordingHoldActive.current = false;
    recordingActive.current = false;
    setIsRecording(false);
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    recordingTimer.current = undefined;
    try {
      const transcription = await appleSpeechService.stopLiveTranscription();
      const sourceTranscript = mergeLiveSpeechTranscript(
        liveTranscriptRef.current,
        transcription.transcript,
      ).trim();
      replaceLiveTranscript(sourceTranscript);
      if (!sourceTranscript) {
        Alert.alert(
          'No speech captured',
          'Press and hold while you describe the medication event, then release after you finish speaking.',
        );
        return;
      }
      setIsExtracting(true);
      await processTranscript(sourceTranscript);
    } catch (caughtError) {
      Alert.alert('Medication voice entry unavailable', errorMessage(caughtError));
      void appleSpeechService.getAvailability().then(setSpeechAvailability);
    } finally {
      liveSubscription.current?.remove();
      liveSubscription.current = undefined;
      setIsExtracting(false);
    }
  }

  async function beginHoldRecording() {
    recordingHoldActive.current = true;
    const started = await startVoiceRecording();
    if (started && !recordingHoldActive.current) {
      await stopAndProcessVoiceRecording();
    }
  }

  function endHoldRecording() {
    recordingHoldActive.current = false;
    if (recordingActive.current) void stopAndProcessVoiceRecording();
  }

  async function reprocessCorrectedTranscript() {
    if (!voiceDraft) return;
    const correctedTranscript = voiceDraft.transcript.trim();
    if (!correctedTranscript) {
      Alert.alert(
        'Transcript required',
        'Enter the corrected medication event before reprocessing it.',
      );
      return;
    }
    setIsExtracting(true);
    try {
      await processTranscript(correctedTranscript);
    } catch (caughtError) {
      Alert.alert('Transcript could not be reprocessed', errorMessage(caughtError));
    } finally {
      setIsExtracting(false);
    }
  }

  function returnToRecorder() {
    setVoiceDraft(undefined);
    replaceLiveTranscript('');
    setRecordingDuration(0);
  }

  const transcriptNeedsReprocessing = voiceDraft
    ? hasUnprocessedTranscriptChanges(
        voiceDraft.transcript,
        voiceDraft.processedTranscript,
      )
    : false;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View style={styles.voiceIcon}><Mic size={21} color={palette.purple} /></View>
        <View style={styles.flex}>
          <AppText variant="subtitle">Voice medication entry</AppText>
        </View>
      </View>

      {!speechAvailability || !localModelAccess ? (
        <StatePanel
          loading
          title="Checking on-device support"
          message="Reviewing speech and local model availability."
        />
      ) : speechAvailability.status !== 'available' ? (
        <StatePanel title="Voice entry unavailable" message={speechAvailability.message} />
      ) : localModelAccess.availability !== 'available' ? (
        <StatePanel title="Local model unavailable" message={localModelAccess.message} />
      ) : (
        <Card style={styles.voiceCard}>
          <View style={styles.privacyRow}>
            <ShieldCheck size={20} color={palette.green} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong" color={palette.green}>On-device only</AppText>
              <AppText variant="caption" color={palette.textMuted}>
                Microphone audio is streamed only to Apple&apos;s on-device recognizer. There is no cloud transcription or model fallback.
              </AppText>
            </View>
          </View>

          {localModelState === 'preparing' || localModelState === 'checking' ? (
            <StatePanel
              loading
              title={`Preparing local model ${Math.round(modelProgress * 100)}%`}
              message="Keep the app open while the initial model download and on-device setup finish."
            />
          ) : localModelState === 'error' ? (
            <>
              <StatePanel
                title="Local model setup paused"
                message={localModelError ?? 'The automatic download could not finish. Check the connection and available storage, then retry.'}
              />
              <AppButton
                label="Retry local model setup"
                variant="secondary"
                icon={<Download size={18} color={palette.blue} />}
                onPress={retryLocalModelPreparation}
              />
            </>
          ) : isExtracting ? (
            <StatePanel
              loading
              title="Preparing editable medication details"
              message="The cached local model is extracting only details supported by the transcript."
            />
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isRecording
                  ? `Recording medication event, ${formatRecordingDuration(recordingDuration)}`
                  : 'Hold to record medication event'}
                accessibilityHint="Press and hold to record. Release to stop and review the transcript."
                accessibilityState={{ busy: isStartingRecording }}
                cancelable={false}
                onPressIn={() => void beginHoldRecording()}
                onPressOut={endHoldRecording}
                pressRetentionOffset={1000}
                style={({ pressed }) => [
                  styles.holdRecordButton,
                  isRecording || isStartingRecording
                    ? styles.holdRecordButtonActive
                    : styles.holdRecordButtonIdle,
                  pressed && styles.pressed,
                ]}>
                <View style={styles.holdRecordContent}>
                  <Mic
                    size={19}
                    color={isRecording || isStartingRecording ? palette.red : '#FFFFFF'}
                  />
                  <AppText
                    variant="bodyStrong"
                    color={isRecording || isStartingRecording ? palette.red : '#FFFFFF'}>
                    {isRecording
                      ? `Recording ${formatRecordingDuration(recordingDuration)} · Release to stop`
                      : isStartingRecording
                        ? 'Starting... keep holding'
                        : 'Hold to record'}
                  </AppText>
                </View>
              </Pressable>
              {isRecording ? (
                <View style={styles.liveTranscriptBox}>
                  <AppText variant="label" color={palette.red}>Live transcript</AppText>
                  <AppText variant="body" color={liveTranscript ? palette.text : palette.textMuted}>
                    {liveTranscript || 'Listening… Speak naturally, then release when you are finished.'}
                  </AppText>
                </View>
              ) : null}
              <AppText variant="caption" color={palette.textMuted}>
                Say what happened, for example: “I took 500 milligrams of metformin by mouth at 8 this morning.” Release to fill the editable fields below.
              </AppText>
            </>
          )}
        </Card>
      )}

      {voiceDraft ? (
        <Card style={styles.reviewCard}>
          <View style={styles.appliedHeading} accessibilityRole="summary">
            <CheckCircle2 size={20} color={palette.green} />
            <View style={styles.flex}>
              <AppText variant="subtitle" color={palette.green}>
                Medication fields filled
              </AppText>
              <AppText variant="caption" color={palette.textMuted}>
                Review or edit the name, status, when, dose, and route below. Nothing is saved until you add it to the session.
              </AppText>
            </View>
          </View>

          {voiceDraft.sourceTranscript !== voiceDraft.transcript ? (
            <View style={styles.sourceTranscriptBox}>
              <AppText variant="label" color={palette.textMuted}>
                Apple transcript before refinement
              </AppText>
              <AppText variant="body" selectable>{voiceDraft.sourceTranscript}</AppText>
            </View>
          ) : null}

          <FormField
            label="Refined transcript (editable)"
            value={voiceDraft.transcript}
            onChangeText={(value) => setVoiceDraft((current) => current
              ? { ...current, transcript: value }
              : current)}
            helper={transcriptNeedsReprocessing
              ? 'Transcript changed. Update the medication fields to apply the correction.'
              : 'These words were used to fill the editable medication fields below.'}
            placeholder="Correct the spoken medication event"
            multiline
            editable={!isExtracting}
          />
          <View style={styles.actions}>
            <AppButton
              label="Update fields from corrected transcript"
              variant="secondary"
              icon={<RefreshCw size={18} color={palette.blue} />}
              onPress={() => void reprocessCorrectedTranscript()}
              loading={isExtracting}
              disabled={!transcriptNeedsReprocessing || !voiceDraft.transcript.trim()}
            />
            <AppButton
              label="Record again"
              variant="ghost"
              icon={<Mic size={18} color={palette.text} />}
              onPress={returnToRecorder}
              disabled={isExtracting}
            />
          </View>

        </Card>
      ) : null}
    </View>
  );
}

function formatRecordingDuration(durationMillis: number): string {
  const seconds = Math.max(0, Math.round(durationMillis / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Try again.';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: spacing.md },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  voiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceCard: { gap: spacing.md },
  privacyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  holdRecordButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  holdRecordButtonIdle: { backgroundColor: palette.blue, borderColor: palette.blue },
  holdRecordButtonActive: { backgroundColor: palette.redSoft, borderColor: palette.red },
  holdRecordContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  liveTranscriptBox: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: palette.redSoft,
  },
  reviewCard: { gap: spacing.lg, borderColor: palette.purple, borderWidth: 1 },
  appliedHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  sourceTranscriptBox: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: palette.surfaceMuted,
  },
  actions: { gap: spacing.sm },
  pressed: { opacity: 0.75 },
});
