import { deriveMealNameFromFoods } from './meal-transcript-extraction';
import type { FoodEstimate, NutritionEstimateSource } from '../types/ai';
import type { AppliedVoiceMealDraft } from '../types/voice-meal';

export interface VoiceMealSessionState {
  name: string;
  description: string;
  timeValue: string;
  foodNames: string;
  foodEstimates: FoodEstimate[];
  calories: string;
  carbohydratesGrams: string;
  proteinGrams: string;
  fatGrams: string;
  fiberGrams: string;
  nutritionSource: NutritionEstimateSource;
}

export interface MergedVoiceMealSession extends VoiceMealSessionState {
  providerId: string;
  model: string;
  generatedAt: string;
}

function foodNamesFromText(value: string): string[] {
  return value
    .split(',')
    .map((food) => food.trim())
    .filter(Boolean);
}

function localFoodEstimates(draft: AppliedVoiceMealDraft): FoodEstimate[] {
  return draft.nutritionEstimate.foods.map((estimate) => ({
    name: estimate.input,
    estimatedGrams: estimate.estimatedGrams,
    calories: estimate.nutrients?.calories,
    carbohydratesGrams: estimate.nutrients?.carbohydratesGrams,
    proteinGrams: estimate.nutrients?.proteinGrams,
    fatGrams: estimate.nutrients?.fatGrams,
    fiberGrams: estimate.nutrients?.fiberGrams,
    confidence: estimate.confidence,
  }));
}

function formattedNutritionTotal(currentValue: string, addedValue: number): string {
  const trimmed = currentValue.trim();
  const parsedCurrent = trimmed ? Number(trimmed) : 0;
  if (!Number.isFinite(parsedCurrent) || parsedCurrent < 0) return currentValue;
  const rounded = Math.round((parsedCurrent + addedValue) * 100) / 100;
  return String(rounded);
}

function appendTranscript(currentDescription: string, transcript: string): string {
  const current = currentDescription.trim();
  const added = transcript.trim();
  if (!current) return added;
  if (!added || current.toLocaleLowerCase().includes(added.toLocaleLowerCase())) {
    return currentDescription;
  }
  return `${current}\n${added}`;
}

function hasMealContent(current: VoiceMealSessionState): boolean {
  return Boolean(
    current.name.trim() ||
      current.description.trim() ||
      current.foodNames.trim() ||
      current.calories.trim() ||
      current.carbohydratesGrams.trim() ||
      current.proteinGrams.trim() ||
      current.fatGrams.trim() ||
      current.fiberGrams.trim(),
  );
}

/**
 * Adds a reviewed voice draft to the open meal form only. Persistence remains
 * the responsibility of the meal form's explicit Save meal action.
 */
export function mergeVoiceDraftIntoMealSession(
  current: VoiceMealSessionState,
  draft: AppliedVoiceMealDraft,
): MergedVoiceMealSession {
  const currentFoods = foodNamesFromText(current.foodNames);
  const combinedFoods = [...currentFoods, ...draft.foods];
  const derivedCurrentName = deriveMealNameFromFoods(currentFoods);
  const currentNameWasDerived = Boolean(
    derivedCurrentName && current.name.trim() === derivedCurrentName,
  );
  const combinedDerivedName = deriveMealNameFromFoods(combinedFoods);
  const keepCurrentName = current.name.trim() && !currentNameWasDerived;
  const existingEstimates = currentFoods.map((food, index) => ({
    ...(current.foodEstimates[index] ?? {}),
    name: food,
  }));
  const alreadyHadContent = hasMealContent(current);

  return {
    name: keepCurrentName
      ? current.name
      : combinedDerivedName ?? draft.mealName.trim() ?? current.name,
    description: appendTranscript(current.description, draft.transcript),
    timeValue: alreadyHadContent ? current.timeValue : draft.mealTime,
    foodNames: combinedFoods.join(', '),
    foodEstimates: [...existingEstimates, ...localFoodEstimates(draft)],
    calories: formattedNutritionTotal(current.calories, draft.nutrition.calories),
    carbohydratesGrams: formattedNutritionTotal(
      current.carbohydratesGrams,
      draft.nutrition.carbohydratesGrams,
    ),
    proteinGrams: formattedNutritionTotal(
      current.proteinGrams,
      draft.nutrition.proteinGrams,
    ),
    fatGrams: formattedNutritionTotal(current.fatGrams, draft.nutrition.fatGrams),
    fiberGrams: formattedNutritionTotal(current.fiberGrams, draft.nutrition.fiberGrams),
    nutritionSource:
      alreadyHadContent || draft.edited ? 'ai-corrected' : 'ai-estimated',
    providerId: draft.providerId,
    model: draft.model,
    generatedAt: draft.generatedAt,
  };
}
