export type ProductProcessingLevel = 'minimal' | 'moderate' | 'high' | 'unknown';

export interface ProductNutritionFacts {
  basis: 'serving';
  servingLabel: string;
  servingGrams?: number;
  calories?: number;
  totalCarbohydratesGrams?: number;
  dietaryFiberGrams?: number;
  totalSugarGrams?: number;
  addedSugarGrams?: number;
  proteinGrams?: number;
  totalFatGrams?: number;
  saturatedFatGrams?: number;
  transFatGrams?: number;
  sodiumMilligrams?: number;
}

export type IngredientCategory =
  | 'added-sugar'
  | 'refined-carbohydrate'
  | 'whole-food'
  | 'stabilizer-or-emulsifier'
  | 'flavor-or-color'
  | 'artificial-sweetener';

export interface IngredientFinding {
  id: string;
  ingredient: string;
  category: IngredientCategory;
  explanation: string;
  position: number;
}

export interface IngredientAnalysis {
  ingredientCount?: number;
  topLevelIngredients: string[];
  addedSugars: IngredientFinding[];
  refinedCarbohydrates: IngredientFinding[];
  wholeFoods: IngredientFinding[];
  processingSignals: IngredientFinding[];
  processingLevel: ProductProcessingLevel;
  processingExplanation: string;
}

export interface ScoreContribution {
  id: string;
  label: string;
  value: number;
  explanation: string;
}

export interface FoodScoreResult {
  score?: number;
  label: string;
  baseline?: number;
  positiveContributions: ScoreContribution[];
  negativeContributions: ScoreContribution[];
  unavailableData: string[];
  summary: string;
}

export interface ProductScoreInput {
  productId: string;
  nutrition?: ProductNutritionFacts;
  ingredients?: string;
}

export interface ProductScoreResult {
  overallScore: FoodScoreResult;
  glucoseImpactScore: FoodScoreResult;
  processingLevel: ProductProcessingLevel;
  ingredientAnalysis: IngredientAnalysis;
  estimatedNetCarbohydratesGrams?: number;
  estimatedRapidlyDigestibleCarbohydratesGrams?: number;
  personalizedScore?: FoodScoreResult;
}

export interface ProductConsumptionContext {
  schemaVersion: 1;
  productId: string;
  gtin14: string;
  fdcId: number;
  servingQuantity: number;
  servingLabel: string;
  servingGrams?: number;
  nutritionPerServing?: ProductNutritionFacts;
}

export interface ProductConsumptionEvent {
  eventId: string;
  productId: string;
  mealId: string;
  timestamp: string;
  servingQuantity: number;
  servingGrams?: number;
  glucoseBeforeMgDl?: number;
  glucosePeakMgDl?: number;
  glucoseChangeMgDl?: number;
  incrementalAuc?: number;
  timeToPeakMinutes?: number;
  returnToBaselineMinutes?: number;
  recentExerciseMinutes?: number;
  sleepDurationHours?: number;
  otherMealContext?: string;
}
