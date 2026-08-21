import { LOCAL_NUTRITION_PREFERRED_ALIASES } from '@/data/local-nutrition-aliases';
import type {
  LocalNutritionEstimate,
  LocalNutritionFoodEstimate,
  LocalNutritionPortionUnit,
  LocalNutritionReferenceFood,
  LocalNutritionSuggestion,
  MacroNutrients,
} from '@/types/nutrition';

type ParsedUnit = LocalNutritionPortionUnit;

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  half: 0.5, quarter: 0.25,
};

const TENS_WORDS = new Set(['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']);

const UNIT_PATTERNS: readonly [ParsedUnit, RegExp][] = [
  ['cup', /\bcups?\b/],
  ['tablespoon', /\b(?:tablespoons?|tbsp)\b/],
  ['teaspoon', /\b(?:teaspoons?|tsp)\b/],
  ['slice', /\bslices?\b/],
  ['container', /\b(?:containers?|packages?|packets?|jars?|bottles?|cartons?|boxes?|cans?)\b/],
  ['ounce', /\b(?:ounces?|oz)\b/],
  ['gram', /\b(?:grams?|g)\b/],
  [
    'item',
    /\b(?:pieces?|items?|bars?|berries?|eggs?|avocados?|bananas?|apples?|tortillas?|potatoes?|breasts?|fillets?|muffins?|pancakes?|cookies?|crackers?|cakes?|rolls?|sticks?|wedges?|pattys?|patties?|links?|sausages?)\b/,
  ],
];

const EMPTY_MACROS: MacroNutrients = {
  calories: 0,
  carbohydratesGrams: 0,
  proteinGrams: 0,
  fatGrams: 0,
  fiberGrams: 0,
};

export function calculatedCaloriesAfterNutritionEdit(
  macros: MacroNutrients,
  changedField: keyof MacroNutrients,
): number | undefined {
  if (
    changedField !== 'carbohydratesGrams' &&
    changedField !== 'proteinGrams' &&
    changedField !== 'fatGrams'
  ) {
    return undefined;
  }
  return Math.round(
    Math.max(0, macros.carbohydratesGrams) * 4 +
    Math.max(0, macros.proteinGrams) * 4 +
    Math.max(0, macros.fatGrams) * 9,
  );
}

type LocalReferenceModule = typeof import('@/data/local-nutrition-reference');

let localReferenceCache: {
  foods: readonly LocalNutritionReferenceFood[];
  foodByFdcId: ReadonlyMap<number, LocalNutritionReferenceFood>;
  aliasMatches: readonly { alias: string; food: LocalNutritionReferenceFood }[];
  metadata: LocalReferenceModule['LOCAL_NUTRITION_REFERENCE_META'];
} | undefined;

function localReference() {
  if (localReferenceCache) return localReferenceCache;
  const reference = require('../data/local-nutrition-reference') as LocalReferenceModule;
  const foods = reference.LOCAL_NUTRITION_FOODS;
  localReferenceCache = {
    foods,
    foodByFdcId: new Map(foods.map((food) => [food.fdcId, food])),
    aliasMatches: foods.flatMap((food) =>
      food.aliases.map((alias) => ({ alias: normalize(alias), food }))
    ).sort((left, right) =>
      right.alias.length - left.alias.length || left.food.name.length - right.food.name.length
    ),
    metadata: reference.LOCAL_NUTRITION_REFERENCE_META,
  };
  return localReferenceCache;
}

const FOOD_QUERY_STOP_WORDS = new Set([
  ...Object.keys(NUMBER_WORDS), 'hundred', 'and', 'of', 'percent', 'gram',
  'grams', 'g', 'ounce', 'ounces', 'oz', 'cup', 'cups', 'tablespoon',
  'tablespoons', 'tbsp', 'teaspoon', 'teaspoons', 'tsp', 'slice', 'slices',
  'piece', 'pieces', 'item', 'items', 'container', 'containers',
]);

const FOOD_FAMILY_MATCHES = [
  { keywords: ['rice'], fdcIds: [168878, 169704] },
  { keywords: ['lettuce', 'kale', 'arugula', 'cabbage', 'greens', 'salad'], fdcIds: [168462, 170472, 169967] },
  { keywords: ['quinoa', 'barley', 'farro', 'couscous', 'grain', 'grains'], fdcIds: [169704, 168878, 171675, 169737] },
  { keywords: ['fish', 'tuna', 'cod', 'tilapia', 'trout', 'shrimp', 'seafood'], fdcIds: [175168] },
  { keywords: ['pork', 'steak', 'meat', 'protein'], fdcIds: [171794, 171477, 171496, 172448] },
  { keywords: ['berry', 'berries', 'orange', 'pear', 'peach', 'fruit'], fdcIds: [171688, 173944] },
  { keywords: ['cream', 'dairy', 'cottage', 'mozzarella'], fdcIds: [170894, 171265, 173414] },
] as const;

const AMBIGUOUS_FOOD_SUGGESTIONS: Readonly<Record<
  string,
  readonly { fdcId: number; alias: string }[]
>> = {
  rice: [
    { fdcId: 168878, alias: 'white rice' },
    { fdcId: 169704, alias: 'brown rice' },
  ],
};

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/\b(\d+(?:\.\d+)?|\d+\/\d+)\s*(grams?|g|ounces?|oz)\b/g, '$1 $2')
    .replace(/½/g, ' 1/2 ')
    .replace(/¼/g, ' 1/4 ')
    .replace(/¾/g, ' 3/4 ')
    .replace(/%/g, ' percent ')
    .replace(/[^\p{L}\p{N}/.]+/gu, ' ')
    .replace(/\.(?=\s|$)/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function nutritionFoodQueryWords(value: string): string[] {
  return normalize(value).split(' ').filter((word) =>
    word.length > 0 && !FOOD_QUERY_STOP_WORDS.has(word) &&
    !/^\d+(?:\.\d+)?(?:\/\d+)?$/.test(word)
  );
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1] +
        (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        substitution
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function aliasSimilarity(queryWords: readonly string[], alias: string): number {
  const aliasWords = normalize(alias).split(' ').filter(Boolean);
  const overlap = queryWords.filter((word) => aliasWords.includes(word)).length;
  if (overlap === queryWords.length) return 0.8 + 0.2 * (overlap / aliasWords.length);
  const queryText = queryWords.join(' ');
  const aliasText = aliasWords.join(' ');
  const longestLength = Math.max(queryText.length, aliasText.length);
  const editSimilarity = longestLength > 0
    ? 1 - editDistance(queryText, aliasText) / longestLength
    : 0;
  const tokenSimilarity = overlap / Math.max(queryWords.length, aliasWords.length);
  return Math.max(editSimilarity, tokenSimilarity);
}

function replaceFoodWords(input: string, queryWords: readonly string[], replacement: string): string {
  const reviewedInput = input.trim();
  const firstFoodWord = queryWords[0];
  if (!firstFoodWord) return replacement;
  const matchIndex = reviewedInput.toLocaleLowerCase().indexOf(firstFoodWord);
  if (matchIndex < 0) return replacement;
  return `${reviewedInput.slice(0, matchIndex)}${replacement}`.trim();
}

export function findLocalNutritionSuggestions(
  input: string,
  limit = 3
): LocalNutritionSuggestion[] {
  return rankLocalNutritionSuggestions(input, localReference().foods, limit);
}

export function nutritionFamilyFoodIds(input: string): readonly number[] {
  const queryWords = nutritionFoodQueryWords(input);
  return FOOD_FAMILY_MATCHES.filter(({ keywords }) =>
    keywords.some((keyword) => queryWords.includes(keyword))
  ).flatMap(({ fdcIds }) => [...fdcIds]);
}

function ambiguousFoodSuggestions(
  input: string,
): readonly { fdcId: number; alias: string }[] {
  return AMBIGUOUS_FOOD_SUGGESTIONS[nutritionFoodQueryWords(input).join(' ')] ?? [];
}

export function isAmbiguousNutritionFoodQuery(input: string): boolean {
  return ambiguousFoodSuggestions(input).length > 0;
}

export function rankLocalNutritionSuggestions(
  input: string,
  referenceFoods: readonly LocalNutritionReferenceFood[],
  limit = 3,
): LocalNutritionSuggestion[] {
  const queryWords = nutritionFoodQueryWords(input);
  if (queryWords.length === 0 || limit <= 0) return [];

  const bestByFood = new Map<number, {
    food: LocalNutritionReferenceFood;
    alias: string;
    similarity: number;
    canonicalStartsWithQuery: boolean;
  }>();
  for (const food of referenceFoods) {
    const canonicalWords = normalize(food.name).split(' ').filter(Boolean);
    const canonicalStartsWithQuery = queryWords.every(
      (word, index) => canonicalWords[index] === word,
    );
    for (const alias of food.aliases) {
      const similarity = aliasSimilarity(queryWords, alias);
      const current = bestByFood.get(food.fdcId);
      if (!current || similarity > current.similarity) {
        bestByFood.set(food.fdcId, {
          food,
          alias,
          similarity,
          canonicalStartsWithQuery,
        });
      }
    }
  }

  const ranked = [...bestByFood.values()].sort(
    (left, right) =>
      right.similarity - left.similarity ||
      Number(right.canonicalStartsWithQuery) - Number(left.canonicalStartsWithQuery) ||
      left.food.name.length - right.food.name.length,
  );
  const ambiguousOptions = ambiguousFoodSuggestions(input);
  const ambiguousOptionById = new Map(
    ambiguousOptions.map((option) => [option.fdcId, option]),
  );
  const ambiguousCandidates = ambiguousOptions
    .map(({ fdcId }) => bestByFood.get(fdcId))
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
  const familyFoodIds = nutritionFamilyFoodIds(input);
  const familyFoodIdSet = new Set<number>(familyFoodIds);
  const familyCandidates = familyFoodIds
    .map((fdcId) => bestByFood.get(fdcId))
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
  const closeTextCandidates = ranked.filter(({ similarity }) => similarity >= 0.55);
  const ordered = ambiguousCandidates.length > 0
    ? ambiguousCandidates
    : closeTextCandidates.length > 0
      ? closeTextCandidates
      : familyCandidates.length > 0
        ? familyCandidates
        : ranked;

  return ordered.slice(0, Math.min(limit, 5)).map(({ food, alias, similarity }) => ({
    fdcId: food.fdcId,
    name: food.name,
    suggestedInput: replaceFoodWords(
      input,
      queryWords,
      ambiguousOptionById.get(food.fdcId)?.alias ?? alias,
    ),
    similarity: Math.round(similarity * 100) / 100,
    matchBasis: ambiguousOptionById.has(food.fdcId)
      ? 'food-family'
      : similarity >= 0.55
      ? 'text'
      : familyFoodIdSet.has(food.fdcId)
        ? 'food-family'
        : 'available-option',
  }));
}

function matchReference(value: string): LocalNutritionReferenceFood | undefined {
  const queryText = nutritionFoodQueryWords(value).join(' ');
  const preferredFdcId = LOCAL_NUTRITION_PREFERRED_ALIASES[queryText];
  const reference = localReference();
  if (preferredFdcId !== undefined) return reference.foodByFdcId.get(preferredFdcId);
  if (isAmbiguousNutritionFoodQuery(value)) return undefined;
  if (nutritionFoodQueryWords(value).length === 1) return undefined;
  const padded = ` ${normalize(value)} `;
  return reference.aliasMatches.find(({ alias }) => padded.includes(` ${alias} `))?.food;
}

function parseAmount(value: string): number | undefined {
  const normalized = normalize(value).replace(/\b\d+(?:\.\d+)?\s+percent\b/g, '');
  const mixed = normalized.match(/\b(\d+)\s+and\s+(?:a\s+)?half\b/);
  if (mixed) return Number(mixed[1]) + 0.5;
  const fraction = normalized.match(/\b(\d+)\s*\/\s*(\d+)\b/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator > 0) return Number(fraction[1]) / denominator;
  }
  const numeric = normalized.match(/\b\d+(?:\.\d+)?\b/);
  if (numeric) return Number(numeric[0]);
  const words = normalized.split(' ');
  for (let index = 0; index < words.length; index += 1) {
    const firstValue = NUMBER_WORDS[words[index]];
    if (firstValue === undefined) continue;
    let amount = firstValue;
    const nextValue = NUMBER_WORDS[words[index + 1]];
    if (TENS_WORDS.has(words[index]) && nextValue !== undefined && nextValue < 10) amount += nextValue;
    return amount;
  }
  return undefined;
}

function parseUnit(value: string): ParsedUnit | undefined {
  const normalized = normalize(value);
  return UNIT_PATTERNS.find(([, pattern]) => pattern.test(normalized))?.[0];
}

function portionGrams(
  food: LocalNutritionReferenceFood,
  input: string
): { grams: number; label: string; usedDefault: boolean } {
  const amount = parseAmount(input);
  const unit = parseUnit(input);
  if (amount !== undefined && amount > 0 && unit) {
    const gramsPerUnit = gramsForUnit(food, unit);
    if (gramsPerUnit !== undefined) {
      const grams = amount * gramsPerUnit;
      return { grams, label: formatPortion(amount, unit, grams), usedDefault: false };
    }
  }
  if (amount !== undefined && amount > 0 && !unit) {
    const gramsPerDefaultUnit = gramsForUnit(food, food.defaultPortion.unit) ??
      food.defaultPortion.grams / food.defaultPortion.amount;
    const grams = amount * gramsPerDefaultUnit;
    return {
      grams,
      label: formatPortion(amount, food.defaultPortion.unit, grams),
      usedDefault: false,
    };
  }
  return {
    grams: food.defaultPortion.grams,
    label: `Assumed ${food.defaultPortion.label} (${formatGrams(food.defaultPortion.grams)} g)`,
    usedDefault: true,
  };
}

function gramsForUnit(
  food: LocalNutritionReferenceFood,
  unit: LocalNutritionPortionUnit,
): number | undefined {
  if (unit === 'gram') return 1;
  if (unit === 'ounce') return 28.3495;
  return food.gramsPerUnit[unit];
}

function formatPortion(amount: number, unit: ParsedUnit, grams: number): string {
  if (unit === 'gram') return `${formatAmount(amount)} g`;
  const unitLabel = unit === 'ounce' ? 'oz' : amount <= 1 ? unit : `${unit}s`;
  return `${formatAmount(amount)} ${unitLabel} (${formatGrams(grams)} g)`;
}

function formatAmount(value: number): string {
  if (value === 0.25) return '1/4';
  if (value === 0.5) return '1/2';
  if (value === 0.75) return '3/4';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '');
}

function formatGrams(value: number): string {
  return value >= 10 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, '');
}

function scaleMacros(macros: MacroNutrients, grams: number): MacroNutrients {
  const scale = grams / 100;
  return {
    calories: macros.calories * scale,
    carbohydratesGrams: macros.carbohydratesGrams * scale,
    proteinGrams: macros.proteinGrams * scale,
    fatGrams: macros.fatGrams * scale,
    fiberGrams: macros.fiberGrams * scale,
  };
}

function completeReferenceMacros(
  food: LocalNutritionReferenceFood,
): MacroNutrients | undefined {
  const { fiberGrams } = food.nutrientsPer100Grams;
  if (fiberGrams === undefined) return undefined;
  return { ...food.nutrientsPer100Grams, fiberGrams };
}

function addMacros(total: MacroNutrients, value: MacroNutrients): MacroNutrients {
  return {
    calories: total.calories + value.calories,
    carbohydratesGrams: total.carbohydratesGrams + value.carbohydratesGrams,
    proteinGrams: total.proteinGrams + value.proteinGrams,
    fatGrams: total.fatGrams + value.fatGrams,
    fiberGrams: total.fiberGrams + value.fiberGrams,
  };
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundMacros(macros: MacroNutrients): MacroNutrients {
  return {
    calories: Math.round(macros.calories),
    carbohydratesGrams: roundOne(macros.carbohydratesGrams),
    proteinGrams: roundOne(macros.proteinGrams),
    fatGrams: roundOne(macros.fatGrams),
    fiberGrams: roundOne(macros.fiberGrams),
  };
}

export function updateIngredientNutrition(
  estimate: LocalNutritionEstimate,
  foodIndex: number,
  field: keyof MacroNutrients,
  value: number,
): LocalNutritionEstimate {
  const food = estimate.foods[foodIndex];
  if (!food || !Number.isFinite(value)) return estimate;

  const nutrients = {
    ...(food.nutrients ?? EMPTY_MACROS),
    [field]: Math.max(0, value),
  };
  const calculatedCalories = calculatedCaloriesAfterNutritionEdit(nutrients, field);
  if (calculatedCalories !== undefined) nutrients.calories = calculatedCalories;

  const foods = estimate.foods.map((candidate, index) =>
    index === foodIndex ? { ...candidate, nutrients } : candidate
  );
  const totals = foods.reduce(
    (sum, candidate) => candidate.nutrients
      ? addMacros(sum, candidate.nutrients)
      : sum,
    { ...EMPTY_MACROS },
  );

  return {
    ...estimate,
    foods,
    totals: roundMacros(totals),
  };
}

export function splitFoodDescriptions(value: string): string[] {
  return value.split(/[\n,;]+/).map((food) => food.trim()).filter(Boolean).slice(0, 20);
}

export function estimateLocalNutrition(
  foods: readonly string[],
  selectedFdcIds: readonly (number | undefined)[] = [],
): LocalNutritionEstimate {
  const inputs = foods.slice(0, 20);
  const reference = localReference();
  const metadata = reference.metadata;
  return estimateLocalNutritionFromMatches(
    inputs,
    inputs.map((input, index) => {
      const selectedFdcId = selectedFdcIds[index];
      return selectedFdcId === undefined
        ? matchReference(input.trim())
        : reference.foodByFdcId.get(selectedFdcId);
    }),
    {
      id: metadata.id,
      label: metadata.label,
      sourceUrl: metadata.sourceUrl,
    },
  );
}

interface LocalNutritionEstimateSource {
  id: string;
  label: string;
  sourceUrl: string;
}

export function estimateLocalNutritionFromMatches(
  foods: readonly string[],
  matches: readonly (LocalNutritionReferenceFood | undefined)[],
  source: LocalNutritionEstimateSource,
): LocalNutritionEstimate {
  let totals = { ...EMPTY_MACROS };
  let defaultPortionCount = 0;
  const estimates: LocalNutritionFoodEstimate[] = foods.slice(0, 20).map((input, index) => {
    const reviewedInput = input.trim();
    const food = matches[index];
    if (!food) {
      return {
        input: reviewedInput,
        usedDefaultPortion: false,
        unresolvedReason: 'Not found in the local nutrition catalog. Edit the ingredient or choose a close local match.',
      };
    }
    const referenceMacros = completeReferenceMacros(food);
    if (!referenceMacros) {
      return {
        input: reviewedInput,
        matchedName: food.name,
        fdcId: food.fdcId,
        usedDefaultPortion: false,
        unresolvedReason: 'The matched FoodData Central record has no fiber value, so the app does not treat the missing value as zero. Enter the nutrition manually.',
      };
    }
    const portion = portionGrams(food, reviewedInput);
    const nutrients = scaleMacros(referenceMacros, portion.grams);
    totals = addMacros(totals, nutrients);
    if (portion.usedDefault) defaultPortionCount += 1;
    return {
      input: reviewedInput,
      matchedName: food.name,
      fdcId: food.fdcId,
      estimatedGrams: roundOne(portion.grams),
      portionLabel: portion.label,
      usedDefaultPortion: portion.usedDefault,
      nutrients: roundMacros(nutrients),
      confidence: portion.usedDefault ? 0.62 : 0.88,
    };
  });
  return {
    foods: estimates,
    totals: roundMacros(totals),
    matchedFoodCount: estimates.filter((estimate) => estimate.nutrients).length,
    totalFoodCount: estimates.length,
    defaultPortionCount,
    sourceId: source.id,
    sourceLabel: source.label,
    sourceUrl: source.sourceUrl,
  };
}
