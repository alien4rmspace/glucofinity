import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MealTranscriptExtractionError,
  buildMealTranscriptMessages,
  deriveMealNameFromFoods,
  extractGroundedMealFromTranscript,
  parseMealTranscriptExtraction,
  refineMealTranscript,
  splitFoodDescriptions,
} from '../services/meal-transcript-extraction';

const transcript = 'For lunch I had brown rice, salmon, and roasted broccoli.';

test('builds a constrained extraction prompt without requesting nutrition', () => {
  const messages = buildMealTranscriptMessages(transcript);

  assert.equal(messages.length, 2);
  assert.match(messages[0].content, /Do not estimate nutrition/);
  assert.match(messages[1].content, /brown rice/);
});

test('parses fenced JSON and keeps only transcript-grounded meal details', () => {
  const result = parseMealTranscriptExtraction(
    '```json\n{"mealName":"Salmon lunch","foods":["brown rice","salmon","roasted broccoli"]}\n```',
    transcript
  );

  assert.equal(result.mealName, 'Brown Rice, Salmon, Roasted Broccoli');
  assert.deepEqual(result.foods, ['brown rice', 'salmon', 'roasted broccoli']);
});

test('separates repeated portions when speech recognition omits punctuation and connectors', () => {
  const result = extractGroundedMealFromTranscript(
    'Today I had nine grams of brown rice 20 grand salmon and a cup of lettuce'
  );

  assert.deepEqual(result.foods, [
    'nine grams of brown rice',
    '20 grams salmon',
    'a cup of lettuce',
  ]);
  assert.equal(result.mealName, 'Brown Rice, Salmon, Lettuce');
});

test('refines a missing meal verb into a readable sentence before extraction', () => {
  const refined = refineMealTranscript(
    'today i 9 g of rice and 20 g of salmon'
  );

  assert.equal(refined, 'Today I ate 9 g of rice and 20 g of salmon.');
  assert.deepEqual(extractGroundedMealFromTranscript(refined).foods, [
    '9 g of rice',
    '20 g of salmon',
  ]);
});

test('adds readable separators without changing repeated quantities', () => {
  assert.equal(
    refineMealTranscript(
      'for lunch i had 9 grams of brown rice 20 grams of salmon a cup of lettuce'
    ),
    'For lunch, I had 9 grams of brown rice, 20 grams of salmon, and a cup of lettuce.'
  );
});

test('does not rewrite an already readable unsupported action', () => {
  assert.equal(refineMealTranscript('I drank coffee.'), 'I drank coffee.');
});

test('deduplicates repeated foods case-insensitively', () => {
  const result = parseMealTranscriptExtraction(
    '{"foods":["salmon","Salmon"]}',
    transcript
  );

  assert.deepEqual(result.foods, ['salmon']);
});

test('derives an editable meal name from the remaining food descriptions', () => {
  const foods = splitFoodDescriptions(
    '9 grams of brown rice, 6 grams of salmon; a cup of lettuce'
  );

  assert.deepEqual(foods, [
    '9 grams of brown rice',
    '6 grams of salmon',
    'a cup of lettuce',
  ]);
  assert.equal(
    deriveMealNameFromFoods(foods),
    'Brown Rice, Salmon, Lettuce'
  );
  assert.equal(
    deriveMealNameFromFoods(foods.slice(0, 2)),
    'Brown Rice, Salmon'
  );
});

test('rejects hallucinated foods that are absent from the transcript', () => {
  assert.throws(
    () =>
      parseMealTranscriptExtraction(
        '{"mealName":"Salmon lunch","foods":["salmon","avocado"]}',
        transcript
      ),
    MealTranscriptExtractionError
  );
});

test('rejects malformed or unstructured model output', () => {
  assert.throws(
    () => parseMealTranscriptExtraction('I think this was salmon.', transcript),
    MealTranscriptExtractionError
  );
  assert.throws(
    () => parseMealTranscriptExtraction('{"foods":"salmon"}', transcript),
    MealTranscriptExtractionError
  );
  assert.throws(
    () =>
      parseMealTranscriptExtraction(
        '{"foods":["salmon"],"calories":400}',
        transcript
      ),
    MealTranscriptExtractionError
  );
});
