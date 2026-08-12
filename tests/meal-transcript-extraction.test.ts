import assert from "node:assert/strict";
import test from "node:test";
import {
  MealTranscriptExtractionError,
  buildMealTranscriptMessages,
  deriveMealNameFromFoods,
  extractGroundedMealFromTranscript,
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
  assert.match(messages[0].content, /may omit all punctuation and connector words/);
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

test("separates multiple foods and keeps each spoken portion", () => {
  const multiFoodTranscript = "Nine grams of brown rice and five grams of salmon";
  const result = parseMealTranscriptExtraction(
    '{"mealName":"Brown rice and salmon","foods":["nine grams of brown rice and five grams of salmon"]}',
    multiFoodTranscript,
  );

  assert.equal(result.mealName, "Brown Rice, Salmon");
  assert.deepEqual(result.foods, [
    "nine grams of brown rice",
    "five grams of salmon",
  ]);
  const nutrition = estimateLocalNutrition(result.foods);
  assert.equal(nutrition.matchedFoodCount, 2);
  assert.equal(nutrition.foods[0]?.estimatedGrams, 9);
  assert.equal(nutrition.foods[1]?.estimatedGrams, 5);
});

test("uses a transcript-grounded multi-food fallback when local model output is empty", () => {
  const result = extractGroundedMealFromTranscript(
    "For lunch I had nine grams of brown rice, five grams of salmon, and broccoli",
  );

  assert.equal(result.mealName, "Brown Rice, Salmon, Broccoli");
  assert.deepEqual(result.foods, [
    "nine grams of brown rice",
    "five grams of salmon",
    "broccoli",
  ]);
  assert.deepEqual(
    extractGroundedMealFromTranscript("I had one and a half cups of brown rice").foods,
    ["one and a half cups of brown rice"],
  );
});

test("separates repeated portions in an unpunctuated speech transcript", () => {
  const unpunctuatedTranscript =
    "Nine grams of rice ten grams of salmon a cup of lettuce";
  const combinedModelOutput =
    '{"mealName":"Rice salmon lettuce","foods":["nine grams of rice ten grams of salmon a cup of lettuce"]}';

  const modelResult = parseMealTranscriptExtraction(
    combinedModelOutput,
    unpunctuatedTranscript,
  );
  const fallbackResult = extractGroundedMealFromTranscript(unpunctuatedTranscript);
  const expectedModelFoods = [
    "nine grams of rice",
    "ten grams of salmon",
    "a cup of lettuce",
  ];

  assert.deepEqual(modelResult.foods, expectedModelFoods);
  assert.deepEqual(fallbackResult.foods, ["Nine grams of rice", ...expectedModelFoods.slice(1)]);
  assert.equal(modelResult.mealName, "Rice, Salmon, Lettuce");
  assert.equal(fallbackResult.mealName, "Rice, Salmon, Lettuce");
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
