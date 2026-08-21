import { GLUCOSE_IMPACT_CONFIG } from '@/data/product-score-config';
import { formatNumber, labelForProductScore } from '@/services/food-score-engine';
import type {
  FoodScoreResult,
  IngredientAnalysis,
  ProductNutritionFacts,
  ScoreContribution,
} from '@/types/product-scoring';

export interface GlucoseImpactCalculation {
  result: FoodScoreResult;
  estimatedNetCarbohydratesGrams?: number;
  estimatedRapidlyDigestibleCarbohydratesGrams?: number;
}

function contribution(
  id: string,
  label: string,
  value: number,
  explanation: string,
): ScoreContribution | undefined {
  const rounded = Math.round(value);
  return rounded === 0 ? undefined : { id, label, value: rounded, explanation };
}

export function calculateGlucoseImpactScore(
  nutrition: ProductNutritionFacts | undefined,
  ingredients: IngredientAnalysis,
): GlucoseImpactCalculation {
  const carbohydrates = nutrition?.totalCarbohydratesGrams;
  const fiber = nutrition?.dietaryFiberGrams;
  const unavailableData: string[] = [];
  if (carbohydrates === undefined) {
    return {
      result: {
        label: 'Not rated',
        positiveContributions: [],
        negativeContributions: [],
        unavailableData: ['Total carbohydrates'],
        summary: 'Estimated glucose impact requires total carbohydrate data for one serving.',
      },
    };
  }

  if (fiber === undefined) unavailableData.push('Dietary fiber');
  if (nutrition?.addedSugarGrams === undefined) unavailableData.push('Added sugar');
  if (nutrition?.totalSugarGrams === undefined) unavailableData.push('Total sugar');
  if (nutrition?.proteinGrams === undefined) unavailableData.push('Protein');
  if (nutrition?.totalFatGrams === undefined) unavailableData.push('Total fat');
  if (ingredients.processingLevel === 'unknown') unavailableData.push('Ingredient list');

  const estimatedNetCarbohydratesGrams = fiber === undefined
    ? undefined
    : Math.max(0, carbohydrates - fiber);
  const carbohydrateBasisGrams = estimatedNetCarbohydratesGrams ?? carbohydrates;
  const firstRefinedPosition = ingredients.refinedCarbohydrates[0]?.position;
  const firstWholeFoodPosition = ingredients.wholeFoods[0]?.position;
  const rapidFraction = firstRefinedPosition !== undefined
    ? firstRefinedPosition <= 3 ? 0.9 : 0.75
    : firstWholeFoodPosition !== undefined
      ? firstWholeFoodPosition <= 3 ? 0.45 : 0.55
      : 0.65;
  const estimatedRapidlyDigestibleCarbohydratesGrams = Math.round(
    carbohydrateBasisGrams * rapidFraction * 10,
  ) / 10;
  const negative: (ScoreContribution | undefined)[] = [];
  const positive: (ScoreContribution | undefined)[] = [];

  negative.push(contribution(
    'rapid-carbohydrates',
    `${formatNumber(estimatedRapidlyDigestibleCarbohydratesGrams)} g estimated rapidly digestible carbohydrate`,
    -GLUCOSE_IMPACT_CONFIG.rapidlyDigestibleCarbohydrateMaximumPenalty * Math.min(
      estimatedRapidlyDigestibleCarbohydratesGrams /
        GLUCOSE_IMPACT_CONFIG.rapidlyDigestibleCarbohydrateFullPenaltyGrams,
      1,
    ),
    fiber === undefined
      ? 'Because fiber is unavailable, this transparent heuristic uses reported total carbohydrate without assuming a fiber value; it is not a glycemic-index measurement.'
      : firstRefinedPosition !== undefined || firstWholeFoodPosition !== undefined
        ? 'A transparent heuristic combines estimated net carbohydrate with reviewed ingredient order; it is not a glycemic-index measurement.'
        : 'A transparent heuristic uses estimated net carbohydrate with a neutral carbohydrate-quality factor because no reviewed ingredient signal was identified; it is not a glycemic-index measurement.',
  ));

  if (nutrition?.addedSugarGrams !== undefined) {
    negative.push(contribution(
      'glucose-added-sugar',
      `${formatNumber(nutrition.addedSugarGrams)} g added sugar`,
      -GLUCOSE_IMPACT_CONFIG.addedSugarMaximumPenalty * Math.min(
        nutrition.addedSugarGrams / GLUCOSE_IMPACT_CONFIG.addedSugarFullPenaltyGrams,
        1,
      ),
      'Added sugar receives an amount-based glucose-impact penalty.',
    ));
  } else if (nutrition?.totalSugarGrams !== undefined) {
    negative.push(contribution(
      'glucose-total-sugar-fallback',
      `${formatNumber(nutrition.totalSugarGrams)} g total sugar`,
      -GLUCOSE_IMPACT_CONFIG.totalSugarFallbackMaximumPenalty * Math.min(
        nutrition.totalSugarGrams / GLUCOSE_IMPACT_CONFIG.totalSugarFallbackFullPenaltyGrams,
        1,
      ),
      'Total sugar is used with a smaller fallback weight because added sugar is unavailable.',
    ));
  }

  if (firstRefinedPosition !== undefined) {
    negative.push(contribution(
      'glucose-refined-ingredient',
      'Refined carbohydrate ingredient',
      -(firstRefinedPosition <= 3
        ? GLUCOSE_IMPACT_CONFIG.refinedCarbohydrateEarlyPenalty
        : GLUCOSE_IMPACT_CONFIG.refinedCarbohydrateLaterPenalty),
      `${ingredients.refinedCarbohydrates[0].ingredient} appears at position ${firstRefinedPosition}.`,
    ));
  }

  if (carbohydrates === 0) {
    positive.push(contribution(
      'zero-carbohydrate',
      'Zero carbohydrate reported',
      GLUCOSE_IMPACT_CONFIG.zeroCarbohydrateBonus,
      'The USDA serving record reports 0 g total carbohydrate.',
    ));
  }
  if (fiber !== undefined) {
    positive.push(contribution(
      'glucose-fiber',
      `${formatNumber(fiber)} g fiber`,
      GLUCOSE_IMPACT_CONFIG.fiberMaximumBonus * Math.min(
        fiber / GLUCOSE_IMPACT_CONFIG.fiberFullBonusGrams,
        1,
      ),
      'Fiber reduces estimated net carbohydrate and receives a limited bonus.',
    ));
  }
  if (nutrition?.proteinGrams !== undefined) {
    positive.push(contribution(
      'glucose-protein',
      `${formatNumber(nutrition.proteinGrams)} g protein`,
      GLUCOSE_IMPACT_CONFIG.proteinMaximumBonus * Math.min(
        nutrition.proteinGrams / GLUCOSE_IMPACT_CONFIG.proteinFullBonusGrams,
        1,
      ),
      'Meaningful protein receives a small, capped bonus.',
    ));
  }
  if (nutrition?.totalFatGrams !== undefined && carbohydrateBasisGrams > 0) {
    positive.push(contribution(
      'glucose-fat',
      `${formatNumber(nutrition.totalFatGrams)} g fat`,
      GLUCOSE_IMPACT_CONFIG.fatMaximumBonus * Math.min(
        nutrition.totalFatGrams / GLUCOSE_IMPACT_CONFIG.fatFullBonusGrams,
        1,
      ),
      'Fat may slow digestion, but its contribution is deliberately limited and is not a general-health benefit.',
    ));
  }

  const positiveContributions = positive.filter(
    (item): item is ScoreContribution => Boolean(item),
  );
  const negativeContributions = negative.filter(
    (item): item is ScoreContribution => Boolean(item),
  );
  const score = Math.max(0, Math.min(100, Math.round(
    GLUCOSE_IMPACT_CONFIG.baseline +
    positiveContributions.reduce((sum, item) => sum + item.value, 0) +
    negativeContributions.reduce((sum, item) => sum + item.value, 0),
  )));

  return {
    result: {
      score,
      label: labelForProductScore(score),
      baseline: GLUCOSE_IMPACT_CONFIG.baseline,
      positiveContributions,
      negativeContributions,
      unavailableData,
      summary: 'An estimated serving-level glucose impact based on available carbohydrate, fiber, sugar, protein, fat, and ingredient information. Individual responses may differ.',
    },
    estimatedNetCarbohydratesGrams,
    estimatedRapidlyDigestibleCarbohydratesGrams,
  };
}
