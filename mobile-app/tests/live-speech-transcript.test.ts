import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { mergeLiveSpeechTranscript } from '../services/live-speech-transcript';

test('keeps cumulative partial speech results without duplicating words', () => {
  assert.equal(
    mergeLiveSpeechTranscript('Today I ate', 'Today I ate nine grams of rice'),
    'Today I ate nine grams of rice',
  );
  assert.equal(
    mergeLiveSpeechTranscript('Today I ate nine grams of rice', 'nine grams of rice'),
    'Today I ate nine grams of rice',
  );
});

test('accepts recognizer corrections that share a meaningful phrase prefix', () => {
  assert.equal(
    mergeLiveSpeechTranscript(
      'Today I ate nine grams of rice',
      'Today I ate 90 grams of rice',
    ),
    'Today I ate 90 grams of rice',
  );
});

test('appends a new speech segment after a pause instead of replacing earlier words', () => {
  const firstSegment = mergeLiveSpeechTranscript('', 'Today I ate 90 grams of rice');
  const completeTranscript = mergeLiveSpeechTranscript(
    firstSegment,
    'and 20 grams of salmon',
  );

  assert.equal(
    completeTranscript,
    'Today I ate 90 grams of rice and 20 grams of salmon',
  );
});

test('voice entry retains touch ownership and only stages Add to session drafts', () => {
  const voiceEntrySource = readFileSync(
    path.resolve('components/voice-meal-entry.tsx'),
    'utf8',
  );
  const nativeSpeechSource = readFileSync(
    path.resolve('modules/glucofinity-speech/ios/GlucofinitySpeechModule.swift'),
    'utf8',
  );
  const mealFormSource = readFileSync(path.resolve('app/meal/[id].tsx'), 'utf8');
  const addVoiceMealStart = mealFormSource.indexOf('function addVoiceMealDraftToSession');
  const addVoiceMealEnd = mealFormSource.indexOf('function markNutritionEdited');
  const addVoiceMealSource = mealFormSource.slice(addVoiceMealStart, addVoiceMealEnd);
  const submitStart = mealFormSource.indexOf('async function submit');
  const submitEnd = mealFormSource.indexOf('function confirmDelete');
  const submitSource = mealFormSource.slice(submitStart, submitEnd);

  assert.match(voiceEntrySource, /cancelable=\{false\}/);
  assert.match(voiceEntrySource, /pressRetentionOffset=\{1000\}/);
  assert.match(voiceEntrySource, /accumulateLiveTranscript\(transcript\)/);
  assert.match(voiceEntrySource, /has not been saved yet/);
  assert.match(voiceEntrySource, /then press Save meal/);
  assert.doesNotMatch(voiceEntrySource, /Continue in full form/);
  assert.match(nativeSpeechSource, /mergeLiveTranscript/);
  assert.match(nativeSpeechSource, /"transcript": accumulatedTranscript/);
  assert.match(addVoiceMealSource, /mergeVoiceDraftIntoMealSession/);
  assert.doesNotMatch(addVoiceMealSource, /saveMeal/);
  assert.doesNotMatch(addVoiceMealSource, /router\.back\(\)/);
  assert.match(submitSource, /await saveMeal\(entry\)/);
  assert.match(submitSource, /router\.back\(\)/);
});
