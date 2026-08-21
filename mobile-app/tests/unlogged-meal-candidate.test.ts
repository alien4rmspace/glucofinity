import assert from 'node:assert/strict';
import test from 'node:test';

import { findUnloggedMealCandidate } from '../services/unlogged-meal-candidate';
import type { GlucoseReading, MealEntry } from '../types/health';

const baseTime = Date.parse('2026-08-16T16:00:00.000Z');

function reading(index: number, minutes: number, valueMgDl: number): GlucoseReading {
  return {
    id: `reading-${index}`,
    timestamp: new Date(baseTime + minutes * 60_000).toISOString(),
    valueMgDl,
    trend: 'steady',
    source: 'healthkit',
  };
}

const observedRise = [
  reading(0, 0, 96),
  reading(1, 10, 101),
  reading(2, 20, 110),
  reading(3, 30, 126),
  reading(4, 40, 141),
];

test('finds a well-sampled possible unlogged event', () => {
  const candidate = findUnloggedMealCandidate(observedRise, []);

  assert.ok(candidate);
  assert.equal(candidate.startedAt, observedRise[0].timestamp);
  assert.equal(candidate.endedAt, observedRise[4].timestamp);
  assert.equal(candidate.suggestedMealTimestamp, observedRise[0].timestamp);
  assert.equal(candidate.observedRiseMgDl, 45);
  assert.equal(candidate.sampleCount, 5);
});

test('does not prompt for a modest rise or a segment with a long sampling gap', () => {
  assert.equal(
    findUnloggedMealCandidate(
      [reading(0, 0, 100), reading(1, 10, 105), reading(2, 20, 112), reading(3, 30, 125)],
      []
    ),
    null
  );
  assert.equal(
    findUnloggedMealCandidate(
      [reading(0, 0, 96), reading(1, 10, 101), reading(2, 40, 126), reading(3, 50, 141)],
      []
    ),
    null
  );
});

test('suppresses a candidate when a saved meal is already nearby', () => {
  const meal: MealEntry = {
    id: 'meal-near-rise',
    timestamp: new Date(baseTime - 30 * 60_000).toISOString(),
    name: 'Saved breakfast',
  };

  assert.equal(findUnloggedMealCandidate(observedRise, [meal]), null);
});

test('prefers the largest qualifying observed rise', () => {
  const laterRise = [
    reading(5, 180, 100),
    reading(6, 190, 112),
    reading(7, 200, 128),
    reading(8, 210, 137),
  ];
  const candidate = findUnloggedMealCandidate([...observedRise, ...laterRise], []);

  assert.equal(candidate?.observedRiseMgDl, 45);
  assert.equal(candidate?.endedAt, observedRise[4].timestamp);
});
