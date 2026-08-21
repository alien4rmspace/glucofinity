import type {
  FoodScoreResult,
  ProductConsumptionEvent,
  ProductScoreInput,
} from '@/types/product-scoring';

export interface PersonalizedFoodScoreEngine {
  calculate(
    product: ProductScoreInput,
    events: readonly ProductConsumptionEvent[],
  ): FoodScoreResult | undefined;
}

export const MINIMUM_PERSONALIZED_PRODUCT_RESPONSES = 3;

/**
 * Personal scoring stays deliberately unavailable until a separately reviewed engine has
 * enough real, same-product CGM response events. This boundary prevents generic scores from
 * being presented as an individual's observed or predicted response.
 */
export const personalizedFoodScoreEngine: PersonalizedFoodScoreEngine = {
  calculate() {
    return undefined;
  },
};
