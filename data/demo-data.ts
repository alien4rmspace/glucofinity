import type { DemoMeal, DemoSettings } from "@/types/demo";

export const initialDemoMeals: DemoMeal[] = [
  {
    id: "meal-breakfast",
    name: "Oatmeal with berries",
    time: "8:10 AM",
    carbohydrates: 48,
    protein: 12,
    fat: 9,
    note: "Fictional breakfast entry",
    source: "seed",
  },
  {
    id: "meal-lunch",
    name: "Salmon rice bowl",
    time: "12:35 PM",
    carbohydrates: 63,
    protein: 34,
    fat: 18,
    note: "Fictional lunch entry with a 24-minute walk logged afterward",
    source: "seed",
  },
  {
    id: "meal-dinner",
    name: "Lentil vegetable soup",
    time: "6:42 PM",
    carbohydrates: 41,
    protein: 19,
    fat: 8,
    note: "Fictional dinner entry",
    source: "seed",
  },
];

export const defaultDemoSettings: DemoSettings = {
  showMockData: true,
  targetLow: 70,
  targetHigh: 180,
};
