import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LOCAL_NUTRITION_FOODS,
  LOCAL_NUTRITION_REFERENCE_META,
} from '../data/local-nutrition-reference';
import {
  calculatedCaloriesAfterNutritionEdit,
  estimateLocalNutrition,
  findLocalNutritionSuggestions,
  nutritionFoodQueryWords,
  updateIngredientNutrition,
} from '../services/local-nutrition-estimator';

test('recalculates calories after a carbohydrate, protein, or fat edit', () => {
  const macros = {
    calories: 100,
    carbohydratesGrams: 30,
    proteinGrams: 20,
    fatGrams: 10,
    fiberGrams: 5,
  };

  assert.equal(calculatedCaloriesAfterNutritionEdit(macros, 'carbohydratesGrams'), 290);
  assert.equal(calculatedCaloriesAfterNutritionEdit(macros, 'proteinGrams'), 290);
  assert.equal(calculatedCaloriesAfterNutritionEdit(macros, 'fatGrams'), 290);
});

test('keeps direct calorie and fiber edits independent from the macros', () => {
  const macros = {
    calories: 275,
    carbohydratesGrams: 30,
    proteinGrams: 20,
    fatGrams: 10,
    fiberGrams: 8,
  };

  assert.equal(calculatedCaloriesAfterNutritionEdit(macros, 'calories'), undefined);
  assert.equal(calculatedCaloriesAfterNutritionEdit(macros, 'fiberGrams'), undefined);
});

test('scales white rice nutrition to the stated gram amount', () => {
  const estimate = estimateLocalNutrition(['9 grams of white rice']);

  assert.equal(estimate.matchedFoodCount, 1);
  assert.equal(estimate.foods[0].estimatedGrams, 9);
  assert.equal(estimate.totals.calories, 12);
  assert.equal(estimate.totals.carbohydratesGrams, 2.5);
});

test('treats compact gram quantities as portions and asks which rice type was eaten', () => {
  const ambiguousEstimate = estimateLocalNutrition(['20g of rice']);
  const suggestions = findLocalNutritionSuggestions('20g of rice', 5);
  const whiteRiceEstimate = estimateLocalNutrition(['20g of white rice']);

  assert.deepEqual(nutritionFoodQueryWords('20g of rice'), ['rice']);
  assert.equal(ambiguousEstimate.matchedFoodCount, 0);
  assert.deepEqual(suggestions.map(({ fdcId }) => fdcId), [168878, 169704]);
  assert.equal(suggestions[0].suggestedInput, '20g of white rice');
  assert.equal(suggestions[1].suggestedInput, '20g of brown rice');
  assert.equal(whiteRiceEstimate.foods[0].estimatedGrams, 20);
});

test('keeps other generic foods unresolved and ranks canonical foods first', () => {
  const estimate = estimateLocalNutrition(['bread']);
  const suggestions = findLocalNutritionSuggestions('bread', 3);

  assert.equal(estimate.matchedFoodCount, 0);
  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.every(({ name }) => name.toLocaleLowerCase().startsWith('bread')));
});

test('uses the exact local food record selected by the user', () => {
  const estimate = estimateLocalNutrition(['20g of bread'], [172684]);

  assert.equal(estimate.matchedFoodCount, 1);
  assert.equal(estimate.foods[0].fdcId, 172684);
  assert.match(estimate.foods[0].matchedName ?? '', /bread, rye/i);
  assert.equal(estimate.foods[0].estimatedGrams, 20);
});

test('ingredient nutrition edits recalculate ingredient calories and meal totals', () => {
  const original = estimateLocalNutrition(['20g of white rice', '20g of salmon']);
  const macroEdited = updateIngredientNutrition(
    original,
    0,
    'carbohydratesGrams',
    10,
  );
  const calorieEdited = updateIngredientNutrition(macroEdited, 0, 'calories', 120);

  assert.equal(macroEdited.foods[0].nutrients?.calories, 43);
  assert.equal(macroEdited.totals.calories, 84);
  assert.equal(calorieEdited.foods[0].nutrients?.calories, 120);
  assert.equal(calorieEdited.foods[0].nutrients?.carbohydratesGrams, 10);
  assert.equal(calorieEdited.totals.calories, 161);
});

test('totals common foods from the complete compact reference', () => {
  const estimate = estimateLocalNutrition([
    '9 grams of brown rice',
    '6 grams of salmon',
    'a cup of lettuce',
  ]);

  assert.equal(estimate.matchedFoodCount, 3);
  assert.equal(estimate.totalFoodCount, 3);
  assert.equal(estimate.foods[2].fdcId, 169249);
});

test('includes blueberries and generic granola with household portions', () => {
  const estimate = estimateLocalNutrition(['1 cup of blue berries', '1 cup granola']);

  assert.equal(estimate.matchedFoodCount, 2);
  assert.equal(estimate.foods[0].fdcId, 171711);
  assert.equal(estimate.foods[0].estimatedGrams, 148);
  assert.equal(estimate.foods[1].fdcId, 171646);
  assert.equal(estimate.foods[1].estimatedGrams, 122);
});

test('retains the full SR Legacy index without inventing missing fiber', () => {
  assert.equal(LOCAL_NUTRITION_REFERENCE_META.foodCount, 7_793);
  assert.equal(LOCAL_NUTRITION_REFERENCE_META.completeNutrientCount, 7_231);
  assert.equal(LOCAL_NUTRITION_FOODS.length, 7_793);
  assert.equal(
    LOCAL_NUTRITION_FOODS.filter(
      ({ nutrientsPer100Grams }) => nutrientsPer100Grams.fiberGrams !== undefined,
    ).length,
    7_231,
  );
  assert.equal(new Set(LOCAL_NUTRITION_FOODS.map(({ fdcId }) => fdcId)).size, 7_793);

  const incompleteFood = LOCAL_NUTRITION_FOODS.find(({ fdcId }) => fdcId === 167514);
  assert.ok(incompleteFood);
  const incompleteEstimate = estimateLocalNutrition([incompleteFood.name]);
  assert.equal(incompleteEstimate.matchedFoodCount, 0);
  assert.match(incompleteEstimate.foods[0].unresolvedReason ?? '', /no fiber value/i);
});

test('offers ranked local options for a misspelled food', () => {
  const suggestions = findLocalNutritionSuggestions('a cup of blueberies');

  assert.ok(suggestions.length > 0);
  assert.match(suggestions[0].name, /blueberr/i);
  assert.equal(suggestions[0].matchBasis, 'text');
});
