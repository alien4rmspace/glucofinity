import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type HealthConnectBloodGlucoseRecord,
  mapHealthConnectBloodGlucoseRecords,
} from '../utils/health-connect';

function record(
  id: string,
  time: string,
  valueMgDl: number
): HealthConnectBloodGlucoseRecord {
  return {
    time,
    level: { inMilligramsPerDeciliter: valueMgDl },
    metadata: { id, dataOrigin: 'test.health.source' },
  };
}

test('maps Health Connect records in timestamp order and rounds mg/dL values', () => {
  const readings = mapHealthConnectBloodGlucoseRecords([
    record('later', '2026-08-08T12:05:00.000Z', 103.6),
    record('first', '2026-08-08T12:00:00.000Z', 100.2),
  ]);

  assert.deepEqual(
    readings.map(({ id, valueMgDl, source }) => ({ id, valueMgDl, source })),
    [
      { id: 'health-connect:first', valueMgDl: 100, source: 'health-connect' },
      { id: 'health-connect:later', valueMgDl: 104, source: 'health-connect' },
    ]
  );
  assert.equal(readings[1].trend, 'rising');
});

test('derives display trends only for nearby adjacent records', () => {
  const readings = mapHealthConnectBloodGlucoseRecords([
    record('one', '2026-08-08T12:00:00.000Z', 100),
    record('two', '2026-08-08T12:05:00.000Z', 115),
    record('three', '2026-08-08T12:10:00.000Z', 100),
    record('four', '2026-08-08T13:00:00.000Z', 140),
  ]);

  assert.deepEqual(
    readings.map((reading) => reading.trend),
    ['steady', 'rapidly-rising', 'rapidly-falling', 'steady']
  );
});

test('filters invalid values and removes duplicate native record ids', () => {
  const readings = mapHealthConnectBloodGlucoseRecords([
    record('valid', '2026-08-08T12:00:00.000Z', 100),
    record('valid', '2026-08-08T12:05:00.000Z', 110),
    record('invalid-value', '2026-08-08T12:10:00.000Z', Number.NaN),
    record('invalid-time', 'not-a-date', 120),
  ]);

  assert.equal(readings.length, 1);
  assert.equal(readings[0].id, 'health-connect:valid');
});
