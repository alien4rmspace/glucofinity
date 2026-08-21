import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mergeVoiceDraftIntoMealSession,
  type VoiceMealSessionState,
} from '../services/voice-meal-session';
import type { MacroNutrients } from '../types/nutrition';
import type { AppliedVoiceMealDraft } from '../types/voice-meal';

const emptySession: VoiceMealSessionState = {
  name: '',
  description: '',
  timeValue: '08:00',
  foodNames: '',
  foodEstimates: [],
  calories: '',
  carbohydratesGrams: '',
  proteinGrams: '',
  fatGrams: '',
  fiberGrams: '',
  nutritionSource: 'manual',
};

function voiceDraft(
  food: string,
  mealName: string,
  transcript: string,
  mealTime: string,
  nutrition: MacroNutrients,
): AppliedVoiceMealDraft {
  return {
    transcript,
    mealName,
    mealTime,
    foods: [food],
    nutrition,
    nutritionEstimate: {
      foods: [{
        input: food,
        estimatedGrams: 90,
        usedDefaultPortion: false,
        nutrients: nutrition,
        confidence: 0.92,
      }],
      totals: nutrition,
      matchedFoodCount: 1,
      totalFoodCount: 1,
      defaultPortionCount: 0,
      sourceId: 'test-catalog',
      sourceLabel: 'Test catalog',
      sourceUrl: 'https://example.test',
    },
    providerId: 'local-lfm',
    model: 'lfm-test',
    generatedAt: '2026-08-20T12:00:00.000Z',
    edited: false,
  };
}

const riceDraft = voiceDraft(
  '90 grams of brown rice',
  'Brown Rice',
  'Today I ate 90 grams of brown rice.',
  '12:30',
  {
    calories: 120,
    carbohydratesGrams: 25,
    proteinGrams: 2.5,
    fatGrams: 0.8,
    fiberGrams: 1.5,
  },
);

const salmonDraft = voiceDraft(
  '20 grams of salmon',
  'Salmon',
  'I also ate 20 grams of salmon.',
  '12:34',
  {
    calories: 41.2,
    carbohydratesGrams: 0,
    proteinGrams: 4.4,
    fatGrams: 2.6,
    fiberGrams: 0,
  },
);

test('adds the first voice draft to the open meal form without creating an entry', () => {
  const merged = mergeVoiceDraftIntoMealSession(emptySession, riceDraft);

  assert.equal(merged.name, 'Brown Rice');
  assert.equal(merged.description, riceDraft.transcript);
  assert.equal(merged.timeValue, '12:30');
  assert.equal(merged.foodNames, '90 grams of brown rice');
  assert.equal(merged.calories, '120');
  assert.equal(merged.carbohydratesGrams, '25');
  assert.equal(merged.nutritionSource, 'ai-estimated');
  assert.equal(merged.foodEstimates.length, 1);
});

test('combines repeated Add to session drafts into one current meal', () => {
  const withRice = mergeVoiceDraftIntoMealSession(emptySession, riceDraft);
  const combined = mergeVoiceDraftIntoMealSession(withRice, salmonDraft);

  assert.equal(combined.name, 'Brown Rice, Salmon');
  assert.equal(
    combined.description,
    `${riceDraft.transcript}\n${salmonDraft.transcript}`,
  );
  assert.equal(combined.timeValue, '12:30');
  assert.equal(
    combined.foodNames,
    '90 grams of brown rice, 20 grams of salmon',
  );
  assert.equal(combined.calories, '161.2');
  assert.equal(combined.carbohydratesGrams, '25');
  assert.equal(combined.proteinGrams, '6.9');
  assert.equal(combined.fatGrams, '3.4');
  assert.equal(combined.fiberGrams, '1.5');
  assert.equal(combined.foodEstimates.length, 2);
  assert.equal(combined.nutritionSource, 'ai-corrected');
});

test('preserves a user-entered meal name while adding another voice draft', () => {
  const current = mergeVoiceDraftIntoMealSession(emptySession, riceDraft);
  const combined = mergeVoiceDraftIntoMealSession(
    { ...current, name: 'Post-workout lunch' },
    salmonDraft,
  );

  assert.equal(combined.name, 'Post-workout lunch');
});
