import type { LocalNutritionEstimate, MacroNutrients } from './nutrition';

export interface AppliedVoiceMealDraft {
  transcript: string;
  mealName: string;
  mealTime: string;
  foods: string[];
  nutrition: MacroNutrients;
  nutritionEstimate: LocalNutritionEstimate;
  providerId: string;
  model: string;
  generatedAt: string;
  edited: boolean;
}
