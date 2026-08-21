import compactReference from '@/data/sr-legacy-reference.compact.json';
import {
  LOCAL_NUTRITION_PREFERRED_ALIASES,
  nutritionAliasesForDescription,
} from '@/data/local-nutrition-aliases';
import type {
  LocalNutritionPortionUnit,
  LocalNutritionReferenceFood,
} from '@/types/nutrition';

const UNITS: readonly LocalNutritionPortionUnit[] = [
  'cup',
  'tablespoon',
  'teaspoon',
  'slice',
  'item',
  'container',
  'gram',
  'ounce',
] as const;

type CompactFoodRow = readonly [
  fdcId: number,
  name: string,
  defaultAmount: number,
  defaultUnitCode: number,
  defaultLabel: string,
  defaultGrams: number,
  gramsPerUnit: readonly (readonly [unitCode: number, grams: number])[],
  calories: number,
  carbohydratesGrams: number,
  proteinGrams: number,
  fatGrams: number,
  fiberGrams: number | null,
];

export { LOCAL_NUTRITION_PREFERRED_ALIASES };

export const LOCAL_NUTRITION_REFERENCE_META = {
  ...compactReference.source,
  foodCount: compactReference.foodCount,
  completeNutrientCount: compactReference.completeNutrientCount,
} as const;

function unitFromCode(code: number): LocalNutritionPortionUnit {
  const unit = UNITS[code];
  if (!unit) throw new Error(`Unsupported compact nutrition unit code: ${code}`);
  return unit;
}

export const LOCAL_NUTRITION_FOODS: readonly LocalNutritionReferenceFood[] =
  (compactReference.foods as unknown as readonly CompactFoodRow[]).map((row) => {
    const fiberGrams = row[11];
    const gramsPerUnit = Object.fromEntries(
      row[6].map(([unitCode, grams]) => [unitFromCode(unitCode), grams]),
    );
    return {
      fdcId: row[0],
      name: row[1],
      aliases: nutritionAliasesForDescription(row[1]),
      defaultPortion: {
        amount: row[2],
        unit: unitFromCode(row[3]),
        label: row[4],
        grams: row[5],
      },
      gramsPerUnit,
      nutrientsPer100Grams: {
        calories: row[7],
        carbohydratesGrams: row[8],
        proteinGrams: row[9],
        fatGrams: row[10],
        ...(fiberGrams === null ? {} : { fiberGrams }),
      },
    };
  });
