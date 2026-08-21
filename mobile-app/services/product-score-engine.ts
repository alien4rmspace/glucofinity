import { calculateOverallFoodScore } from '@/services/food-score-engine';
import { calculateGlucoseImpactScore } from '@/services/glucose-impact-engine';
import { analyzeIngredients } from '@/services/ingredient-analyzer';
import { personalizedFoodScoreEngine } from '@/services/personalized-food-score-engine';
import type {
  ProductConsumptionEvent,
  ProductScoreInput,
  ProductScoreResult,
} from '@/types/product-scoring';

export function scoreProduct(
  product: ProductScoreInput,
  events: readonly ProductConsumptionEvent[] = [],
): ProductScoreResult {
  const ingredientAnalysis = analyzeIngredients(product.ingredients);
  const glucoseImpact = calculateGlucoseImpactScore(
    product.nutrition,
    ingredientAnalysis,
  );
  const personalizedScore = personalizedFoodScoreEngine.calculate(product, events);
  return {
    overallScore: calculateOverallFoodScore(product.nutrition, ingredientAnalysis),
    glucoseImpactScore: glucoseImpact.result,
    processingLevel: ingredientAnalysis.processingLevel,
    ingredientAnalysis,
    estimatedNetCarbohydratesGrams: glucoseImpact.estimatedNetCarbohydratesGrams,
    estimatedRapidlyDigestibleCarbohydratesGrams:
      glucoseImpact.estimatedRapidlyDigestibleCarbohydratesGrams,
    ...(personalizedScore ? { personalizedScore } : {}),
  };
}
