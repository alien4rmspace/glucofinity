import { FOOD_SCORE_CONFIG, PRODUCT_SCORE_LABELS } from '@/data/product-score-config';
import type {
  FoodScoreResult,
  IngredientAnalysis,
  ProductNutritionFacts,
  ScoreContribution,
} from '@/types/product-scoring';

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function labelForProductScore(score: number | undefined): string {
  if (score === undefined) return 'Not rated';
  return PRODUCT_SCORE_LABELS.find(({ minimum }) => score >= minimum)?.label ?? 'Not rated';
}

function points(value: number): number {
  return Math.max(0, Math.round(value));
}

function negativeContribution(
  id: string,
  label: string,
  magnitude: number,
  explanation: string,
): ScoreContribution | undefined {
  const rounded = points(magnitude);
  return rounded > 0 ? { id, label, value: -rounded, explanation } : undefined;
}

function positiveContribution(
  id: string,
  label: string,
  value: number,
  explanation: string,
): ScoreContribution | undefined {
  const rounded = points(value);
  return rounded > 0 ? { id, label, value: rounded, explanation } : undefined;
}

function capPositiveContributions(
  contributions: readonly ScoreContribution[],
  maximum: number,
): ScoreContribution[] {
  let remaining = maximum;
  return contributions.flatMap((contribution) => {
    const value = Math.min(contribution.value, remaining);
    remaining -= value;
    return value > 0 ? [{ ...contribution, value }] : [];
  });
}

export function calculateOverallFoodScore(
  nutrition: ProductNutritionFacts | undefined,
  ingredients: IngredientAnalysis,
): FoodScoreResult {
  const negative: (ScoreContribution | undefined)[] = [];
  const positive: (ScoreContribution | undefined)[] = [];
  const unavailableData: string[] = [];
  const facts = nutrition;

  if (ingredients.processingLevel === 'unknown') unavailableData.push('Ingredient list');

  if (facts?.addedSugarGrams !== undefined) {
    const percentDailyValue = (facts.addedSugarGrams / FOOD_SCORE_CONFIG.addedSugarDailyValueGrams) * 100;
    negative.push(negativeContribution(
      'added-sugar',
      `${formatNumber(facts.addedSugarGrams)} g added sugar`,
      FOOD_SCORE_CONFIG.addedSugarMaximumPenalty * Math.min(
        percentDailyValue / FOOD_SCORE_CONFIG.addedSugarFullPenaltyPercentDailyValue,
        1,
      ),
      `About ${Math.round(percentDailyValue)}% of the 50 g FDA Daily Value per serving.`,
    ));
  } else unavailableData.push('Added sugar');

  const carbohydrates = facts?.totalCarbohydratesGrams;
  const fiber = facts?.dietaryFiberGrams;
  if (ingredients.refinedCarbohydrates.length > 0) {
    const netCarbohydrates = carbohydrates === undefined || fiber === undefined
      ? undefined
      : Math.max(0, carbohydrates - fiber);
    const firstPosition = ingredients.refinedCarbohydrates[0].position;
    const positionWeight = firstPosition <= 3 ? 1 : 0.6;
    const magnitude = netCarbohydrates === undefined
      ? 3 * positionWeight
      : FOOD_SCORE_CONFIG.refinedCarbohydrateMaximumPenalty *
        Math.min(netCarbohydrates / FOOD_SCORE_CONFIG.refinedCarbohydrateFullPenaltyGrams, 1) *
        positionWeight;
    negative.push(negativeContribution(
      'refined-carbohydrate',
      'Refined carbohydrate sources',
      magnitude,
      `${ingredients.refinedCarbohydrates[0].ingredient} is listed${firstPosition <= 3 ? ' among the first three ingredients' : ''}.`,
    ));
  }

  if (facts?.saturatedFatGrams !== undefined) {
    negative.push(negativeContribution(
      'saturated-fat',
      `${formatNumber(facts.saturatedFatGrams)} g saturated fat`,
      FOOD_SCORE_CONFIG.saturatedFatMaximumPenalty * Math.min(
        facts.saturatedFatGrams / FOOD_SCORE_CONFIG.saturatedFatFullPenaltyGrams,
        1,
      ),
      'Penalty rises with the amount per serving and reaches its configured maximum at 10 g.',
    ));
  } else unavailableData.push('Saturated fat');

  if (facts?.sodiumMilligrams !== undefined) {
    negative.push(negativeContribution(
      'sodium',
      `${formatNumber(facts.sodiumMilligrams)} mg sodium`,
      FOOD_SCORE_CONFIG.sodiumMaximumPenalty * Math.min(
        facts.sodiumMilligrams / FOOD_SCORE_CONFIG.sodiumFullPenaltyMilligrams,
        1,
      ),
      'Penalty reaches its configured maximum at half of the 2,300 mg Daily Value.',
    ));
  } else unavailableData.push('Sodium');

  if (facts?.transFatGrams !== undefined) {
    negative.push(negativeContribution(
      'trans-fat',
      `${formatNumber(facts.transFatGrams)} g trans fat`,
      FOOD_SCORE_CONFIG.transFatMaximumPenalty * Math.min(
        facts.transFatGrams / FOOD_SCORE_CONFIG.transFatFullPenaltyGrams,
        1,
      ),
      'Any reported trans fat receives a substantial, amount-based penalty.',
    ));
  } else unavailableData.push('Trans fat');

  if (carbohydrates !== undefined && fiber !== undefined &&
      carbohydrates >= 15 && fiber < FOOD_SCORE_CONFIG.lowFiberThresholdGrams) {
    negative.push(negativeContribution(
      'low-fiber',
      'Low fiber for the carbohydrate amount',
      FOOD_SCORE_CONFIG.lowFiberMaximumPenalty *
        (1 - fiber / FOOD_SCORE_CONFIG.lowFiberThresholdGrams),
      `${formatNumber(fiber)} g fiber is listed with ${formatNumber(carbohydrates)} g carbohydrate per serving.`,
    ));
  }

  if (fiber !== undefined) {
    positive.push(positiveContribution(
      'fiber',
      `${formatNumber(fiber)} g fiber`,
      FOOD_SCORE_CONFIG.fiberMaximumBonus * Math.min(
        fiber / FOOD_SCORE_CONFIG.fiberFullBonusGrams,
        1,
      ),
      'Fiber contributes up to the configured 10-point maximum.',
    ));
  } else unavailableData.push('Dietary fiber');

  if (facts?.proteinGrams !== undefined) {
    positive.push(positiveContribution(
      'protein',
      `${formatNumber(facts.proteinGrams)} g protein`,
      FOOD_SCORE_CONFIG.proteinMaximumBonus * Math.min(
        facts.proteinGrams / FOOD_SCORE_CONFIG.proteinFullBonusGrams,
        1,
      ),
      'Protein receives a limited bonus and cannot dominate the score.',
    ));
  } else unavailableData.push('Protein');

  if (ingredients.wholeFoods.length > 0) {
    const firstPosition = ingredients.wholeFoods[0].position;
    positive.push(positiveContribution(
      'whole-food-ingredients',
      'Whole-food ingredients',
      Math.min(
        FOOD_SCORE_CONFIG.wholeFoodMaximumBonus,
        3 + ingredients.wholeFoods.length * 2 + (firstPosition <= 3 ? 2 : 0),
      ),
      `${ingredients.wholeFoods[0].ingredient} is a reviewed whole-food ingredient${firstPosition <= 3 ? ' listed early' : ''}.`,
    ));
  }

  if (ingredients.processingLevel === 'moderate') {
    negative.push(negativeContribution(
      'processing-level',
      'Moderately processed',
      FOOD_SCORE_CONFIG.moderateProcessingPenalty,
      ingredients.processingExplanation,
    ));
  } else if (ingredients.processingLevel === 'high') {
    negative.push(negativeContribution(
      'processing-level',
      'Highly processed',
      FOOD_SCORE_CONFIG.highProcessingPenalty,
      ingredients.processingExplanation,
    ));
  }

  const positiveContributions = capPositiveContributions(
    positive.filter((item): item is ScoreContribution => Boolean(item)),
    FOOD_SCORE_CONFIG.maximumPositivePoints,
  );
  const negativeContributions = negative.filter(
    (item): item is ScoreContribution => Boolean(item),
  );
  const hasScoredNutrition = [
    facts?.addedSugarGrams,
    facts?.saturatedFatGrams,
    facts?.sodiumMilligrams,
    facts?.transFatGrams,
    facts?.dietaryFiberGrams,
    facts?.proteinGrams,
  ].some((value) => typeof value === 'number');
  if (!hasScoredNutrition) {
    return {
      label: 'Not rated',
      positiveContributions: [],
      negativeContributions: [],
      unavailableData: ['Serving nutrition', ...new Set(unavailableData)],
      summary: 'There is not enough measurable serving nutrition to calculate an overall score. Ingredient and processing observations remain separate.',
    };
  }
  const score = clampScore(
    FOOD_SCORE_CONFIG.baseline +
    positiveContributions.reduce((sum, contribution) => sum + contribution.value, 0) +
    negativeContributions.reduce((sum, contribution) => sum + contribution.value, 0),
  );
  return {
    score,
    label: labelForProductScore(score),
    baseline: FOOD_SCORE_CONFIG.baseline,
    positiveContributions,
    negativeContributions,
    unavailableData: [...new Set(unavailableData)],
    summary: 'A deterministic serving-level nutrition score with a neutral baseline and visible bonuses and penalties.',
  };
}

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}
