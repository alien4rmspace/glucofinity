import type { NutritionEstimateSource } from "@/types/ai";

export type DemoTab = "dashboard" | "meals" | "trends" | "insights" | "settings";

export type DemoFitnessPreviewState =
  | "not-selected"
  | "records"
  | "empty"
  | "unavailable";

export type DemoFitnessWorkout = {
  id: string;
  activityType: string;
  startTime: string;
  durationMinutes: number;
  sourceName: string;
};

export type DemoFitnessSummary = {
  stepCount: number;
  activeEnergyKilocalories: number;
  workouts: DemoFitnessWorkout[];
};

export type DemoMeal = {
  id: string;
  timestamp: string;
  name: string;
  time: string;
  carbohydrates?: number;
  protein?: number;
  fat?: number;
  fiber?: number;
  calories?: number;
  foods: string;
  note: string;
  source: "seed" | "manual" | "simulated-estimate" | "voice-local-ai";
  nutritionSource: NutritionEstimateSource;
  analysisProvider?: string;
  analysisModel?: string;
  analysisGeneratedAt?: string;
  nutritionProvider?: string;
  nutritionModel?: string;
  nutritionMatchedFoods?: number;
  nutritionTotalFoods?: number;
  voiceTranscript?: string;
};

export type DemoSettings = {
  showMockData: boolean;
  fitnessPreviewState: DemoFitnessPreviewState;
  targetLow: number;
  targetHigh: number;
};

export type DemoMealDraft = Omit<DemoMeal, "id" | "timestamp">;
