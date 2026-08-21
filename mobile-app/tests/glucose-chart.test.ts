import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aggregateGlucoseReadingsByInterval,
  assignTimelineMarkerLanes,
  glucoseChartPointIntervalLabel,
  glucoseChartPointIntervalMinutes,
  nearestPointByX,
  positionInTimeRange,
  positionTimestampedItemsInTimeRange,
} from '../utils/chart-time';
import { selectGlucoseDisplayWindow } from '../utils/glucose-display-window';
import type { GlucoseReading } from '../types/health';

const startTime = Date.parse('2026-08-15T12:00:00.000Z');
const endTime = Date.parse('2026-08-15T16:00:00.000Z');

test('positions glucose readings by elapsed time instead of array index', () => {
  assert.equal(positionInTimeRange('2026-08-15T12:00:00.000Z', startTime, endTime), 0);
  assert.equal(positionInTimeRange('2026-08-15T13:00:00.000Z', startTime, endTime), 0.25);
  assert.equal(positionInTimeRange('2026-08-15T15:30:00.000Z', startTime, endTime), 0.875);
  assert.equal(positionInTimeRange('2026-08-15T16:00:00.000Z', startTime, endTime), 1);
});

test('excludes timestamps that cannot be plotted in the selected range', () => {
  assert.equal(positionInTimeRange('2026-08-15T11:59:59.999Z', startTime, endTime), null);
  assert.equal(positionInTimeRange('2026-08-15T16:00:00.001Z', startTime, endTime), null);
  assert.equal(positionInTimeRange('not-a-date', startTime, endTime), null);
  assert.equal(positionInTimeRange(startTime, endTime, startTime), null);
});

test('selects the nearest plotted reading while scrubbing', () => {
  const points = [
    { id: 'first', x: 20 },
    { id: 'middle', x: 80 },
    { id: 'last', x: 140 },
  ];

  assert.equal(nearestPointByX(points, 18)?.id, 'first');
  assert.equal(nearestPointByX(points, 91)?.id, 'middle');
  assert.equal(nearestPointByX(points, 139)?.id, 'last');
  assert.equal(nearestPointByX([], 50), undefined);
});

test('positions only meal markers inside the displayed glucose range', () => {
  const meals = [
    { id: 'late', name: 'Late meal', timestamp: '2026-08-15T15:30:00.000Z' },
    { id: 'outside', name: 'Outside meal', timestamp: '2026-08-15T16:01:00.000Z' },
    { id: 'early', name: 'Early meal', timestamp: '2026-08-15T13:00:00.000Z' },
  ];

  const positioned = positionTimestampedItemsInTimeRange(meals, startTime, endTime);

  assert.deepEqual(positioned.map(({ item }) => item.id), ['early', 'late']);
  assert.equal(positioned[0].position, 0.25);
  assert.equal(positioned[1].position, 0.875);
});

test('stacks nearby timeline markers into separate lanes', () => {
  const positioned = assignTimelineMarkerLanes(
    [{ x: 10 }, { x: 20 }, { x: 50 }, { x: 55 }],
    38,
    2
  );

  assert.deepEqual(positioned.map(({ lane }) => lane), [0, 1, 0, 1]);
});

function reading(id: string, timestamp: string): GlucoseReading {
  return {
    id,
    timestamp,
    valueMgDl: 110,
    trend: 'steady',
    source: 'healthkit',
  };
}

test('uses readable averaging intervals for dense chart ranges', () => {
  assert.equal(glucoseChartPointIntervalMinutes(3), undefined);
  assert.equal(glucoseChartPointIntervalMinutes(6), undefined);
  assert.equal(glucoseChartPointIntervalMinutes(12), 10);
  assert.equal(glucoseChartPointIntervalMinutes(24), undefined);
  assert.equal(glucoseChartPointIntervalMinutes(7 * 24), 60);
  assert.equal(glucoseChartPointIntervalMinutes(30 * 24), 6 * 60);
  assert.equal(glucoseChartPointIntervalMinutes(365 * 24), 7 * 24 * 60);
  assert.equal(glucoseChartPointIntervalLabel(10), '10-minute');
  assert.equal(glucoseChartPointIntervalLabel(60), '1-hour');
  assert.equal(glucoseChartPointIntervalLabel(6 * 60), '6-hour');
  assert.equal(glucoseChartPointIntervalLabel(7 * 24 * 60), '1-week');
});

test('averages readings within anchored ten-minute chart intervals', () => {
  const readings = [
    { ...reading('first', '2026-08-15T12:01:00.000Z'), valueMgDl: 100 },
    { ...reading('second', '2026-08-15T12:04:00.000Z'), valueMgDl: 110 },
    { ...reading('third', '2026-08-15T12:09:00.000Z'), valueMgDl: 120 },
    { ...reading('next', '2026-08-15T12:10:00.000Z'), valueMgDl: 130 },
  ];

  const aggregated = aggregateGlucoseReadingsByInterval(
    readings,
    10,
    '2026-08-15T12:00:00.000Z'
  );

  assert.equal(aggregated.length, 2);
  assert.equal(aggregated[0].valueMgDl, 110);
  assert.equal(aggregated[0].timestamp, '2026-08-15T12:04:00.000Z');
  assert.match(aggregated[0].id, /^chart-average-/);
  assert.deepEqual(aggregated[1], readings[3]);
});

test('anchors a short range to the latest available delayed import', () => {
  const window = selectGlucoseDisplayWindow(
    [
      reading('outside', '2026-08-15T11:55:00.000Z'),
      reading('start', '2026-08-15T12:00:00.000Z'),
      reading('middle', '2026-08-15T13:30:00.000Z'),
      reading('latest', '2026-08-15T15:00:00.000Z'),
    ],
    3,
    new Date('2026-08-15T18:00:00.000Z')
  );

  assert.deepEqual(window.readings.map((item) => item.id), ['start', 'middle', 'latest']);
  assert.equal(window.timeRange.startTime, '2026-08-15T12:00:00.000Z');
  assert.equal(window.timeRange.endTime, '2026-08-15T15:00:00.000Z');
  assert.equal(window.timeRange.endsAtLatestReading, true);
});

test('keeps a fresh range anchored to the current query time', () => {
  const window = selectGlucoseDisplayWindow(
    [
      reading('outside', '2026-08-15T14:55:00.000Z'),
      reading('inside', '2026-08-15T15:00:00.000Z'),
      reading('latest', '2026-08-15T17:55:00.000Z'),
    ],
    3,
    new Date('2026-08-15T18:00:00.000Z')
  );

  assert.deepEqual(window.readings.map((item) => item.id), ['inside', 'latest']);
  assert.equal(window.timeRange.startTime, '2026-08-15T15:00:00.000Z');
  assert.equal(window.timeRange.endTime, '2026-08-15T18:00:00.000Z');
  assert.equal(window.timeRange.endsAtLatestReading, false);
});
