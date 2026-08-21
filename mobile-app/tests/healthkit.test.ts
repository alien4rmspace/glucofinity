import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type HealthKitBloodGlucoseSample,
  mapHealthKitBloodGlucoseSamples,
} from '../utils/healthkit';

function sample(
  uuid: string,
  startDate: string,
  quantity: number,
  unit = 'mg/dL'
): HealthKitBloodGlucoseSample {
  return {
    uuid,
    startDate: new Date(startDate),
    quantity,
    unit,
    sourceRevision: { source: { bundleIdentifier: 'test.health.source' } },
  };
}

test('maps Apple Health samples in timestamp order and converts mmol/L to mg/dL', () => {
  const readings = mapHealthKitBloodGlucoseSamples([
    sample('later', '2026-08-08T12:05:00.000Z', 110),
    sample('first', '2026-08-08T12:00:00.000Z', 5.5, 'mmol<180.15588000005408>/l'),
  ]);

  assert.deepEqual(
    readings.map(({ id, valueMgDl, source }) => ({ id, valueMgDl, source })),
    [
      { id: 'healthkit:first', valueMgDl: 99, source: 'healthkit' },
      { id: 'healthkit:later', valueMgDl: 110, source: 'healthkit' },
    ]
  );
  assert.equal(readings[1].trend, 'rapidly-rising');
});

test('preserves Apple Health sample dates and resets display trends across long gaps', () => {
  const readings = mapHealthKitBloodGlucoseSamples([
    sample('one', '2026-08-08T12:00:00.000Z', 100),
    sample('two', '2026-08-08T13:00:00.000Z', 140),
  ]);

  assert.equal(readings[0].timestamp, '2026-08-08T12:00:00.000Z');
  assert.equal(readings[1].trend, 'steady');
});

test('filters invalid Apple Health samples and removes duplicate native UUIDs', () => {
  const readings = mapHealthKitBloodGlucoseSamples([
    sample('valid', '2026-08-08T12:00:00.000Z', 100),
    sample('valid', '2026-08-08T12:05:00.000Z', 110),
    sample('invalid-value', '2026-08-08T12:10:00.000Z', Number.NaN),
    sample('invalid-time', 'not-a-date', 120),
    sample('unsupported-unit', '2026-08-08T12:15:00.000Z', 7, 'count'),
  ]);

  assert.equal(readings.length, 1);
  assert.equal(readings[0].id, 'healthkit:valid');
});
