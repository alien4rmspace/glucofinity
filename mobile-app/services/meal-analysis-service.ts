/**
 * Compatibility exports for older imports. New code should use the provider-neutral
 * MealVisionProvider contract from meal-vision-provider directly.
 */
export {
  DeterministicMealVisionProvider as MockMealAnalysisService,
  mealVisionProvider as mealAnalysisService,
} from './meal-vision-provider';
export type { MealVisionProvider as MealAnalysisService } from './meal-vision-provider';
