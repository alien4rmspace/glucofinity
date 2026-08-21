export interface MacroNutrients {
  calories: number;
  carbohydratesGrams: number;
  proteinGrams: number;
  fatGrams: number;
  fiberGrams: number;
}

export type LocalNutritionPortionUnit =
  | 'cup'
  | 'tablespoon'
  | 'teaspoon'
  | 'slice'
  | 'item'
  | 'container'
  | 'gram'
  | 'ounce';

export type LocalNutritionReferenceNutrients = Omit<MacroNutrients, 'fiberGrams'> & {
  fiberGrams?: number;
};

export interface LocalNutritionReferenceFood {
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
  nutrientsPer100Grams: LocalNutritionReferenceNutrients;
}

export interface LocalNutritionFoodEstimate {
  input: string;
  matchedName?: string;
  fdcId?: number;
  estimatedGrams?: number;
  portionLabel?: string;
  usedDefaultPortion: boolean;
  nutrients?: MacroNutrients;
  confidence?: number;
  unresolvedReason?: string;
}

export interface LocalNutritionSuggestion {
  fdcId: number;
  name: string;
  suggestedInput: string;
  similarity: number;
  matchBasis: 'text' | 'food-family' | 'available-option';
}

export interface LocalNutritionEstimate {
  foods: LocalNutritionFoodEstimate[];
  totals: MacroNutrients;
  matchedFoodCount: number;
  totalFoodCount: number;
  defaultPortionCount: number;
  sourceId: string;
  sourceLabel: string;
  sourceUrl: string;
}
