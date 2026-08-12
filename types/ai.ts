export type NutritionEstimateSource =
  | "manual"
  | "ai-estimated"
  | "ai-corrected";

export type FoodEstimate = {
  name: string;
  estimatedGrams?: number;
  calories?: number;
  carbohydratesGrams?: number;
  proteinGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  confidence?: number;
};

export type MealAnalysis = {
  foods: FoodEstimate[];
  totalCalories?: number;
  totalCarbohydratesGrams?: number;
  totalProteinGrams?: number;
  totalFatGrams?: number;
  totalFiberGrams?: number;
  confidence?: number;
  providerId?: string;
  model?: string;
  generatedAt: string;
};

export type MealPredictionFeatures = {
  carbohydratesGrams?: number;
  proteinGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  calories?: number;
  baselineGlucoseMgDl?: number;
  recentGlucoseSlopeMgDlPerMinute?: number;
  recentGlucoseMeanMgDl?: number;
  recentGlucoseVariabilityMgDl?: number;
  minutesSincePreviousMeal?: number;
  hourOfDay: number;
  dayOfWeek: number;
  recentExerciseMinutes?: number;
  sleepDurationHours?: number;
  historicalSimilarMealResponseMgDl?: number;
};

export type GeneratedMealPredictionFeatures = {
  featureVersion: string;
  mealId: string;
  features: MealPredictionFeatures;
};

export type InsightEvidence = {
  sampleSize: number;
  sampleUnit: "readings" | "meals" | "observations";
  dateRange?: { start: string; end: string };
  metricDifference?: number;
  metrics?: { label: string; value: number; unit: string }[];
  comparisonGroups?: {
    label: string;
    sampleSize: number;
    meanValue: number;
    unit: string;
  }[];
};

export type GlucoseInsight = {
  id: string;
  title: string;
  description: string;
  evidence: InsightEvidence;
  generatedAt: string;
};
