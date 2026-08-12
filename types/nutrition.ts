export type MacroNutrients = {
  calories: number;
  carbohydratesGrams: number;
  proteinGrams: number;
  fatGrams: number;
  fiberGrams: number;
};

export type LocalNutritionPortionUnit =
  | "cup"
  | "tablespoon"
  | "teaspoon"
  | "slice"
  | "item"
  | "container";

export type LocalNutritionReferenceFood = {
  fdcId: number;
  name: string;
  aliases: readonly string[];
  defaultPortion: {
    amount: number;
    unit: LocalNutritionPortionUnit;
    label: string;
    grams: number;
  };
  gramsPerUnit: Partial<Record<LocalNutritionPortionUnit, number>>;
  nutrientsPer100Grams: MacroNutrients;
};

export type LocalNutritionFoodEstimate = {
  input: string;
  matchedName?: string;
  fdcId?: number;
  estimatedGrams?: number;
  portionLabel?: string;
  usedDefaultPortion: boolean;
  nutrients?: MacroNutrients;
  confidence?: number;
  unresolvedReason?: string;
};

export type LocalNutritionEstimate = {
  foods: LocalNutritionFoodEstimate[];
  totals: MacroNutrients;
  matchedFoodCount: number;
  totalFoodCount: number;
  defaultPortionCount: number;
  sourceId: string;
  sourceLabel: string;
  sourceUrl: string;
};
