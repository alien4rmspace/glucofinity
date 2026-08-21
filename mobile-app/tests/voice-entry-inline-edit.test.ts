import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const voiceEntrySource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../components/voice-meal-entry.tsx'),
  'utf8',
);

test('keeps voice nutrition and ingredient fields directly editable', () => {
  assert.doesNotMatch(voiceEntrySource, /Edit nutrition/);
  assert.doesNotMatch(voiceEntrySource, /Edit ingredient/);
  assert.match(voiceEntrySource, /label="Calories"/);
  assert.match(voiceEntrySource, /label="Carbs \(g\)"/);
  assert.match(voiceEntrySource, /label="Protein \(g\)"/);
  assert.match(voiceEntrySource, /label="Fat \(g\)"/);
  assert.match(voiceEntrySource, /label="Fiber \(g\)"/);
  assert.match(voiceEntrySource, /label="Ingredient"/);
  assert.match(voiceEntrySource, /Ingredient nutrition/);
  assert.match(voiceEntrySource, /onNutritionChange/);
});

test('applies the exact closest local option and updates the visible ingredient immediately', () => {
  assert.match(voiceEntrySource, /setInputValue\(suggestion\.suggestedInput\)/);
  assert.match(
    voiceEntrySource,
    /onSuggestion\(suggestion\.suggestedInput, suggestion\.fdcId\)/,
  );
  assert.match(
    voiceEntrySource,
    /nutritionCatalog\.estimate\(foods, selectedFoodFdcIds\)/,
  );
});
