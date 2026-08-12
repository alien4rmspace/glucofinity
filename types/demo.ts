import type { NutritionEstimateSource } from "@/types/ai";

export type DemoTab = "dashboard" | "meals" | "trends" | "insights" | "settings";

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
  voiceTranscript?: string;
};

export type DemoSettings = {
  showMockData: boolean;
  targetLow: number;
  targetHigh: number;
};

export type DemoMealDraft = Omit<DemoMeal, "id" | "timestamp">;
