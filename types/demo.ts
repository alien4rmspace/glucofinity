export type DemoTab = "dashboard" | "meals" | "trends" | "insights" | "settings";

export type DemoMeal = {
  id: string;
  name: string;
  time: string;
  carbohydrates: number;
  protein: number;
  fat: number;
  note: string;
  source: "seed" | "manual" | "simulated-estimate";
};

export type DemoSettings = {
  showMockData: boolean;
  targetLow: number;
  targetHigh: number;
};

export type DemoMealDraft = Omit<DemoMeal, "id">;
