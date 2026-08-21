import assert from 'node:assert/strict';
import test from 'node:test';

import { reviewIngredients, topLevelIngredients } from '../services/ingredient-review';

test('splits top-level ingredients without splitting parenthetical subingredients', () => {
  assert.deepEqual(
    topLevelIngredients('Oats, chocolate (sugar, cocoa butter), almonds; salt'),
    ['Oats', 'chocolate (sugar, cocoa butter)', 'almonds', 'salt'],
  );
});

test('applies the documented deductions deterministically', () => {
  const review = reviewIngredients(
    'Sugar, flour, partially hydrogenated soybean oil, Red 40, salt',
  );

  assert.equal(review.score, 40);
  assert.equal(review.grade, 'D');
  assert.deepEqual(
    review.observations.map(({ id, points }) => ({ id, points })),
    [
      { id: 'added-sweetener', points: -20 },
      { id: 'partially-hydrogenated-oil', points: -30 },
      { id: 'certified-color', points: -10 },
    ],
  );
});

test('does not imply that an unflagged ingredient list is an overall health judgment', () => {
  const review = reviewIngredients('Whole grain oats, almonds, sea salt');

  assert.equal(review.score, 100);
  assert.equal(review.grade, 'A');
  assert.equal(review.observations[0]?.id, 'no-reviewed-flags');
  assert.match(review.limitation, /does not determine overall healthfulness/i);
});

test('leaves products without USDA ingredient text unrated', () => {
  const review = reviewIngredients(undefined);

  assert.equal(review.grade, 'Not rated');
  assert.equal(review.score, undefined);
  assert.deepEqual(review.observations, []);
});
