import type { FoodEstimate, MealAnalysis } from '@/types/ai';

export interface MealVisionProvider {
  readonly providerId: string;
  analyzeMeal(imageUri: string, userDescription?: string): Promise<MealAnalysis>;
}

export class MealAnalysisValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MealAnalysisValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalNonnegativeNumber(
  value: unknown,
  fieldName: string
): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new MealAnalysisValidationError(`${fieldName} must be a nonnegative number.`);
  }
  return value;
}

function optionalConfidence(value: unknown, fieldName: string): number | undefined {
  const confidence = optionalNonnegativeNumber(value, fieldName);
  if (confidence !== undefined && confidence > 1) {
    throw new MealAnalysisValidationError(`${fieldName} must be between 0 and 1.`);
  }
  return confidence;
}

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || !value.trim()) {
    throw new MealAnalysisValidationError(`${fieldName} must be a nonempty string.`);
  }
  return value.trim();
}

function validateFoodEstimate(value: unknown, index: number): FoodEstimate {
  if (!isRecord(value)) {
    throw new MealAnalysisValidationError(`foods[${index}] must be an object.`);
  }
  const name = optionalString(value.name, `foods[${index}].name`);
  if (!name) {
    throw new MealAnalysisValidationError(`foods[${index}].name is required.`);
  }
  return {
    name,
    ...defined({
      estimatedGrams: optionalNonnegativeNumber(
        value.estimatedGrams,
        `foods[${index}].estimatedGrams`
      ),
      calories: optionalNonnegativeNumber(value.calories, `foods[${index}].calories`),
      carbohydratesGrams: optionalNonnegativeNumber(
        value.carbohydratesGrams,
        `foods[${index}].carbohydratesGrams`
      ),
      proteinGrams: optionalNonnegativeNumber(
        value.proteinGrams,
        `foods[${index}].proteinGrams`
      ),
      fatGrams: optionalNonnegativeNumber(value.fatGrams, `foods[${index}].fatGrams`),
      fiberGrams: optionalNonnegativeNumber(
        value.fiberGrams,
        `foods[${index}].fiberGrams`
      ),
      confidence: optionalConfidence(value.confidence, `foods[${index}].confidence`),
    }),
  };
}

function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as Partial<T>;
}

export function validateMealAnalysis(value: unknown): MealAnalysis {
  if (!isRecord(value)) {
    throw new MealAnalysisValidationError('Meal analysis must be an object.');
  }
  if (!Array.isArray(value.foods)) {
    throw new MealAnalysisValidationError('Meal analysis foods must be an array.');
  }
  const generatedAt = optionalString(value.generatedAt, 'generatedAt');
  if (!generatedAt || !Number.isFinite(Date.parse(generatedAt))) {
    throw new MealAnalysisValidationError('generatedAt must be a valid ISO timestamp.');
  }

  return {
    foods: value.foods.map(validateFoodEstimate),
    ...defined({
      totalCalories: optionalNonnegativeNumber(value.totalCalories, 'totalCalories'),
      totalCarbohydratesGrams: optionalNonnegativeNumber(
        value.totalCarbohydratesGrams,
        'totalCarbohydratesGrams'
      ),
      totalProteinGrams: optionalNonnegativeNumber(
        value.totalProteinGrams,
        'totalProteinGrams'
      ),
      totalFatGrams: optionalNonnegativeNumber(value.totalFatGrams, 'totalFatGrams'),
      totalFiberGrams: optionalNonnegativeNumber(
        value.totalFiberGrams,
        'totalFiberGrams'
      ),
      confidence: optionalConfidence(value.confidence, 'confidence'),
      providerId: optionalString(value.providerId, 'providerId'),
      model: optionalString(value.model, 'model'),
    }),
    generatedAt: new Date(generatedAt).toISOString(),
  };
}

export class ValidatedMealVisionProvider implements MealVisionProvider {
  readonly providerId: string;

  constructor(private readonly provider: MealVisionProvider) {
    this.providerId = provider.providerId;
  }

  async analyzeMeal(imageUri: string, userDescription?: string): Promise<MealAnalysis> {
    if (!imageUri.trim()) throw new Error('A meal image is required for analysis.');
    const analysis = await this.provider.analyzeMeal(imageUri, userDescription);
    return validateMealAnalysis({
      ...analysis,
      providerId: analysis.providerId ?? this.providerId,
    });
  }
}

export class DeterministicMealVisionProvider implements MealVisionProvider {
  readonly providerId = 'deterministic-prototype';

  constructor(private readonly now: () => Date = () => new Date()) {}

  async analyzeMeal(imageUri: string, userDescription?: string): Promise<MealAnalysis> {
    if (!imageUri.trim()) throw new Error('A meal image is required for analysis.');
    const description = userDescription?.trim();
    return {
      foods: [
        {
          name: description || 'Mixed grain and vegetable bowl',
          estimatedGrams: 360,
          calories: 430,
          carbohydratesGrams: 46,
          proteinGrams: 22,
          fatGrams: 15,
          fiberGrams: 8,
          confidence: 0.62,
        },
      ],
      totalCalories: 430,
      totalCarbohydratesGrams: 46,
      totalProteinGrams: 22,
      totalFatGrams: 15,
      totalFiberGrams: 8,
      confidence: 0.62,
      providerId: this.providerId,
      model: 'fixed-fixture-v1',
      generatedAt: this.now().toISOString(),
    };
  }
}

export const mealVisionProvider: MealVisionProvider = new ValidatedMealVisionProvider(
  new DeterministicMealVisionProvider()
);
