import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateLocalNutrition,
  findLocalNutritionSuggestions,
  splitFoodDescriptions,
} from "../services/local-nutrition-estimator.ts";

test("scales a countable food from a spoken quantity", () => {
  const estimate = estimateLocalNutrition(["two scrambled eggs"]);

  assert.equal(estimate.matchedFoodCount, 1);
  assert.equal(estimate.defaultPortionCount, 0);
  assert.equal(estimate.foods[0]?.fdcId, 172187);
  assert.equal(estimate.foods[0]?.estimatedGrams, 122);
  assert.deepEqual(estimate.totals, {
    calories: 182,
    carbohydratesGrams: 2,
    proteinGrams: 12.2,
    fatGrams: 13.4,
    fiberGrams: 0,
  });
});

test("uses food-specific cup weights and fractions", () => {
  const estimate = estimateLocalNutrition(["half a cup of brown rice"]);

  assert.equal(estimate.foods[0]?.estimatedGrams, 101);
  assert.equal(estimate.foods[0]?.portionLabel, "1/2 cup (101 g)");
  assert.equal(estimate.totals.carbohydratesGrams, 25.8);
});

test("recognizes spoken nine grams instead of assuming the default portion", () => {
  const estimate = estimateLocalNutrition(["nine grams of brown rice"]);

  assert.equal(estimate.defaultPortionCount, 0);
  assert.equal(estimate.foods[0]?.estimatedGrams, 9);
  assert.equal(estimate.foods[0]?.portionLabel, "9 g");
  assert.deepEqual(estimate.totals, {
    calories: 11,
    carbohydratesGrams: 2.3,
    proteinGrams: 0.2,
    fatGrams: 0.1,
    fiberGrams: 0.1,
  });
});

test("recognizes compound spoken quantities", () => {
  const estimate = estimateLocalNutrition(["twenty one grams of brown rice"]);

  assert.equal(estimate.foods[0]?.estimatedGrams, 21);
  assert.equal(estimate.foods[0]?.usedDefaultPortion, false);
});

test("uses a visibly labeled default when no portion was spoken", () => {
  const estimate = estimateLocalNutrition(["banana"]);

  assert.equal(estimate.defaultPortionCount, 1);
  assert.equal(estimate.foods[0]?.usedDefaultPortion, true);
  assert.match(estimate.foods[0]?.portionLabel ?? "", /^Assumed 1 medium banana/);
});

test("supports generic ounce portions", () => {
  const estimate = estimateLocalNutrition(["4 ounces of salmon"]);

  assert.equal(estimate.foods[0]?.estimatedGrams, 113.4);
  assert.equal(estimate.totals.calories, 234);
  assert.equal(estimate.totals.proteinGrams, 25.1);
});

test("does not mistake a lean percentage for a portion quantity", () => {
  const estimate = estimateLocalNutrition(["90 percent lean ground beef"]);

  assert.equal(estimate.foods[0]?.estimatedGrams, 85);
  assert.equal(estimate.foods[0]?.usedDefaultPortion, true);
});

test("keeps unmatched foods unresolved and totals only matched foods", () => {
  const estimate = estimateLocalNutrition(["one medium banana", "dragon roll"]);

  assert.equal(estimate.matchedFoodCount, 1);
  assert.equal(estimate.totalFoodCount, 2);
  assert.equal(estimate.foods[1]?.nutrients, undefined);
  assert.match(estimate.foods[1]?.unresolvedReason ?? "", /Edit the ingredient/);
});

test("suggests specific rice references while preserving a spoken gram portion", () => {
  const suggestions = findLocalNutritionSuggestions("10 grams of rice");

  assert.deepEqual(
    suggestions.map(({ name, suggestedInput }) => ({ name, suggestedInput })),
    [
      { name: "Cooked brown rice", suggestedInput: "10 grams of brown rice" },
      { name: "Cooked white rice", suggestedInput: "10 grams of white rice" },
    ],
  );
  const selectedEstimate = estimateLocalNutrition([suggestions[1]?.suggestedInput ?? ""]);
  assert.equal(selectedEstimate.matchedFoodCount, 1);
  assert.equal(selectedEstimate.foods[0]?.estimatedGrams, 10);
});

test("suggests a close local food for a speech-recognition typo", () => {
  const [suggestion] = findLocalNutritionSuggestions("20 grams of salman");

  assert.equal(suggestion?.name, "Cooked Atlantic salmon");
  assert.equal(suggestion?.suggestedInput, "20 grams of salmon");
});

test("returns food-family suggestions when an unmatched food has no close text match", () => {
  const suggestions = findLocalNutritionSuggestions("a cup of lettuce.");

  assert.deepEqual(
    suggestions.map(({ name, matchBasis }) => ({ name, matchBasis })),
    [
      { name: "Raw spinach", matchBasis: "food-family" },
      { name: "Cooked mixed vegetables", matchBasis: "food-family" },
      { name: "Cooked broccoli", matchBasis: "food-family" },
    ],
  );
  assert.equal(suggestions[0]?.suggestedInput, "a cup of spinach");
});

test("returns labeled available options for every other named unmatched food", () => {
  const suggestions = findLocalNutritionSuggestions("one cup of zzzzzz");

  assert.equal(suggestions.length, 3);
  assert.ok(suggestions.every(({ matchBasis }) => matchBasis === "available-option"));
});

test("splits editable food descriptions without empty rows", () => {
  assert.deepEqual(
    splitFoodDescriptions("two eggs, one slice wheat toast\n half an avocado; "),
    ["two eggs", "one slice wheat toast", "half an avocado"],
  );
});
