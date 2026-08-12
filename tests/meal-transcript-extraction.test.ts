import assert from "node:assert/strict";
import test from "node:test";
import {
  MealTranscriptExtractionError,
  buildMealTranscriptMessages,
  deriveMealNameFromFoods,
  parseMealTranscriptExtraction,
} from "../services/meal-transcript-extraction.ts";
import { estimateLocalNutrition } from "../services/local-nutrition-estimator.ts";

const transcript = "For lunch I had brown rice, salmon, and roasted broccoli.";

test("constrains local LFM extraction to non-medical meal fields", () => {
  const messages = buildMealTranscriptMessages(transcript);
  assert.equal(messages.length, 2);
  assert.match(messages[0].content, /Do not estimate nutrition/);
  assert.match(messages[0].content, /Preserve stated quantities and units/);
  assert.match(messages[0].content, /never meal types such as breakfast, lunch, dinner, or snack/);
  assert.match(messages[0].content, /never return a quantity or unit alone/);
  assert.match(messages[0].content, /medication, diagnosis, treatment, or advice/);
});

test("accepts transcript-grounded quantities for deterministic nutrition scaling", () => {
  const portionTranscript = "For breakfast I had two eggs and one slice of wheat toast.";
  const result = parseMealTranscriptExtraction(
    '{"mealName":"breakfast","foods":["two eggs","one slice wheat toast"]}',
    portionTranscript,
  );

  assert.equal(result.mealName, "Eggs, Wheat Toast");
  assert.deepEqual(result.foods, ["two eggs", "one slice wheat toast"]);
});

test("accepts transcript-grounded meal details", () => {
  const result = parseMealTranscriptExtraction(
    '```json\n{"mealName":"Salmon lunch","foods":["brown rice","salmon","roasted broccoli"]}\n```',
    transcript,
  );
  assert.equal(result.mealName, "Brown Rice, Salmon, Roasted Broccoli");
  assert.deepEqual(result.foods, ["brown rice", "salmon", "roasted broccoli"]);
});

test("repairs a quantity-only food with the grounded food-name meal field", () => {
  const whiteRiceTranscript = "Nine grams of white rice";
  const result = parseMealTranscriptExtraction(
    '{"mealName":"White Rice","foods":["nine grams"]}',
    whiteRiceTranscript,
  );

  assert.equal(result.mealName, "White Rice");
  assert.deepEqual(result.foods, ["nine grams White Rice"]);

  const nutrition = estimateLocalNutrition(result.foods);
  assert.equal(nutrition.matchedFoodCount, 1);
  assert.equal(nutrition.foods[0]?.estimatedGrams, 9);
  assert.deepEqual(nutrition.totals, {
    calories: 12,
    carbohydratesGrams: 2.5,
    proteinGrams: 0.2,
    fatGrams: 0,
    fiberGrams: 0,
  });
});

test("derives the meal name from foods instead of a meal type", () => {
  const result = parseMealTranscriptExtraction(
    '{"mealName":"lunch","foods":["brown rice","salmon","roasted broccoli"]}',
    transcript,
  );

  assert.equal(result.mealName, "Brown Rice, Salmon, Roasted Broccoli");
});

test("derives an editable meal name directly from food descriptions", () => {
  assert.equal(
    deriveMealNameFromFoods(["nine grams of white rice", "four ounces salmon"]),
    "White Rice, Salmon",
  );
});

test("deduplicates repeated foods case-insensitively", () => {
  const result = parseMealTranscriptExtraction(
    '{"foods":["salmon","Salmon"]}',
    transcript,
  );
  assert.equal(result.mealName, "Salmon");
  assert.deepEqual(result.foods, ["salmon"]);
});

test("rejects hallucinated foods and unsupported fields", () => {
  assert.throws(
    () =>
      parseMealTranscriptExtraction(
        '{"mealName":"Salmon lunch","foods":["salmon","avocado"]}',
        transcript,
      ),
    MealTranscriptExtractionError,
  );
  assert.throws(
    () =>
      parseMealTranscriptExtraction(
        '{"foods":["salmon"],"calories":400}',
        transcript,
      ),
    MealTranscriptExtractionError,
  );
});

test("rejects malformed or unstructured model output", () => {
  assert.throws(
    () => parseMealTranscriptExtraction("I think this was salmon.", transcript),
    MealTranscriptExtractionError,
  );
  assert.throws(
    () => parseMealTranscriptExtraction('{"foods":"salmon"}', transcript),
    MealTranscriptExtractionError,
  );
});
