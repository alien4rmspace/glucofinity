import {
  LOCAL_NUTRITION_FOODS,
  LOCAL_NUTRITION_REFERENCE_META,
} from "../data/local-nutrition-reference.ts";
import type {
  LocalNutritionEstimate,
  LocalNutritionFoodEstimate,
  LocalNutritionPortionUnit,
  LocalNutritionReferenceFood,
  MacroNutrients,
} from "../types/nutrition.ts";

type ParsedUnit = LocalNutritionPortionUnit | "gram" | "ounce";

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  half: 0.5,
  quarter: 0.25,
};

const TENS_WORDS = new Set([
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
]);

const UNIT_PATTERNS: readonly [ParsedUnit, RegExp][] = [
  ["cup", /\bcups?\b/],
  ["tablespoon", /\b(?:tablespoons?|tbsp)\b/],
  ["teaspoon", /\b(?:teaspoons?|tsp)\b/],
  ["slice", /\bslices?\b/],
  ["container", /\bcontainers?\b/],
  ["ounce", /\b(?:ounces?|oz)\b/],
  ["gram", /\b(?:grams?|g)\b/],
  [
    "item",
    /\b(?:pieces?|items?|eggs?|avocados?|bananas?|apples?|tortillas?|potatoes?|breasts?|fillets?)\b/,
  ],
];

const EMPTY_MACROS: MacroNutrients = {
  calories: 0,
  carbohydratesGrams: 0,
  proteinGrams: 0,
  fatGrams: 0,
  fiberGrams: 0,
};

const ALIAS_MATCHES = LOCAL_NUTRITION_FOODS.flatMap((food) =>
  food.aliases.map((alias) => ({
    alias: normalize(alias),
    food,
  })),
).sort((left, right) => right.alias.length - left.alias.length);

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/½/g, " 1/2 ")
    .replace(/¼/g, " 1/4 ")
    .replace(/¾/g, " 3/4 ")
    .replace(/%/g, " percent ")
    .replace(/[^\p{L}\p{N}/.]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function matchReference(value: string): LocalNutritionReferenceFood | undefined {
  const padded = ` ${normalize(value)} `;
  return ALIAS_MATCHES.find(({ alias }) => padded.includes(` ${alias} `))?.food;
}

function parseAmount(value: string): number | undefined {
  const normalized = normalize(value).replace(/\b\d+(?:\.\d+)?\s+percent\b/g, "");
  const mixed = normalized.match(/\b(\d+)\s+and\s+(?:a\s+)?half\b/);
  if (mixed) return Number(mixed[1]) + 0.5;

  const fraction = normalized.match(/\b(\d+)\s*\/\s*(\d+)\b/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator > 0) return Number(fraction[1]) / denominator;
  }

  const numeric = normalized.match(/\b\d+(?:\.\d+)?\b/);
  if (numeric) return Number(numeric[0]);

  const words = normalized.split(" ");
  for (let index = 0; index < words.length; index += 1) {
    const firstValue = NUMBER_WORDS[words[index]];
    if (firstValue === undefined) continue;

    let amount = firstValue;
    const nextWord = words[index + 1];
    const nextValue = NUMBER_WORDS[nextWord];
    if (TENS_WORDS.has(words[index]) && nextValue !== undefined && nextValue < 10) {
      amount += nextValue;
    }
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
  input: string,
): { grams: number; label: string; usedDefault: boolean } {
  const amount = parseAmount(input);
  const unit = parseUnit(input);
  if (amount !== undefined && amount > 0 && unit) {
    const gramsPerUnit =
      unit === "gram"
        ? 1
        : unit === "ounce"
          ? 28.3495
          : food.gramsPerUnit[unit];
    if (gramsPerUnit !== undefined) {
      const grams = amount * gramsPerUnit;
      return {
        grams,
        label: formatPortion(amount, unit, grams),
        usedDefault: false,
      };
    }
  }

  if (amount !== undefined && amount > 0 && !unit) {
    const gramsPerDefaultUnit =
      food.gramsPerUnit[food.defaultPortion.unit] ??
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

function formatPortion(amount: number, unit: ParsedUnit, grams: number): string {
  if (unit === "gram") return `${formatAmount(amount)} g`;
  const unitLabel =
    unit === "ounce"
      ? amount === 1
        ? "oz"
        : "oz"
      : amount <= 1
        ? unit
        : `${unit}s`;
  return `${formatAmount(amount)} ${unitLabel} (${formatGrams(grams)} g)`;
}

function formatAmount(value: number): string {
  if (value === 0.25) return "1/4";
  if (value === 0.5) return "1/2";
  if (value === 0.75) return "3/4";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "");
}

function formatGrams(value: number): string {
  return value >= 10 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
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

function addMacros(total: MacroNutrients, value: MacroNutrients): MacroNutrients {
  return {
    calories: total.calories + value.calories,
    carbohydratesGrams: total.carbohydratesGrams + value.carbohydratesGrams,
    proteinGrams: total.proteinGrams + value.proteinGrams,
    fatGrams: total.fatGrams + value.fatGrams,
    fiberGrams: total.fiberGrams + value.fiberGrams,
  };
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

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

export function splitFoodDescriptions(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((food) => food.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function estimateLocalNutrition(foods: readonly string[]): LocalNutritionEstimate {
  let totals = { ...EMPTY_MACROS };
  let defaultPortionCount = 0;
  const estimates: LocalNutritionFoodEstimate[] = foods.slice(0, 20).map((input) => {
    const reviewedInput = input.trim();
    const food = matchReference(reviewedInput);
    if (!food) {
      return {
        input: reviewedInput,
        usedDefaultPortion: false,
        unresolvedReason: "Not found in the compact local reference. Enter nutrition manually.",
      };
    }

    const portion = portionGrams(food, reviewedInput);
    const nutrients = scaleMacros(food.nutrientsPer100Grams, portion.grams);
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
    sourceId: LOCAL_NUTRITION_REFERENCE_META.id,
    sourceLabel: LOCAL_NUTRITION_REFERENCE_META.label,
    sourceUrl: LOCAL_NUTRITION_REFERENCE_META.sourceUrl,
  };
}
