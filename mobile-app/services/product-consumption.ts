import type { ProductBarcodeRecord } from '@/services/nutrition-catalog';
import type { FoodEstimate } from '@/types/ai';
import type { MealEntry, MealGlucoseResponse } from '@/types/health';
import type {
  ProductConsumptionEvent,
  ProductNutritionFacts,
} from '@/types/product-scoring';

const MAX_SERVING_QUANTITY = 20;

export function normalizeServingQuantity(value: number): number | undefined {
  if (!Number.isFinite(value) || value <= 0 || value > MAX_SERVING_QUANTITY) return undefined;
  return Math.round(value * 100) / 100;
}

function scaled(value: number | undefined, quantity: number): number | undefined {
  return value === undefined ? undefined : Math.round(value * quantity * 100) / 100;
}

export function scaleProductNutrition(
  nutrition: ProductNutritionFacts | undefined,
  quantity: number,
): ProductNutritionFacts | undefined {
  const normalizedQuantity = normalizeServingQuantity(quantity);
  if (!nutrition || normalizedQuantity === undefined) return undefined;
  return {
    basis: 'serving',
    servingLabel: normalizedQuantity === 1
      ? nutrition.servingLabel
      : `${normalizedQuantity} × ${nutrition.servingLabel}`,
    servingGrams: scaled(nutrition.servingGrams, normalizedQuantity),
    calories: scaled(nutrition.calories, normalizedQuantity),
    totalCarbohydratesGrams: scaled(
      nutrition.totalCarbohydratesGrams,
      normalizedQuantity,
    ),
    dietaryFiberGrams: scaled(nutrition.dietaryFiberGrams, normalizedQuantity),
    totalSugarGrams: scaled(nutrition.totalSugarGrams, normalizedQuantity),
    addedSugarGrams: scaled(nutrition.addedSugarGrams, normalizedQuantity),
    proteinGrams: scaled(nutrition.proteinGrams, normalizedQuantity),
    totalFatGrams: scaled(nutrition.totalFatGrams, normalizedQuantity),
    saturatedFatGrams: scaled(nutrition.saturatedFatGrams, normalizedQuantity),
    transFatGrams: scaled(nutrition.transFatGrams, normalizedQuantity),
    sodiumMilligrams: scaled(nutrition.sodiumMilligrams, normalizedQuantity),
  };
}

export function buildProductMealEntry(
  product: ProductBarcodeRecord,
  quantity: number,
  occurredAt = new Date(),
): MealEntry {
  const normalizedQuantity = normalizeServingQuantity(quantity);
  if (normalizedQuantity === undefined || !Number.isFinite(occurredAt.getTime())) {
    throw new Error('Choose a serving quantity between 0.01 and 20.');
  }
  const nutrition = scaleProductNutrition(product.nutrition, normalizedQuantity);
  const food: FoodEstimate = {
    name: product.name,
    estimatedGrams: nutrition?.servingGrams,
    calories: nutrition?.calories,
    carbohydratesGrams: nutrition?.totalCarbohydratesGrams,
    proteinGrams: nutrition?.proteinGrams,
    fatGrams: nutrition?.totalFatGrams,
    fiberGrams: nutrition?.dietaryFiberGrams,
  };
  const timestamp = occurredAt.toISOString();
  return {
    id: `meal-product-${occurredAt.getTime()}`,
    timestamp,
    timezoneOffsetMinutes: occurredAt.getTimezoneOffset(),
    name: product.name,
    description: `${normalizedQuantity} × ${product.nutrition?.servingLabel ?? 'serving'}${product.brand ? ` · ${product.brand}` : ''}`,
    estimatedCarbsGrams: nutrition?.totalCarbohydratesGrams,
    proteinGrams: nutrition?.proteinGrams,
    fatGrams: nutrition?.totalFatGrams,
    fiberGrams: nutrition?.dietaryFiberGrams,
    nutritionEstimate: {
      foods: [food],
      calories: nutrition?.calories,
      carbohydratesGrams: nutrition?.totalCarbohydratesGrams,
      proteinGrams: nutrition?.proteinGrams,
      fatGrams: nutrition?.totalFatGrams,
      fiberGrams: nutrition?.dietaryFiberGrams,
      source: 'usda-label',
      providerId: 'usda-fdc-branded-local-v2',
      generatedAt: timestamp,
    },
    productContext: {
      schemaVersion: 1,
      productId: product.productId,
      gtin14: product.gtin14,
      fdcId: product.fdcId,
      servingQuantity: normalizedQuantity,
      servingLabel: product.nutrition?.servingLabel ?? 'Serving not stated',
      servingGrams: nutrition?.servingGrams,
      nutritionPerServing: product.nutrition,
    },
  };
}

export function productConsumptionEventFromMeal(
  meal: MealEntry,
  response?: MealGlucoseResponse,
  context: Pick<
    ProductConsumptionEvent,
    'recentExerciseMinutes' | 'sleepDurationHours' | 'otherMealContext'
  > = {},
): ProductConsumptionEvent | undefined {
  const product = meal.productContext;
  if (!product) return undefined;
  return {
    eventId: `product-event:${meal.id}`,
    productId: product.productId,
    mealId: meal.id,
    timestamp: meal.timestamp,
    servingQuantity: product.servingQuantity,
    servingGrams: product.servingGrams,
    glucoseBeforeMgDl: response?.baselineGlucoseMgDl,
    glucosePeakMgDl: response?.peakGlucoseMgDl,
    glucoseChangeMgDl: response?.glucoseRiseMgDl,
    incrementalAuc: response?.incrementalAuc,
    timeToPeakMinutes: response?.timeToPeakMinutes,
    returnToBaselineMinutes: response?.returnToBaselineMinutes,
    ...context,
  };
}
