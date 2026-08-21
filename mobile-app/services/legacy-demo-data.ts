import type { MealEntry } from '@/types/health';

const LEGACY_SEEDED_MEAL_IDS = new Set([
  'mock-breakfast',
  'mock-lunch',
  'mock-dinner',
  'mock-dinner-yesterday',
]);

export function isLegacySeededMeal(meal: Pick<MealEntry, 'id'>): boolean {
  return LEGACY_SEEDED_MEAL_IDS.has(meal.id);
}

export function withoutLegacySeededMeals(meals: readonly MealEntry[]): MealEntry[] {
  return meals.filter((meal) => !isLegacySeededMeal(meal));
}
