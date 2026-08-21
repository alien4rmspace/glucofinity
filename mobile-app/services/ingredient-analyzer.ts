import { topLevelIngredients } from '@/services/ingredient-review';
import type {
  IngredientAnalysis,
  IngredientCategory,
  IngredientFinding,
} from '@/types/product-scoring';

interface CategoryRule {
  category: IngredientCategory;
  pattern: RegExp;
  explanation: string;
}

const CATEGORY_RULES: readonly CategoryRule[] = [
  {
    category: 'added-sugar',
    pattern: /\b(?:agave(?: nectar| syrup)?|brown sugar|cane (?:juice|sugar|syrup)|corn syrup|dextrose|fructose|glucose|high[- ]fructose corn syrup|honey|invert sugar|maltose|maltodextrin|maple syrup|molasses|rice syrup|sucrose|sugar|tapioca syrup)\b/i,
    explanation: 'Listed as an added or isolated sweetener.',
  },
  {
    category: 'refined-carbohydrate',
    pattern: /\b(?:enriched (?:wheat )?flour|refined (?:wheat|rice) flour|white (?:flour|rice flour)|maltodextrin|modified (?:corn |food )?starch|tapioca starch|corn starch|cornstarch|rice flour)\b/i,
    explanation: 'A refined starch or rapidly absorbed carbohydrate source is listed.',
  },
  {
    category: 'whole-food',
    pattern: /\b(?:oats?|whole[- ]grain|whole wheat|brown rice|quinoa|barley|beans?|lentils?|chickpeas?|almonds?|walnuts?|peanuts?|cashews?|pistachios?|seeds?|flax|chia|whole fruit|apples?|berries|bananas?|vegetables?|carrots?|spinach|broccoli)\b/i,
    explanation: 'A recognizable whole-food or whole-grain ingredient is listed.',
  },
  {
    category: 'stabilizer-or-emulsifier',
    pattern: /\b(?:lecithin|xanthan gum|guar gum|carrageenan|cellulose gum|mono- and diglycerides|monoglycerides|diglycerides)\b/i,
    explanation: 'A stabilizer or emulsifier contributes to the processing indicator without an automatic nutrition penalty.',
  },
  {
    category: 'flavor-or-color',
    pattern: /\b(?:natural flavors?|artificial flavors?|artificial colors?|caramel color|red 40|yellow 5|yellow 6|blue 1)\b/i,
    explanation: 'A flavor or color contributes to the processing indicator without being labeled harmful.',
  },
  {
    category: 'artificial-sweetener',
    pattern: /\b(?:aspartame|acesulfame potassium|acesulfame k|sucralose|saccharin|neotame|advantame)\b/i,
    explanation: 'A high-intensity sweetener is listed; it is reported without an automatic score deduction.',
  },
];

export function analyzeIngredients(value: string | undefined): IngredientAnalysis {
  const ingredientText = value?.trim();
  if (!ingredientText) {
    return {
      topLevelIngredients: [],
      addedSugars: [],
      refinedCarbohydrates: [],
      wholeFoods: [],
      processingSignals: [],
      processingLevel: 'unknown',
      processingExplanation: 'A processing level cannot be estimated because no ingredient list is available.',
    };
  }

  const ingredients = topLevelIngredients(ingredientText);
  const findings = ingredients.flatMap((ingredient, index) =>
    CATEGORY_RULES
      .filter(({ pattern }) => pattern.test(ingredient))
      .map(({ category, explanation }) => ({
        id: `${category}-${index}`,
        ingredient,
        category,
        explanation,
        position: index + 1,
      } satisfies IngredientFinding)),
  );
  const addedSugars = findings.filter(({ category }) => category === 'added-sugar');
  const refinedCarbohydrates = findings.filter(
    ({ category }) => category === 'refined-carbohydrate',
  );
  const wholeFoods = findings.filter(({ category }) => category === 'whole-food');
  const processingSignals = findings.filter(({ category }) =>
    category === 'stabilizer-or-emulsifier' ||
    category === 'flavor-or-color' ||
    category === 'artificial-sweetener',
  );
  const hasIsolatedCarbohydrate = addedSugars.length > 0 || refinedCarbohydrates.length > 0;
  const processingLevel = ingredients.length >= 12 || processingSignals.length >= 4 ||
    (hasIsolatedCarbohydrate && processingSignals.length >= 2)
    ? 'high'
    : ingredients.length <= 5 && (wholeFoods.length > 0 || ingredients.length <= 2) &&
        !hasIsolatedCarbohydrate && processingSignals.length === 0
      ? 'minimal'
      : 'moderate';

  return {
    ingredientCount: ingredients.length,
    topLevelIngredients: ingredients,
    addedSugars,
    refinedCarbohydrates,
    wholeFoods,
    processingSignals,
    processingLevel,
    processingExplanation: processingLevel === 'minimal'
      ? 'The list is short and led by recognizable whole-food ingredients, with no reviewed refined-carbohydrate or formulation signals.'
      : processingLevel === 'high'
        ? 'The ingredient list has several formulation signals, many ingredients, or a combination of refined carbohydrates and formulation ingredients.'
        : 'The ingredient list contains a mixture of recognizable foods and refined or formulation ingredients.',
  };
}
