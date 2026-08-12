import assert from "node:assert/strict";
import test from "node:test";
import {
  MealTranscriptExtractionError,
  buildMealTranscriptMessages,
  parseMealTranscriptExtraction,
} from "../services/meal-transcript-extraction.ts";

const transcript = "For lunch I had brown rice, salmon, and roasted broccoli.";

test("constrains local LFM extraction to non-medical meal fields", () => {
  const messages = buildMealTranscriptMessages(transcript);
  assert.equal(messages.length, 2);
  assert.match(messages[0].content, /Do not estimate nutrition/);
  assert.match(messages[0].content, /Preserve stated quantities and units/);
  assert.match(messages[0].content, /medication, diagnosis, treatment, or advice/);
});

test("accepts transcript-grounded quantities for deterministic nutrition scaling", () => {
  const portionTranscript = "For breakfast I had two eggs and one slice of wheat toast.";
  const result = parseMealTranscriptExtraction(
    '{"mealName":"breakfast","foods":["two eggs","one slice wheat toast"]}',
    portionTranscript,
  );

  assert.deepEqual(result.foods, ["two eggs", "one slice wheat toast"]);
});

test("accepts transcript-grounded meal details", () => {
  const result = parseMealTranscriptExtraction(
    '```json\n{"mealName":"Salmon lunch","foods":["brown rice","salmon","roasted broccoli"]}\n```',
    transcript,
  );
  assert.equal(result.mealName, "Salmon lunch");
  assert.deepEqual(result.foods, ["brown rice", "salmon", "roasted broccoli"]);
});

test("deduplicates repeated foods case-insensitively", () => {
  const result = parseMealTranscriptExtraction(
    '{"foods":["salmon","Salmon"]}',
    transcript,
  );
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
