import assert from 'node:assert/strict';
import test from 'node:test';

import {
  convertGlucoseToMgDl,
  normalizeGlucoseReadings,
} from '../utils/glucose-normalization';

test('normalizes mmol/L to mg/dL and preserves source provenance', () => {
  const [reading] = normalizeGlucoseReadings([
    {
      timestamp: '2026-08-10T08:00:00-07:00',
      value: 5.5,
      unit: 'mmol/L',
      source: 'import',
      sourceRecordId: 'csv-row-4',
      deviceName: 'Example import',
    },
  ]);

  assert.equal(reading.id, 'import:csv-row-4');
  assert.equal(reading.timestamp, '2026-08-10T15:00:00.000Z');
  assert.equal(reading.valueMgDl, 99);
  assert.equal(reading.source, 'import');
  assert.equal(reading.sourceRecordId, 'csv-row-4');
  assert.equal(reading.deviceName, 'Example import');
  assert.equal(convertGlucoseToMgDl(5.5, 'mmol/L'), 99.085734);
});

test('rejects malformed records, sorts timestamps, and removes duplicate source IDs', () => {
  const readings = normalizeGlucoseReadings([
    {
      timestamp: '2026-08-10T15:05:00.000Z',
      value: 110,
      unit: 'mg/dL',
      source: 'healthkit',
      sourceRecordId: 'later',
    },
    {
      timestamp: '2026-08-10T15:00:00.000Z',
      value: 100,
      unit: 'mg/dL',
      source: 'healthkit',
      sourceRecordId: 'first',
    },
    {
      timestamp: '2026-08-10T15:10:00.000Z',
      value: 140,
      unit: 'mg/dL',
      source: 'healthkit',
      sourceRecordId: 'first',
    },
    {
      timestamp: 'not-a-date',
      value: 120,
      unit: 'mg/dL',
      source: 'healthkit',
    },
    {
      timestamp: '2026-08-10T15:15:00.000Z',
      value: Number.NaN,
      unit: 'mg/dL',
      source: 'healthkit',
    },
    {
      timestamp: '2026-08-10T15:20:00.000Z',
      value: 7,
      unit: 'count',
      source: 'healthkit',
    },
  ]);

  assert.deepEqual(
    readings.map((reading) => reading.id),
    ['healthkit:first', 'healthkit:later']
  );
  assert.deepEqual(
    readings.map((reading) => reading.valueMgDl),
    [100, 110]
  );
});

test('generates the same fallback ID for the same provider record content', () => {
  const raw = {
    timestamp: '2026-08-10T15:00:00.000Z',
    value: 100,
    unit: 'mg/dL',
    source: 'health-connect' as const,
    deviceName: 'test.source',
  };
  const first = normalizeGlucoseReadings([raw])[0];
  const second = normalizeGlucoseReadings([raw])[0];
  assert.equal(first.id, second.id);
});
