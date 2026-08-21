import assert from 'node:assert/strict';
import test from 'node:test';

import type { GlucoseReading } from '../types/health';
import {
  averageGlucose,
  classifyGlucoseStatus,
  glucoseMinMax,
  glucoseStandardDeviation,
  timeInRangePercentage,
} from '../utils/glucose-metrics';

function reading(id: string, timestamp: string, valueMgDl: number): GlucoseReading {
  return { id, timestamp, valueMgDl, trend: 'steady', source: 'mock' };
}

const sampleReadings = [
  reading('1', '2026-08-04T12:00:00.000Z', 80),
  reading('2', '2026-08-04T12:05:00.000Z', 100),
  reading('3', '2026-08-04T12:10:00.000Z', 120),
  reading('4', '2026-08-04T12:15:00.000Z', 200),
];

test('averageGlucose returns the arithmetic mean and handles empty input', () => {
  assert.equal(averageGlucose(sampleReadings), 125);
  assert.equal(averageGlucose([]), null);
});

test('glucoseMinMax returns the minimum and maximum', () => {
  assert.deepEqual(glucoseMinMax(sampleReadings), { minimum: 80, maximum: 200 });
  assert.equal(glucoseMinMax([]), null);
});

test('timeInRangePercentage includes both target boundaries', () => {
  const readings = [
    reading('1', '2026-08-04T12:00:00.000Z', 70),
    reading('2', '2026-08-04T12:05:00.000Z', 100),
    reading('3', '2026-08-04T12:10:00.000Z', 180),
    reading('4', '2026-08-04T12:15:00.000Z', 181),
  ];
  assert.equal(timeInRangePercentage(readings, { lowMgDl: 70, highMgDl: 180 }), 75);
  assert.equal(timeInRangePercentage([], { lowMgDl: 70, highMgDl: 180 }), null);
});

test('glucoseStandardDeviation uses population standard deviation', () => {
  const readings = [
    reading('1', '2026-08-04T12:00:00.000Z', 90),
    reading('2', '2026-08-04T12:05:00.000Z', 100),
    reading('3', '2026-08-04T12:10:00.000Z', 110),
  ];
  const result = glucoseStandardDeviation(readings);
  assert.ok(result !== null);
  assert.ok(Math.abs(result - 8.1649658) < 0.0001);
});

test('classifyGlucoseStatus returns readable range categories', () => {
  const targetRange = { lowMgDl: 70, highMgDl: 180 };
  assert.equal(classifyGlucoseStatus(69, targetRange), 'below-range');
  assert.equal(classifyGlucoseStatus(70, targetRange), 'in-range');
  assert.equal(classifyGlucoseStatus(180, targetRange), 'in-range');
  assert.equal(classifyGlucoseStatus(181, targetRange), 'elevated');
  assert.equal(classifyGlucoseStatus(251, targetRange), 'very-high');
});
