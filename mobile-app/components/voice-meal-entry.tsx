import { AudioModule } from 'expo-audio';
import type { EventSubscription } from 'expo-modules-core';
import {
  Calculator,
  CheckCircle2,
  Download,
  Mic,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import {
  MealTimeSelect,
  nearestLocalMealTime,
} from '@/components/meal-time-select';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { FormField, FormRow } from '@/components/ui/form-field';
import { StatePanel } from '@/components/ui/state-panel';
import { palette, radii, spacing } from '@/constants/design';
import { useLocalMealModel } from '@/providers/local-meal-model-provider';
import {
  appleSpeechService,
  type AppleSpeechAvailability,
} from '@/services/apple-speech-service';
import { localMealLanguageProvider } from '@/services/local-meal-language-provider';
import {
  calculatedCaloriesAfterNutritionEdit,
  splitFoodDescriptions,
  updateIngredientNutrition,
} from '@/services/local-nutrition-estimator';
import {
  deriveMealNameFromFoods,
  extractGroundedMealFromTranscript,
  refineMealTranscript,
} from '@/services/meal-transcript-extraction';
import { nutritionCatalog } from '@/services/nutrition-catalog';
import { hasUnprocessedTranscriptChanges } from '@/services/voice-transcript-review';
import { mergeLiveSpeechTranscript } from '@/services/live-speech-transcript';
import type {
  LocalNutritionEstimate,
  LocalNutritionFoodEstimate,
  MacroNutrients,
} from '@/types/nutrition';
import type { AppliedVoiceMealDraft } from '@/types/voice-meal';

export type { AppliedVoiceMealDraft } from '@/types/voice-meal';

type VoiceProcessingState = 'idle' | 'extracting';
type MacroField = keyof MacroNutrients;

interface EditableNutritionValues {
  calories: string;
  carbohydratesGrams: string;
  proteinGrams: string;
  fatGrams: string;
  fiberGrams: string;
}

interface VoiceMealDraft {
  sourceTranscript: string;
  transcript: string;
  processedTranscript: string;
  mealName: string;
  foodsText: string;
  mealTime: string;
  nutritionValues: EditableNutritionValues;
  engine: string;
  generatedAt: string;
  edited: boolean;
  mealNameEdited: boolean;
  nutritionEdited: boolean;
  selectedFoodFdcIds: (number | undefined)[];
}

interface VoiceMealEntryProps {
  initialMealTime?: string;
  onAddToMeal: (draft: AppliedVoiceMealDraft) => void;
}

export function VoiceMealEntry({
  initialMealTime,
  onAddToMeal,
}: VoiceMealEntryProps) {
  const liveSubscription = useRef<EventSubscription | undefined>(undefined);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const recordingStartedAt = useRef<number | undefined>(undefined);
  const liveTranscriptRef = useRef('');
  const recordingHoldActive = useRef(false);
  const recordingActive = useRef(false);
  const recordingStartInProgress = useRef(false);
  const nutritionRequestId = useRef(0);
  const {
    access: localModelAccess,
    state: localModelState,
    progress: modelProgress,
    error: localModelError,
    retry: retryLocalModelPreparation,
  } = useLocalMealModel();
  const [speechAvailability, setSpeechAvailability] = useState<AppleSpeechAvailability>();
  const [voiceProcessingState, setVoiceProcessingState] = useState<VoiceProcessingState>('idle');
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [lastAddedMealName, setLastAddedMealName] = useState<string>();
  const [voiceDraft, setVoiceDraft] = useState<VoiceMealDraft>();
  const [isEstimatingNutrition, setIsEstimatingNutrition] = useState(false);
  const [draftNutrition, setDraftNutrition] = useState<LocalNutritionEstimate>(
    emptyNutritionEstimate([]),
  );

  useEffect(() => {
    let active = true;
    void appleSpeechService.getAvailability().then((speech) => {
      if (!active) return;
      setSpeechAvailability(speech);
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
    const merged = mergeLiveSpeechTranscript(liveTranscriptRef.current, value);
    replaceLiveTranscript(merged);
  }

  async function startVoiceRecording(): Promise<boolean> {
    if (recordingActive.current || recordingStartInProgress.current) return false;
    if (localModelState !== 'ready') {
      Alert.alert(
        'Local model is still loading',
        'Wait for the automatic on-device model setup to finish before recording.'
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
          'Allow microphone access to transcribe a meal description on this device.'
        );
        return false;
      }
      if (!recordingHoldActive.current) {
        Alert.alert(
          'Microphone ready',
          'Press and hold the record button again, then release it when you are finished speaking.'
        );
        return false;
      }
      replaceLiveTranscript('');
      setLastAddedMealName(undefined);
      setRecordingDuration(0);
      // Defensive in case another preparation path retained the runtime. The
      // cached model is loaded again only after the microphone has stopped.
      localMealLanguageProvider.release();
      const subscription = await appleSpeechService.startLiveTranscription(
        ({ transcript }) => accumulateLiveTranscript(transcript)
      );
      liveSubscription.current = subscription;
      recordingActive.current = true;
      setVoiceDraft(undefined);
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
          'Press and hold while you describe the meal, then release after you finish speaking.'
        );
        return;
      }
      setVoiceProcessingState('extracting');
      const refinedTranscript = refineMealTranscript(sourceTranscript);
      replaceLiveTranscript(refinedTranscript);
      const extraction = await extractMealDetails(refinedTranscript);
      const foods = extraction.foods;
      const nutrition = await nutritionCatalog.estimate(foods);
      setDraftNutrition(nutrition);
      setVoiceDraft({
        sourceTranscript,
        transcript: refinedTranscript,
        processedTranscript: refinedTranscript,
        mealName: deriveMealNameFromFoods(foods) ?? extraction.mealName ?? '',
        foodsText: foods.join(', '),
        mealTime: initialMealTime || nearestLocalMealTime(),
        nutritionValues: macrosToValues(nutrition.totals),
        engine: transcription.engine,
        generatedAt: new Date().toISOString(),
        edited: false,
        mealNameEdited: false,
        nutritionEdited: false,
        selectedFoodFdcIds: foods.map(() => undefined),
      });
    } catch (caughtError) {
      Alert.alert('Voice entry unavailable', errorMessage(caughtError));
      void appleSpeechService.getAvailability().then(setSpeechAvailability);
    } finally {
      liveSubscription.current?.remove();
      liveSubscription.current = undefined;
      setVoiceProcessingState('idle');
    }
  }

  async function beginHoldRecording() {
    recordingHoldActive.current = true;
    const started = await startVoiceRecording();
    // The finger may be released while permission or the native speech session
    // is still opening. Honor that release as soon as startup finishes.
    if (started && !recordingHoldActive.current) {
      await stopAndProcessVoiceRecording();
    }
  }

  function endHoldRecording() {
    recordingHoldActive.current = false;
    if (recordingActive.current) {
      void stopAndProcessVoiceRecording();
    }
  }

  async function extractMealDetails(transcript: string) {
    try {
      await localMealLanguageProvider.prepare();
      return await localMealLanguageProvider.extractMeal(transcript);
    } catch {
      return extractGroundedMealFromTranscript(transcript);
    } finally {
      localMealLanguageProvider.release();
    }
  }

  function updateVoiceTranscript(value: string) {
    setVoiceDraft((current) => current ? {
      ...current,
      transcript: value,
      edited: true,
    } : current);
  }

  async function reprocessCorrectedTranscript() {
    if (!voiceDraft) return;
    const correctedTranscript = voiceDraft.transcript.trim();
    if (!correctedTranscript) {
      Alert.alert('Transcript required', 'Enter the corrected meal description before reprocessing it.');
      return;
    }

    setVoiceProcessingState('extracting');
    try {
      const refinedTranscript = refineMealTranscript(correctedTranscript);
      const extraction = await extractMealDetails(refinedTranscript);
      const foods = extraction.foods;
      const nutrition = await nutritionCatalog.estimate(foods);
      setDraftNutrition(nutrition);
      setVoiceDraft((current) => {
        if (!current || current.transcript.trim() !== correctedTranscript) return current;
        return {
          ...current,
          transcript: refinedTranscript,
          processedTranscript: refinedTranscript,
          mealName: deriveMealNameFromFoods(foods) ?? extraction.mealName ?? '',
          foodsText: foods.join(', '),
          nutritionValues: macrosToValues(nutrition.totals),
          edited: true,
          mealNameEdited: false,
          nutritionEdited: false,
          selectedFoodFdcIds: foods.map(() => undefined),
        };
      });
    } catch (caughtError) {
      Alert.alert('Transcript could not be reprocessed', errorMessage(caughtError));
    } finally {
      setVoiceProcessingState('idle');
    }
  }

  function updateVoiceDraft(field: 'mealName' | 'foodsText' | 'mealTime', value: string) {
    setVoiceDraft((current) => {
      if (!current) return current;
      if (field === 'mealName') {
        return { ...current, mealName: value, mealNameEdited: true, edited: true };
      }
      if (field === 'mealTime') return { ...current, mealTime: value, edited: true };
      return updateDraftFoods(current, splitFoodDescriptions(value), value);
    });
  }

  function replaceDraftFood(index: number, value: string, selectedFdcId?: number) {
    setVoiceDraft((current) => {
      if (!current) return current;
      const foods = splitFoodDescriptions(current.foodsText);
      if (!foods[index]) return current;
      const reviewedValue = value.trim();
      if (!reviewedValue) {
        const remainingFoods = foods.filter((_, foodIndex) => foodIndex !== index);
        return {
          ...updateDraftFoods(current, remainingFoods),
          selectedFoodFdcIds: current.selectedFoodFdcIds.filter(
            (_, foodIndex) => foodIndex !== index,
          ),
        };
      }
      foods[index] = reviewedValue;
      const next = updateDraftFoods(current, foods);
      return {
        ...next,
        selectedFoodFdcIds: foods.map((_, foodIndex) =>
          foodIndex === index ? selectedFdcId : current.selectedFoodFdcIds[foodIndex]
        ),
      };
    });
  }

  function deleteDraftFood(index: number) {
    setVoiceDraft((current) => {
      if (!current) return current;
      const foods = splitFoodDescriptions(current.foodsText);
      if (!foods[index]) return current;
      const remainingFoods = foods.filter((_, foodIndex) => foodIndex !== index);
      return {
        ...updateDraftFoods(current, remainingFoods),
        selectedFoodFdcIds: current.selectedFoodFdcIds.filter(
          (_, foodIndex) => foodIndex !== index,
        ),
      };
    });
  }

  function updateNutrition(field: MacroField, value: string) {
    setVoiceDraft((current) => {
      if (!current) return current;
      const nutritionValues = { ...current.nutritionValues, [field]: value };
      const calculatedCalories = calculatedCaloriesAfterNutritionEdit(
        valuesToMacros(nutritionValues),
        field,
      );
      if (calculatedCalories !== undefined) {
        nutritionValues.calories = String(calculatedCalories);
      }
      return {
        ...current,
        nutritionValues,
        nutritionEdited: true,
        edited: true,
      };
    });
  }

  function updateFoodNutrition(foodIndex: number, field: MacroField, value: string) {
    const nutrition = updateIngredientNutrition(
      draftNutrition,
      foodIndex,
      field,
      safeNumber(value),
    );
    setDraftNutrition(nutrition);
    setVoiceDraft((current) => current ? {
      ...current,
      nutritionValues: macrosToValues(nutrition.totals),
      nutritionEdited: true,
      edited: true,
    } : current);
  }

  function buildAppliedDraft(): AppliedVoiceMealDraft | undefined {
    if (!voiceDraft) return undefined;
    const foods = splitFoodDescriptions(voiceDraft.foodsText);
    return {
      transcript: voiceDraft.transcript.trim(),
      mealName: voiceDraft.mealName.trim(),
      mealTime: voiceDraft.mealTime,
      foods,
      nutrition: valuesToMacros(voiceDraft.nutritionValues),
      nutritionEstimate: draftNutrition,
      providerId: localMealLanguageProvider.providerId,
      model: localMealLanguageProvider.modelId,
      generatedAt: voiceDraft.generatedAt,
      edited: voiceDraft.edited,
    };
  }

  function returnToRecorder() {
    setVoiceDraft(undefined);
    replaceLiveTranscript('');
    setRecordingDuration(0);
    setLastAddedMealName(undefined);
  }

  function addToSession() {
    const applied = buildAppliedDraft();
    if (!applied) return;
    onAddToMeal(applied);
    setVoiceDraft(undefined);
    replaceLiveTranscript('');
    setRecordingDuration(0);
    setLastAddedMealName(applied.mealName || 'Meal');
  }

  const draftFoodsText = voiceDraft?.foodsText;
  const selectedFoodFdcIds = voiceDraft?.selectedFoodFdcIds;
  const draftFoods = useMemo(
    () => draftFoodsText ? splitFoodDescriptions(draftFoodsText) : [],
    [draftFoodsText]
  );
  useEffect(() => {
    const activeRequestId = nutritionRequestId.current + 1;
    nutritionRequestId.current = activeRequestId;
    if (draftFoodsText === undefined) {
      setDraftNutrition(emptyNutritionEstimate([]));
      setIsEstimatingNutrition(false);
      return;
    }
    const foodsText = draftFoodsText;
    const foods = splitFoodDescriptions(foodsText);
    setIsEstimatingNutrition(true);
    void nutritionCatalog.estimate(foods, selectedFoodFdcIds).then((nutrition) => {
      if (nutritionRequestId.current !== activeRequestId) return;
      setDraftNutrition(nutrition);
      setVoiceDraft((current) => {
        if (!current || current.foodsText !== foodsText || current.nutritionEdited) {
          return current;
        }
        return { ...current, nutritionValues: macrosToValues(nutrition.totals) };
      });
    }).catch(() => {
      if (nutritionRequestId.current !== activeRequestId) return;
      const unavailable = emptyNutritionEstimate(foods);
      setDraftNutrition(unavailable);
      setVoiceDraft((current) => {
        if (!current || current.foodsText !== foodsText || current.nutritionEdited) {
          return current;
        }
        return { ...current, nutritionValues: macrosToValues(unavailable.totals) };
      });
    }).finally(() => {
      if (nutritionRequestId.current === activeRequestId) {
        setIsEstimatingNutrition(false);
      }
    });
  }, [draftFoodsText, selectedFoodFdcIds]);
  const transcriptNeedsReprocessing = voiceDraft
    ? hasUnprocessedTranscriptChanges(voiceDraft.transcript, voiceDraft.processedTranscript)
    : false;
  const isExtracting = voiceProcessingState === 'extracting';
  const draftHasMeal = Boolean(voiceDraft?.mealName.trim() && draftFoods.length > 0);
  const draftReadyToApply = draftHasMeal && !transcriptNeedsReprocessing &&
    !isExtracting && !isEstimatingNutrition;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View style={styles.voiceIcon}><Mic size={21} color={palette.purple} /></View>
        <View style={styles.flex}>
          <AppText variant="subtitle">Voice meal entry</AppText>
        </View>
      </View>

      {lastAddedMealName ? (
        <Card style={styles.addedNotice} accessibilityRole="summary">
          <CheckCircle2 size={20} color={palette.green} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong" color={palette.green}>Added to current meal</AppText>
            <AppText variant="caption" color={palette.textMuted}>
              {lastAddedMealName} is in this meal draft and has not been saved yet. Add more foods or review the combined fields, then press Save meal.
            </AppText>
          </View>
        </Card>
      ) : null}

      {!speechAvailability || !localModelAccess ? (
        <StatePanel loading title="Checking on-device support" message="Reviewing speech and local model availability." />
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
            <>
              <AppText variant="caption" color={palette.textMuted}>
                GlucoFinity starts preparing the quantized LFM2.5-1.2B-Instruct model when the app opens. The first setup downloads a large model file; later uses load its cached local copy.
              </AppText>
              <StatePanel
                loading
                title={`Preparing local model ${Math.round(modelProgress * 100)}%`}
                message="Keep the app open while the initial model download and on-device setup finish."
              />
            </>
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
          ) : voiceProcessingState === 'extracting' ? (
            <StatePanel loading title="Preparing editable meal details" message="The cached local LFM2.5 model is loading and separating only the foods you said." />
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isRecording
                  ? `Recording meal description, ${formatRecordingDuration(recordingDuration)}`
                  : 'Hold to record meal description'}
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
                Press and hold while speaking, then release to stop and review. You can list multiple foods even when speech recognition omits punctuation or the word “and.”
              </AppText>
            </>
          )}
        </Card>
      )}

      {voiceDraft ? (
        <Card style={styles.voiceReviewCard}>
          <View style={styles.flex}>
            <AppText variant="label" color={palette.purple}>Local model draft</AppText>
            <AppText variant="subtitle">Review before applying</AppText>
            <AppText variant="caption" color={palette.textMuted}>
              Before extraction, GlucoFinity locally adds conservative grammar and punctuation. Nothing is saved until you review and apply the result.
            </AppText>
          </View>

          {voiceDraft.sourceTranscript !== voiceDraft.transcript ? (
            <View style={styles.sourceTranscriptBox}>
              <AppText variant="label" color={palette.textMuted}>Apple transcript before refinement</AppText>
              <AppText variant="body" selectable>{voiceDraft.sourceTranscript}</AppText>
            </View>
          ) : null}

          <FormField
            label="Refined transcript (editable)"
            value={voiceDraft.transcript}
            onChangeText={updateVoiceTranscript}
            helper={transcriptNeedsReprocessing
              ? 'Transcript changed. Reprocess it to refresh the foods and estimated nutrition before saving.'
              : 'Verify every food and quantity. This reviewed sentence becomes the saved meal description.'}
            placeholder="Correct the spoken meal description"
            multiline
            editable={!isExtracting}
          />
          <View style={styles.transcriptActions}>
            <AppButton
              label="Reprocess corrected transcript"
              variant="secondary"
              icon={<RefreshCw size={18} color={palette.blue} />}
              onPress={() => void reprocessCorrectedTranscript()}
              loading={isExtracting}
              disabled={!transcriptNeedsReprocessing || !voiceDraft.transcript.trim()}
              accessibilityHint="Refreshes the meal name, foods, portions, and estimated nutrition from the corrected transcript."
            />
            <AppButton
              label="Record again"
              variant="ghost"
              icon={<Mic size={18} color={palette.text} />}
              onPress={returnToRecorder}
              disabled={isExtracting}
              accessibilityHint="Discards this draft and returns to the hold-to-record control."
            />
          </View>

          <FormField
            label="Meal name (from foods)"
            value={voiceDraft.mealName}
            onChangeText={(value) => updateVoiceDraft('mealName', value)}
            placeholder="Food name or food combination"
          />
          <MealTimeSelect
            value={voiceDraft.mealTime}
            onChange={(value) => updateVoiceDraft('mealTime', value)}
          />
          <FormField
            label="Foods and portions (one per line or comma separated)"
            value={voiceDraft.foodsText}
            onChangeText={(value) => updateVoiceDraft('foodsText', value)}
            placeholder="Example: 1 cup brown rice, 4 oz salmon"
            multiline
          />

          <View style={styles.nutritionPanel}>
            <View style={styles.nutritionTitle}>
              <Calculator size={19} color={palette.blue} />
              <View style={styles.flex}>
                <AppText variant="bodyStrong">Estimated nutrition</AppText>
                <AppText variant="caption" color={palette.textMuted}>
                  {isEstimatingNutrition
                    ? 'Searching the local food catalog…'
                    : `${draftNutrition.matchedFoodCount} of ${draftNutrition.totalFoodCount} foods matched the local catalog. Unmatched foods are excluded from totals.`}
                </AppText>
              </View>
            </View>

            <View style={styles.macroEditFields}>
              <FormRow>
                <FormField label="Calories" value={voiceDraft.nutritionValues.calories} onChangeText={(value) => updateNutrition('calories', value)} keyboardType="decimal-pad" />
                <FormField label="Carbs (g)" value={voiceDraft.nutritionValues.carbohydratesGrams} onChangeText={(value) => updateNutrition('carbohydratesGrams', value)} keyboardType="decimal-pad" />
              </FormRow>
              <FormRow>
                <FormField label="Protein (g)" value={voiceDraft.nutritionValues.proteinGrams} onChangeText={(value) => updateNutrition('proteinGrams', value)} keyboardType="decimal-pad" />
                <FormField label="Fat (g)" value={voiceDraft.nutritionValues.fatGrams} onChangeText={(value) => updateNutrition('fatGrams', value)} keyboardType="decimal-pad" />
              </FormRow>
              <FormField label="Fiber (g)" value={voiceDraft.nutritionValues.fiberGrams} onChangeText={(value) => updateNutrition('fiberGrams', value)} keyboardType="decimal-pad" />
              <AppText variant="caption" color={palette.textMuted}>
                Editing carbs, protein, or fat recalculates calories automatically using 4/4/9 kcal per gram. Editing calories directly does not change the macros. Ingredient edits update these totals; editing a total does not redistribute it across ingredients.
              </AppText>
            </View>

            <View style={styles.foodReviewList}>
              {draftNutrition.foods.map((estimate, index) => (
                <NutritionFoodCard
                  key={`nutrition-food-${index}`}
                  estimate={estimate}
                  onChange={(value, fdcId) => replaceDraftFood(index, value, fdcId)}
                  onNutritionChange={(field, value) =>
                    updateFoodNutrition(index, field, value)
                  }
                  onDelete={() => deleteDraftFood(index)}
                  onSuggestion={(value, fdcId) => replaceDraftFood(index, value, fdcId)}
                />
              ))}
            </View>
            {draftNutrition.defaultPortionCount > 0 ? (
              <View style={styles.assumptionNotice}>
                <AppText variant="caption" color={palette.amber}>
                  {draftNutrition.defaultPortionCount} matched food uses an assumed reference portion. Add a quantity and unit for a more specific estimate.
                </AppText>
              </View>
            ) : null}
            <AppText variant="caption" color={palette.textMuted}>
              {draftNutrition.sourceLabel}. Values are offline estimates and require review. Records with missing required nutrition remain unresolved.
            </AppText>
          </View>

          <View style={styles.reviewActions}>
            <AppButton label="Discard draft" variant="ghost" onPress={() => setVoiceDraft(undefined)} />
            <AppButton label="Add to session" onPress={addToSession} disabled={!draftReadyToApply} />
          </View>
        </Card>
      ) : null}
    </View>
  );
}

function NutritionFoodCard({
  estimate,
  onChange,
  onNutritionChange,
  onDelete,
  onSuggestion,
}: {
  estimate: LocalNutritionFoodEstimate;
  onChange: (value: string, fdcId?: number) => void;
  onNutritionChange: (field: MacroField, value: string) => void;
  onDelete: () => void;
  onSuggestion: (value: string, fdcId: number) => void;
}) {
  const inputFocused = useRef(false);
  const inputValueRef = useRef(estimate.input);
  const selectedSuggestionRef = useRef<{ input: string; fdcId: number } | undefined>(
    estimate.fdcId === undefined
      ? undefined
      : { input: estimate.input, fdcId: estimate.fdcId },
  );
  const [inputValue, setInputValue] = useState(estimate.input);
  const [nutritionValues, setNutritionValues] = useState<EditableNutritionValues>(
    optionalMacrosToValues(estimate.nutrients),
  );
  const nutritionEstimateIdentity = useRef(
    `${estimate.input}:${estimate.fdcId ?? 'unmatched'}`,
  );
  const [suggestions, setSuggestions] = useState<Awaited<ReturnType<
    typeof nutritionCatalog.findSuggestions
  >>>([]);
  useEffect(() => {
    if (!inputFocused.current) {
      inputValueRef.current = estimate.input;
      selectedSuggestionRef.current = estimate.fdcId === undefined
        ? undefined
        : { input: estimate.input, fdcId: estimate.fdcId };
      setInputValue(estimate.input);
    }
  }, [estimate.fdcId, estimate.input]);
  useEffect(() => {
    const nextIdentity = `${estimate.input}:${estimate.fdcId ?? 'unmatched'}`;
    if (nutritionEstimateIdentity.current === nextIdentity) return;
    nutritionEstimateIdentity.current = nextIdentity;
    setNutritionValues(optionalMacrosToValues(estimate.nutrients));
  }, [estimate]);
  useEffect(() => {
    let active = true;
    if (estimate.nutrients) {
      setSuggestions([]);
      return () => {
        active = false;
      };
    }
    void nutritionCatalog.findSuggestions(estimate.input).then((nextSuggestions) => {
      if (active) setSuggestions(nextSuggestions);
    }).catch(() => {
      if (active) setSuggestions([]);
    });
    return () => {
      active = false;
    };
  }, [estimate.input, estimate.nutrients]);

  function updateEditableIngredientNutrition(
    field: MacroField,
    value: string,
    normalizeOnBlur = false,
  ) {
    const reviewedValue = normalizeOnBlur ? String(safeNumber(value)) : value;
    const nextValues = { ...nutritionValues, [field]: reviewedValue };
    const calculatedCalories = calculatedCaloriesAfterNutritionEdit(
      valuesToMacros(nextValues),
      field,
    );
    if (calculatedCalories !== undefined) {
      nextValues.calories = String(calculatedCalories);
    }
    setNutritionValues(nextValues);
    if (reviewedValue.trim()) onNutritionChange(field, reviewedValue);
  }

  return (
    <View style={styles.foodReviewRow}>
      <FormField
        label="Ingredient"
        value={inputValue}
        onFocus={() => {
          inputFocused.current = true;
        }}
        onBlur={() => {
          inputFocused.current = false;
          const reviewedInput = inputValueRef.current.trim();
          inputValueRef.current = reviewedInput;
          setInputValue(reviewedInput);
          const selectedSuggestion = selectedSuggestionRef.current;
          onChange(
            reviewedInput,
            selectedSuggestion?.input === reviewedInput
              ? selectedSuggestion.fdcId
              : undefined,
          );
        }}
        onChangeText={(value) => {
          inputValueRef.current = value;
          if (selectedSuggestionRef.current?.input !== value.trim()) {
            selectedSuggestionRef.current = undefined;
          }
          setInputValue(value);
          if (value.trim()) onChange(value);
        }}
      />
      {estimate.nutrients ? (
        <AppText variant="caption" color={palette.textMuted}>
          {estimate.matchedName} · {estimate.portionLabel}
        </AppText>
      ) : (
        <>
          <AppText variant="caption" color={palette.textMuted}>{estimate.unresolvedReason}</AppText>
          {suggestions.length > 0 ? (
            <View style={styles.suggestionList}>
              <AppText variant="label" color={palette.textMuted}>Closest local options</AppText>
              {suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion.fdcId}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${suggestion.name}`}
                  onPress={() => {
                    inputFocused.current = false;
                    inputValueRef.current = suggestion.suggestedInput;
                    selectedSuggestionRef.current = {
                      input: suggestion.suggestedInput,
                      fdcId: suggestion.fdcId,
                    };
                    setInputValue(suggestion.suggestedInput);
                    setSuggestions([]);
                    onSuggestion(suggestion.suggestedInput, suggestion.fdcId);
                  }}
                  style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
                  <AppText variant="bodyStrong" color={palette.blue}>Use {suggestion.name}</AppText>
                  <AppText variant="caption" color={palette.textMuted}>{suggestionLabel(suggestion.matchBasis)}</AppText>
                </Pressable>
              ))}
              <AppText variant="caption" color={palette.textMuted}>
                Suggestions are ranked local choices, not equivalents or automatic substitutions.
              </AppText>
            </View>
          ) : null}
        </>
      )}
      <View style={styles.ingredientNutritionFields}>
        <AppText variant="label" color={palette.textMuted}>Ingredient nutrition</AppText>
        <FormRow>
          <FormField
            label="Calories"
            value={nutritionValues.calories}
            onBlur={() => updateEditableIngredientNutrition('calories', nutritionValues.calories, true)}
            onChangeText={(value) => updateEditableIngredientNutrition('calories', value)}
            keyboardType="decimal-pad"
          />
          <FormField
            label="Carbs (g)"
            value={nutritionValues.carbohydratesGrams}
            onBlur={() => updateEditableIngredientNutrition('carbohydratesGrams', nutritionValues.carbohydratesGrams, true)}
            onChangeText={(value) => updateEditableIngredientNutrition('carbohydratesGrams', value)}
            keyboardType="decimal-pad"
          />
        </FormRow>
        <FormRow>
          <FormField
            label="Protein (g)"
            value={nutritionValues.proteinGrams}
            onBlur={() => updateEditableIngredientNutrition('proteinGrams', nutritionValues.proteinGrams, true)}
            onChangeText={(value) => updateEditableIngredientNutrition('proteinGrams', value)}
            keyboardType="decimal-pad"
          />
          <FormField
            label="Fat (g)"
            value={nutritionValues.fatGrams}
            onBlur={() => updateEditableIngredientNutrition('fatGrams', nutritionValues.fatGrams, true)}
            onChangeText={(value) => updateEditableIngredientNutrition('fatGrams', value)}
            keyboardType="decimal-pad"
          />
        </FormRow>
        <FormField
          label="Fiber (g)"
          value={nutritionValues.fiberGrams}
          onBlur={() => updateEditableIngredientNutrition('fiberGrams', nutritionValues.fiberGrams, true)}
          onChangeText={(value) => updateEditableIngredientNutrition('fiberGrams', value)}
          keyboardType="decimal-pad"
        />
        <AppText variant="caption" color={palette.textMuted}>
          Macro edits recalculate this ingredient&apos;s calories and the meal totals. Direct calorie edits leave this ingredient&apos;s macros unchanged.
        </AppText>
      </View>
      <View style={styles.foodActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${estimate.input}`} onPress={onDelete} style={({ pressed }) => [styles.smallAction, styles.deleteAction, pressed && styles.pressed]}>
          <Trash2 size={16} color={palette.red} />
          <AppText variant="caption" color={palette.red}>Delete</AppText>
        </Pressable>
      </View>
    </View>
  );
}

function updateDraftFoods(
  current: VoiceMealDraft,
  foods: string[],
  foodsText = foods.join(', ')
): VoiceMealDraft {
  return {
    ...current,
    foodsText,
    mealName: current.mealNameEdited ? current.mealName : deriveMealNameFromFoods(foods) ?? '',
    nutritionEdited: false,
    selectedFoodFdcIds: foods.map(() => undefined),
    edited: true,
  };
}

function emptyNutritionEstimate(foods: readonly string[]): LocalNutritionEstimate {
  const totals: MacroNutrients = {
    calories: 0,
    carbohydratesGrams: 0,
    proteinGrams: 0,
    fatGrams: 0,
    fiberGrams: 0,
  };
  return {
    foods: foods.map((input) => ({
      input,
      usedDefaultPortion: false,
      unresolvedReason: 'The local nutrition catalog is still preparing. Review this item manually.',
    })),
    totals,
    matchedFoodCount: 0,
    totalFoodCount: foods.length,
    defaultPortionCount: 0,
    sourceId: 'usda-fdc-local-sqlite-v1',
    sourceLabel: 'USDA FoodData Central local catalog',
    sourceUrl: 'https://fdc.nal.usda.gov/',
  };
}

function macrosToValues(macros: MacroNutrients): EditableNutritionValues {
  return {
    calories: String(macros.calories),
    carbohydratesGrams: String(macros.carbohydratesGrams),
    proteinGrams: String(macros.proteinGrams),
    fatGrams: String(macros.fatGrams),
    fiberGrams: String(macros.fiberGrams),
  };
}

function optionalMacrosToValues(
  macros: MacroNutrients | undefined,
): EditableNutritionValues {
  return macros ? macrosToValues(macros) : {
    calories: '',
    carbohydratesGrams: '',
    proteinGrams: '',
    fatGrams: '',
    fiberGrams: '',
  };
}

function valuesToMacros(values: EditableNutritionValues): MacroNutrients {
  return {
    calories: safeNumber(values.calories),
    carbohydratesGrams: safeNumber(values.carbohydratesGrams),
    proteinGrams: safeNumber(values.proteinGrams),
    fatGrams: safeNumber(values.fatGrams),
    fiberGrams: safeNumber(values.fiberGrams),
  };
}

function safeNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatRecordingDuration(durationMillis: number): string {
  const seconds = Math.max(0, Math.round(durationMillis / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function suggestionLabel(matchBasis: 'text' | 'food-family' | 'available-option'): string {
  if (matchBasis === 'text') return 'Closest text match';
  if (matchBasis === 'food-family') return 'Related food family';
  return 'Broader available option';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Try again.';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: spacing.md },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  voiceIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.purpleSoft, alignItems: 'center', justifyContent: 'center' },
  voiceCard: { gap: spacing.md },
  privacyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  addedNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: palette.greenSoft },
  holdRecordButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radii.sm, borderWidth: 1 },
  holdRecordButtonIdle: { backgroundColor: palette.blue, borderColor: palette.blue },
  holdRecordButtonActive: { backgroundColor: palette.redSoft, borderColor: palette.red },
  holdRecordContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  liveTranscriptBox: { gap: spacing.xs, padding: spacing.md, borderRadius: radii.sm, backgroundColor: palette.redSoft },
  voiceReviewCard: { gap: spacing.lg, borderColor: palette.purple, borderWidth: 1 },
  sourceTranscriptBox: { gap: spacing.xs, padding: spacing.md, borderRadius: radii.sm, backgroundColor: palette.surfaceMuted },
  transcriptActions: { gap: spacing.sm },
  nutritionPanel: { gap: spacing.md, padding: spacing.md, borderRadius: radii.sm, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.blueSoft },
  nutritionTitle: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  macroEditFields: { gap: spacing.md },
  foodReviewList: { gap: spacing.sm },
  foodReviewRow: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border, backgroundColor: palette.surface },
  ingredientNutritionFields: { gap: spacing.md },
  foodActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  smallAction: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.sm, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  deleteAction: { borderColor: palette.redSoft, backgroundColor: palette.redSoft },
  suggestionList: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  suggestion: { gap: spacing.xs, padding: spacing.md, borderRadius: radii.sm, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.blueSoft },
  assumptionNotice: { padding: spacing.md, borderRadius: radii.sm, backgroundColor: palette.amberSoft },
  reviewActions: { gap: spacing.sm },
  pressed: { opacity: 0.75 },
});
