import type { FoodEstimate, MealAnalysis } from "@/types/ai";

export interface MealVisionProvider {
  readonly providerId: string;
  analyzeMeal(imageUri: string, userDescription?: string): Promise<MealAnalysis>;
}

function finiteOptional(value: number | undefined, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a nonnegative number.`);
  }
  return value;
}

function validateFood(food: FoodEstimate): FoodEstimate {
  if (!food.name.trim()) throw new Error("Every estimated food needs a name.");
  const confidence = finiteOptional(food.confidence, "Food confidence");
  if (confidence !== undefined && confidence > 1) {
    throw new Error("Food confidence must be between 0 and 1.");
  }
  return {
    ...food,
    name: food.name.trim(),
    estimatedGrams: finiteOptional(food.estimatedGrams, "Estimated grams"),
    calories: finiteOptional(food.calories, "Food calories"),
    carbohydratesGrams: finiteOptional(food.carbohydratesGrams, "Food carbohydrates"),
    proteinGrams: finiteOptional(food.proteinGrams, "Food protein"),
    fatGrams: finiteOptional(food.fatGrams, "Food fat"),
    fiberGrams: finiteOptional(food.fiberGrams, "Food fiber"),
    confidence,
  };
}

export function validateMealAnalysis(analysis: MealAnalysis): MealAnalysis {
  if (!Array.isArray(analysis.foods)) throw new Error("Meal foods must be a list.");
  if (!Number.isFinite(Date.parse(analysis.generatedAt))) {
    throw new Error("Meal analysis needs a valid generation timestamp.");
  }
  const confidence = finiteOptional(analysis.confidence, "Meal confidence");
  if (confidence !== undefined && confidence > 1) {
    throw new Error("Meal confidence must be between 0 and 1.");
  }
  return {
    ...analysis,
    foods: analysis.foods.map(validateFood),
    totalCalories: finiteOptional(analysis.totalCalories, "Total calories"),
    totalCarbohydratesGrams: finiteOptional(
      analysis.totalCarbohydratesGrams,
      "Total carbohydrates",
    ),
    totalProteinGrams: finiteOptional(analysis.totalProteinGrams, "Total protein"),
    totalFatGrams: finiteOptional(analysis.totalFatGrams, "Total fat"),
    totalFiberGrams: finiteOptional(analysis.totalFiberGrams, "Total fiber"),
    confidence,
    generatedAt: new Date(analysis.generatedAt).toISOString(),
  };
}

class DeterministicMealVisionProvider implements MealVisionProvider {
  readonly providerId = "deterministic-demo-provider";

  async analyzeMeal(imageUri: string, userDescription?: string): Promise<MealAnalysis> {
    if (!imageUri.trim()) throw new Error("A meal image reference is required.");
    const description = userDescription?.trim();
    return validateMealAnalysis({
      foods: [
        {
          name: description || "Vegetable grain bowl",
          estimatedGrams: 360,
          calories: 430,
          carbohydratesGrams: 46,
          proteinGrams: 22,
          fatGrams: 15,
          fiberGrams: 8,
          confidence: 0.62,
        },
      ],
      totalCalories: 430,
      totalCarbohydratesGrams: 46,
      totalProteinGrams: 22,
      totalFatGrams: 15,
      totalFiberGrams: 8,
      confidence: 0.62,
      providerId: this.providerId,
      model: "fixed-fixture-v1",
      generatedAt: "2026-08-11T12:00:00.000Z",
    });
  }
}

export const mealVisionProvider: MealVisionProvider =
  new DeterministicMealVisionProvider();
