import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  normalizeFeelingCheckIn,
  pairFeelingCheckInsWithGlucose,
  sortFeelingCheckIns,
} from '../services/feeling-check-ins';
import type { FeelingCheckIn, GlucoseReading } from '../types/health';

const syntheticCheckIn: FeelingCheckIn = {
  id: 'synthetic-check-in-1',
  timestamp: '2026-08-19T12:00:00.000Z',
  timezoneOffsetMinutes: 420,
  overallFeeling: 3,
  energy: 2,
  stress: 4,
  sensations: ['tired'],
  notes: 'Synthetic test entry',
  source: 'manual',
};

function reading(id: string, timestamp: string, valueMgDl: number): GlucoseReading {
  return {
    id,
    timestamp,
    valueMgDl,
    trend: 'steady',
    source: 'mock',
  };
}

test('normalizes a valid feeling check-in and rejects invalid ratings or sensations', () => {
  const normalized = normalizeFeelingCheckIn({
    ...syntheticCheckIn,
    id: ' synthetic-check-in-1 ',
    notes: '  Synthetic test entry  ',
  });

  assert.equal(normalized?.id, 'synthetic-check-in-1');
  assert.equal(normalized?.notes, 'Synthetic test entry');
  assert.equal(normalizeFeelingCheckIn({ ...syntheticCheckIn, overallFeeling: 6 }), undefined);
  assert.equal(
    normalizeFeelingCheckIn({ ...syntheticCheckIn, sensations: ['unsupported-value'] }),
    undefined,
  );
});

test('sorts feeling check-ins newest first', () => {
  const older = { ...syntheticCheckIn, id: 'older', timestamp: '2026-08-18T12:00:00.000Z' };
  const newer = { ...syntheticCheckIn, id: 'newer', timestamp: '2026-08-20T12:00:00.000Z' };

  assert.deepEqual(sortFeelingCheckIns([older, newer]).map(({ id }) => id), ['newer', 'older']);
});

test('pairs a check-in with the nearest sufficiently close glucose reading', () => {
  const pairs = pairFeelingCheckInsWithGlucose([syntheticCheckIn], [
    reading('ten-minutes-before', '2026-08-19T11:50:00.000Z', 104),
    reading('eight-minutes-after', '2026-08-19T12:08:00.000Z', 111),
  ]);

  assert.equal(pairs[0].nearestReading?.id, 'eight-minutes-after');
  assert.equal(pairs[0].minutesFromReading, 8);
});

test('leaves missing glucose unpaired and can pair it after a delayed import', () => {
  const initial = pairFeelingCheckInsWithGlucose([syntheticCheckIn], [
    reading('too-far-away', '2026-08-19T11:30:00.000Z', 101),
  ]);
  const afterImport = pairFeelingCheckInsWithGlucose([syntheticCheckIn], [
    reading('too-far-away', '2026-08-19T11:30:00.000Z', 101),
    reading('delayed-record', '2026-08-19T12:04:00.000Z', 108),
  ]);

  assert.equal(initial[0].nearestReading, undefined);
  assert.equal(afterImport[0].nearestReading?.id, 'delayed-record');
});

test('wires check-ins into the dashboard, local reset, and exact editor route', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const dashboard = readFileSync(resolve(root, 'app/(tabs)/index.tsx'), 'utf8');
  const provider = readFileSync(resolve(root, 'providers/app-data-provider.tsx'), 'utf8');
  const editor = readFileSync(resolve(root, 'app/check-in/[id].tsx'), 'utf8');

  assert.match(dashboard, /How are you feeling right now\?/);
  assert.match(provider, /repositories\.feelingCheckIns\.replaceAll\(\[\]\)/);
  assert.match(editor, /saveFeelingCheckIn\(checkIn\)/);
  assert.match(editor, /Future glucose comparisons will describe associations/);
});
