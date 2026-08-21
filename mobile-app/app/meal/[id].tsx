import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Activity, Camera, ImagePlus, Trash2, X } from 'lucide-react-native';
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

import { MealGlucoseChart } from '@/components/meal-glucose-chart';
import {
  VoiceMealEntry,
  type AppliedVoiceMealDraft,
} from '@/components/voice-meal-entry';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { FormField, FormRow } from '@/components/ui/form-field';
import { MetricCard, MetricGrid } from '@/components/ui/metric-card';
import { StatePanel } from '@/components/ui/state-panel';
import { palette, radii, spacing } from '@/constants/design';
import { useAppData } from '@/hooks/use-app-data';
import { useMealGlucoseResponse } from '@/hooks/use-meal-glucose-response';
import { mergeVoiceDraftIntoMealSession } from '@/services/voice-meal-session';
import type {
  FoodEstimate,
  MealAnalysis,
  NutritionEstimateSource,
} from '@/types/ai';
import type { MealEntry } from '@/types/health';
import {
  parseLocalDateTime,
  toDateInputValue,
  toTimeInputValue,
} from '@/utils/date';

interface FormErrors {
  name?: string;
  dateTime?: string;
  nutrition?: string;
}

type MealFormRouteParams = {
  id: string | string[];
  entryContext?: string | string[];
  suggestedTimestamp?: string | string[];
  observedRiseMgDl?: string | string[];
};

function firstRouteParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  return Number(value);
}

function isValidOptionalNumber(value: string): boolean {
  if (!value.trim()) return true;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 10000;
}

function persistedNutritionSource(value: unknown): NutritionEstimateSource {
  if (
    value === 'ai-estimated' ||
    value === 'ai-corrected' ||
    value === 'manual' ||
    value === 'usda-label'
  ) {
    return value;
  }
  return value === 'ai' ? 'ai-estimated' : 'manual';
}

function nutritionSourceLabel(source: NutritionEstimateSource): string {
  const labels: Record<NutritionEstimateSource, string> = {
    manual: 'Manual nutrition',
    'usda-label': 'USDA product-label nutrition',
    'ai-estimated': 'AI-estimated nutrition',
    'ai-corrected': 'User-corrected AI estimate',
  };
  return labels[source];
}

export default function MealFormScreen() {
  const params = useLocalSearchParams<MealFormRouteParams>();
  const mealId = firstRouteParam(params.id);
  const isNew = mealId === 'new';
  const entryContext = firstRouteParam(params.entryContext);
  const suggestedTimestampParam = firstRouteParam(params.suggestedTimestamp);
  const suggestedTimestamp =
    suggestedTimestampParam && Number.isFinite(Date.parse(suggestedTimestampParam))
      ? new Date(suggestedTimestampParam).toISOString()
      : undefined;
  const observedRiseParam = Number(firstRouteParam(params.observedRiseMgDl));
  const observedRiseMgDl =
    Number.isFinite(observedRiseParam) && observedRiseParam > 0 && observedRiseParam <= 400
      ? Math.round(observedRiseParam)
      : undefined;
  const isPossibleUnloggedMeal =
    isNew && entryContext === 'possible-unlogged-rise' && suggestedTimestamp !== undefined;
  const { meals, settings, isLoading, saveMeal, deleteMeal } = useAppData();
  const existingMeal = useMemo(() => meals.find((meal) => meal.id === mealId), [mealId, meals]);
  const mealResponse = useMealGlucoseResponse(
    existingMeal,
    settings.glucoseDataSource
  );
  const [initialized, setInitialized] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dateValue, setDateValue] = useState('');
  const [timeValue, setTimeValue] = useState('');
  const [calories, setCalories] = useState('');
  const [carbs, setCarbs] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [foodNames, setFoodNames] = useState('');
  const [foodEstimates, setFoodEstimates] = useState<FoodEstimate[]>([]);
  const [nutritionSource, setNutritionSource] =
    useState<NutritionEstimateSource>('manual');
  const [analysisMetadata, setAnalysisMetadata] = useState<
    Pick<MealAnalysis, 'confidence' | 'providerId' | 'model' | 'generatedAt'> | undefined
  >();
  const [notes, setNotes] = useState('');
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isLoading || initialized) return;
    const timestamp = existingMeal?.timestamp ?? suggestedTimestamp ?? new Date().toISOString();
    setName(existingMeal?.name ?? '');
    setDescription(existingMeal?.description ?? '');
    setDateValue(toDateInputValue(timestamp));
    setTimeValue(toTimeInputValue(timestamp));
    const nutrition = existingMeal?.nutritionEstimate;
    setCalories(nutrition?.calories?.toString() ?? '');
    setCarbs(
      nutrition?.carbohydratesGrams?.toString() ??
        existingMeal?.estimatedCarbsGrams?.toString() ??
        ''
    );
    setProtein(
      nutrition?.proteinGrams?.toString() ??
        existingMeal?.proteinGrams?.toString() ??
        ''
    );
    setFat(
      nutrition?.fatGrams?.toString() ?? existingMeal?.fatGrams?.toString() ?? ''
    );
    setFiber(
      nutrition?.fiberGrams?.toString() ??
        existingMeal?.fiberGrams?.toString() ??
        ''
    );
    setFoodEstimates(nutrition?.foods ?? []);
    setFoodNames(nutrition?.foods?.map((food) => food.name).join(', ') ?? '');
    setNutritionSource(persistedNutritionSource(nutrition?.source));
    setAnalysisMetadata(
      nutrition?.generatedAt
        ? {
            confidence: nutrition.confidence,
            providerId: nutrition.providerId,
            model: nutrition.model,
            generatedAt: nutrition.generatedAt,
          }
        : undefined
    );
    setNotes(existingMeal?.notes ?? '');
    setImageUri(existingMeal?.imageUri);
    setInitialized(true);
  }, [existingMeal, initialized, isLoading, suggestedTimestamp]);

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to attach a meal image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.82,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access to photograph a meal.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.82,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  function addVoiceMealDraftToSession(draft: AppliedVoiceMealDraft) {
    const merged = mergeVoiceDraftIntoMealSession({
      name,
      description,
      timeValue,
      foodNames,
      foodEstimates,
      calories,
      carbohydratesGrams: carbs,
      proteinGrams: protein,
      fatGrams: fat,
      fiberGrams: fiber,
      nutritionSource,
    }, draft);
    setName(merged.name);
    setDescription(merged.description);
    setTimeValue(merged.timeValue);
    setFoodNames(merged.foodNames);
    setFoodEstimates(merged.foodEstimates);
    setCalories(merged.calories);
    setCarbs(merged.carbohydratesGrams);
    setProtein(merged.proteinGrams);
    setFat(merged.fatGrams);
    setFiber(merged.fiberGrams);
    setNutritionSource(merged.nutritionSource);
    setAnalysisMetadata({
      providerId: merged.providerId,
      model: merged.model,
      generatedAt: merged.generatedAt,
    });
  }

  function markNutritionEdited() {
    setNutritionSource((current) =>
      current === 'ai-estimated' ? 'ai-corrected' : current
    );
  }

  function updateNutritionValue(
    setter: (value: string) => void,
    value: string
  ) {
    setter(value);
    markNutritionEdited();
  }

  async function submit() {
    const timestamp = parseLocalDateTime(dateValue, timeValue);
    const nutritionIsValid = [calories, carbs, protein, fat, fiber].every(
      isValidOptionalNumber
    );
    const nextErrors: FormErrors = {
      name: name.trim() ? undefined : 'Enter a meal name.',
      dateTime: timestamp ? undefined : 'Use a valid date (YYYY-MM-DD) and time (HH:mm).',
      nutrition: nutritionIsValid ? undefined : 'Nutrition estimates must be numbers from 0–10000.',
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.dateTime || nextErrors.nutrition || !timestamp) return;

    const calorieEstimate = optionalNumber(calories);
    const estimatedCarbsGrams = optionalNumber(carbs);
    const proteinGrams = optionalNumber(protein);
    const fatGrams = optionalNumber(fat);
    const hasNutritionEstimate =
      estimatedCarbsGrams !== undefined ||
      proteinGrams !== undefined ||
      fatGrams !== undefined ||
      optionalNumber(fiber) !== undefined ||
      calorieEstimate !== undefined ||
      foodNames.trim().length > 0;
    const reviewedFoods = foodNames
      .split(',')
      .map((food) => food.trim())
      .filter(Boolean)
      .map((food, index) => ({
        ...(foodEstimates[index] ?? {}),
        name: food,
      }));
    const entry: MealEntry = {
      id: existingMeal?.id ?? `meal-${Date.now()}`,
      timestamp: timestamp.toISOString(),
      timezoneOffsetMinutes: timestamp.getTimezoneOffset(),
      name: name.trim(),
      description: description.trim() || undefined,
      imageUri,
      estimatedCarbsGrams,
      proteinGrams,
      fatGrams,
      fiberGrams: optionalNumber(fiber),
      notes: notes.trim() || undefined,
      ...(hasNutritionEstimate
        ? {
            nutritionEstimate: {
              foods: reviewedFoods.length > 0 ? reviewedFoods : undefined,
              calories: calorieEstimate,
              carbohydratesGrams: estimatedCarbsGrams,
              proteinGrams,
              fatGrams,
              fiberGrams: optionalNumber(fiber),
              confidence: analysisMetadata?.confidence,
              source: nutritionSource,
              providerId: analysisMetadata?.providerId,
              model: analysisMetadata?.model,
              generatedAt:
                analysisMetadata?.generatedAt ?? new Date().toISOString(),
            },
          }
        : {}),
    };

    setIsSaving(true);
    try {
      await saveMeal(entry);
      router.back();
    } catch (caughtError) {
      Alert.alert('Meal not saved', caughtError instanceof Error ? caughtError.message : 'Try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDelete() {
    if (!existingMeal) return;
    Alert.alert('Delete meal?', `${existingMeal.name} will be removed from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteMeal(existingMeal.id).then(() => router.back());
        },
      },
    ]);
  }

  if (isLoading || !initialized) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <StatePanel loading title="Preparing meal form" message="Loading local meal details." />
        </View>
      </SafeAreaView>
    );
  }

  if (!isNew && !existingMeal) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <StatePanel
            title="Meal not found"
            message="This meal may have been deleted."
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
          <Pressable accessibilityRole="button" accessibilityLabel="Close meal form" hitSlop={10} onPress={() => router.back()} style={styles.closeButton}>
            <X size={24} color={palette.text} />
          </Pressable>
          <AppText variant="subtitle">{isNew ? 'Add meal' : 'Edit meal'}</AppText>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView
          style={styles.flex}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          {isPossibleUnloggedMeal ? (
            <Card style={styles.observedRiseNotice} accessibilityRole="summary">
              <View style={styles.observedRiseHeader}>
                <View style={styles.responseIcon}>
                  <Activity size={21} color={palette.amber} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="subtitle">Review a possible unlogged meal</AppText>
                  <AppText variant="caption" color={palette.textMuted}>
                    {observedRiseMgDl
                      ? `The app found an observed rise of about ${observedRiseMgDl} mg/dL without a nearby saved meal.`
                      : 'The app found an observed rise without a nearby saved meal.'}
                  </AppText>
                </View>
              </View>
              <AppText variant="caption" color={palette.textMuted}>
                The date and time are prefilled at the start of the rise. This pattern cannot identify food or prove what caused it, so review or change every detail before saving.
              </AppText>
            </Card>
          ) : null}
          <Card style={styles.formCard}>
            <FormField label="Meal name" value={name} onChangeText={setName} placeholder="Example: Vegetable grain bowl" autoCapitalize="sentences" error={errors.name} />
            <FormField label="Description (optional)" value={description} onChangeText={setDescription} placeholder="Main ingredients or preparation" multiline />
            <FormRow>
              <FormField label="Date" value={dateValue} onChangeText={setDateValue} placeholder="YYYY-MM-DD" autoCapitalize="none" error={errors.dateTime} />
              <FormField label="Time" value={timeValue} onChangeText={setTimeValue} placeholder="HH:mm" keyboardType="numbers-and-punctuation" />
            </FormRow>
          </Card>

          <VoiceMealEntry
            initialMealTime={timeValue}
            onAddToMeal={addVoiceMealDraftToSession}
          />

          {!isNew && existingMeal ? (
            <View style={styles.section}>
              <View style={styles.responseHeading}>
                <View style={styles.responseIcon}>
                  <Activity size={21} color={palette.cyan} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="subtitle">Observed glucose response</AppText>
                  <AppText variant="caption" color={palette.textMuted}>
                    30 minutes before through 3 hours after the saved meal time.
                  </AppText>
                </View>
              </View>

              {mealResponse.isLoading ? (
                <StatePanel
                  loading
                  title="Analyzing glucose response"
                  message="Reviewing readings around this saved meal."
                />
              ) : mealResponse.error ? (
                <StatePanel
                  title="Glucose response unavailable"
                  message={mealResponse.error}
                  action={
                    <AppButton
                      label="Try again"
                      variant="secondary"
                      onPress={() => void mealResponse.refresh()}
                    />
                  }
                />
              ) : settings.glucoseDataSource === 'none' ? (
                <StatePanel
                  title="No glucose source selected"
                  message="Choose fictional sample data or a permitted native health source in Settings."
                />
              ) : !mealResponse.response ||
                mealResponse.response.dataQuality === 'insufficient' ? (
                <StatePanel
                  title="Not enough glucose data"
                  message="There are not enough valid readings around this meal to estimate a response. Missing CGM data is left as a gap."
                />
              ) : (
                <>
                  {mealResponse.response.dataQuality === 'limited' ? (
                    <Card style={styles.qualityNotice}>
                      <AppText variant="bodyStrong" color={palette.amber}>
                        Limited glucose data
                      </AppText>
                      <AppText variant="caption" color={palette.textMuted}>
                        Some metrics are unavailable because the baseline, timing coverage,
                        or sampling intervals were incomplete.
                      </AppText>
                    </Card>
                  ) : null}
                  <MetricGrid>
                    <MetricCard
                      label="Baseline"
                      value={formatGlucoseMetric(
                        mealResponse.response.baselineGlucoseMgDl
                      )}
                      helper="mg/dL"
                    />
                    <MetricCard
                      label="Peak"
                      value={formatGlucoseMetric(
                        mealResponse.response.peakGlucoseMgDl
                      )}
                      helper="mg/dL"
                    />
                    <MetricCard
                      label="Rise"
                      value={formatSignedGlucoseMetric(
                        mealResponse.response.glucoseRiseMgDl
                      )}
                      helper="mg/dL"
                    />
                    <MetricCard
                      label="Time to peak"
                      value={formatMinuteMetric(
                        mealResponse.response.timeToPeakMinutes
                      )}
                      helper="after meal"
                    />
                    <MetricCard
                      label="1 hour"
                      value={formatGlucoseMetric(
                        mealResponse.response.glucoseAt60MinutesMgDl
                      )}
                      helper="mg/dL"
                    />
                    <MetricCard
                      label="2 hours"
                      value={formatGlucoseMetric(
                        mealResponse.response.glucoseAt120MinutesMgDl
                      )}
                      helper="mg/dL"
                    />
                    <MetricCard
                      label="Incremental AUC"
                      value={formatGlucoseMetric(
                        mealResponse.response.incrementalAuc
                      )}
                      helper="mg/dL × min"
                    />
                    <MetricCard
                      label="Return near baseline"
                      value={formatMinuteMetric(
                        mealResponse.response.returnToBaselineMinutes
                      )}
                      helper="baseline ±5 mg/dL"
                    />
                  </MetricGrid>
                  {mealResponse.readings.length > 1 ? (
                    <Card>
                      <MealGlucoseChart
                        readings={mealResponse.readings}
                        mealTimestamp={existingMeal.timestamp}
                        targetRange={settings.targetRange}
                        baselineMgDl={
                          mealResponse.response.baselineGlucoseMgDl
                        }
                      />
                    </Card>
                  ) : null}
                  <AppText variant="caption" color={palette.textMuted}>
                    Based on {mealResponse.response.sampleCount} valid surrounding
                    readings. This is a descriptive association, not a diagnosis or
                    treatment recommendation.
                  </AppText>
                </>
              )}
            </View>
          ) : null}

          <View style={styles.section}>
            <AppText variant="subtitle">Meal image</AppText>
            {imageUri ? <Image source={{ uri: imageUri }} style={styles.mealImage} contentFit="cover" /> : null}
            <FormRow>
              <View style={styles.flex}>
                <AppButton label="Photo library" variant="secondary" icon={<ImagePlus size={18} color={palette.blue} />} onPress={() => void pickImage()} />
              </View>
              <View style={styles.flex}>
                <AppButton label="Camera" variant="secondary" icon={<Camera size={18} color={palette.blue} />} onPress={() => void takePhoto()} />
              </View>
            </FormRow>
            <AppText variant="caption" color={palette.textMuted}>
              Photos can be attached to the meal record and are not analyzed.
            </AppText>
          </View>

          <Card style={styles.formCard}>
            <AppText variant="subtitle">Estimated nutrition (optional)</AppText>
            <View style={styles.nutritionSourceNotice}>
              <AppText variant="bodyStrong" color={palette.purple}>
                {nutritionSourceLabel(nutritionSource)}
              </AppText>
              <AppText variant="caption" color={palette.textMuted}>
                {nutritionSource === 'manual'
                  ? 'Values are entered and reviewed by the user.'
                  : nutritionSource === 'ai-estimated'
                    ? 'Extracted foods and nutrition estimates require user review.'
                    : 'An extracted estimate was changed by the user before saving.'}
              </AppText>
            </View>
            <FormField
              label="Foods (comma separated)"
              value={foodNames}
              onChangeText={(value) => {
                setFoodNames(value);
                markNutritionEdited();
              }}
              placeholder="Example: Brown rice, salmon, vegetables"
              helper="Review and edit any extracted food names."
            />
            <FormRow>
              <FormField label="Calories" value={calories} onChangeText={(value) => updateNutritionValue(setCalories, value)} keyboardType="decimal-pad" />
              <FormField label="Carbs (g)" value={carbs} onChangeText={(value) => updateNutritionValue(setCarbs, value)} keyboardType="decimal-pad" />
            </FormRow>
            <FormRow>
              <FormField label="Protein (g)" value={protein} onChangeText={(value) => updateNutritionValue(setProtein, value)} keyboardType="decimal-pad" />
              <FormField label="Fat (g)" value={fat} onChangeText={(value) => updateNutritionValue(setFat, value)} keyboardType="decimal-pad" />
            </FormRow>
            <FormField label="Fiber (g)" value={fiber} onChangeText={(value) => updateNutritionValue(setFiber, value)} keyboardType="decimal-pad" error={errors.nutrition} />
            <FormField label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="How you felt, context, or reminders" multiline />
          </Card>

          {!isNew ? (
            <AppButton label="Delete meal" variant="danger" icon={<Trash2 size={18} color={palette.red} />} onPress={confirmDelete} />
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <AppButton label={isNew ? 'Save meal' : 'Save changes'} loading={isSaving} onPress={() => void submit()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatGlucoseMetric(value: number | undefined): string {
  return value === undefined ? '—' : String(Math.round(value));
}

function formatSignedGlucoseMetric(value: number | undefined): string {
  if (value === undefined) return '—';
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function formatMinuteMetric(value: number | undefined): string {
  return value === undefined ? '—' : `${Math.round(value)} min`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  header: { minHeight: 56, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border, backgroundColor: palette.surface },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  headerSpacer: { width: 44 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  loadingWrap: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  formCard: { gap: spacing.lg },
  section: { gap: spacing.md },
  responseHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  responseIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.cyanSoft, alignItems: 'center', justifyContent: 'center' },
  qualityNotice: { gap: spacing.xs, backgroundColor: palette.amberSoft },
  observedRiseNotice: { gap: spacing.md, backgroundColor: palette.amberSoft },
  observedRiseHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  nutritionSourceNotice: { gap: spacing.xs, padding: spacing.md, borderRadius: radii.sm, backgroundColor: palette.purpleSoft },
  mealImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: radii.sm, backgroundColor: palette.surfaceMuted },
  footer: { padding: spacing.lg, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border, backgroundColor: palette.surface },
});
