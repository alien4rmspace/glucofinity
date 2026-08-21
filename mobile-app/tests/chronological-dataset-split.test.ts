import assert from 'node:assert/strict';
import test from 'node:test';

import { chronologicalDatasetSplit } from '../services/chronological-dataset-split';

test('sorts examples chronologically and keeps all three partitions nonempty', () => {
  const split = chronologicalDatasetSplit([
    { occurredAt: '2026-08-03T00:00:00.000Z', value: 3 },
    { occurredAt: '2026-08-01T00:00:00.000Z', value: 1 },
    { occurredAt: '2026-08-02T00:00:00.000Z', value: 2 },
  ]);

  assert.deepEqual(split.training.map((example) => example.value), [1]);
  assert.deepEqual(split.validation.map((example) => example.value), [2]);
  assert.deepEqual(split.testing.map((example) => example.value), [3]);
});

test('rejects too few examples or invalid ratios', () => {
  assert.throws(() =>
    chronologicalDatasetSplit([{ occurredAt: '2026-08-01T00:00:00.000Z' }])
  );
  assert.throws(() =>
    chronologicalDatasetSplit(
      [
        { occurredAt: '2026-08-01T00:00:00.000Z' },
        { occurredAt: '2026-08-02T00:00:00.000Z' },
        { occurredAt: '2026-08-03T00:00:00.000Z' },
      ],
      { training: 0.8, validation: 0.2, testing: 0.2 }
    )
  );
});
