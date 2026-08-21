import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createHealthKitDailyFitnessSummary,
  mapHealthKitWorkoutSamples,
  type HealthKitWorkoutSample,
  workoutActivityLabel,
} from '../utils/healthkit-fitness';

const rangeStart = new Date('2026-08-13T07:00:00.000Z');
const rangeEnd = new Date('2026-08-13T19:00:00.000Z');

function workout(
  uuid: string,
  startDate: string,
  endDate: string,
  activityType = 52,
  durationQuantity = 1_800,
  durationUnit = 's'
): HealthKitWorkoutSample {
  return {
    uuid,
    startDate,
    endDate,
    duration: { quantity: durationQuantity, unit: durationUnit },
    workoutActivityType: activityType,
    sourceRevision: {
      source: { name: 'Fictional Fitness Source', bundleIdentifier: 'test.fitness' },
    },
  };
}

test('creates a daily fitness summary from HealthKit cumulative totals and workouts', () => {
  const summary = createHealthKitDailyFitnessSummary(
    rangeStart,
    rangeEnd,
    { sumQuantity: { quantity: 5_432.4, unit: 'count' } },
    { sumQuantity: { quantity: 321.45, unit: 'kcal' } },
    [
      workout(
        'walk',
        '2026-08-13T15:00:00.000Z',
        '2026-08-13T15:35:00.000Z'
      ),
      workout(
        'run',
        '2026-08-13T17:00:00.000Z',
        '2026-08-13T17:30:00.000Z',
        37,
        30,
        'min'
      ),
    ]
  );

  assert.equal(summary.stepCount, 5_432);
  assert.equal(summary.activeEnergyKilocalories, 321.5);
  assert.deepEqual(
    summary.workouts.map((entry) => ({
      id: entry.id,
      activityType: entry.activityType,
      durationMinutes: entry.durationMinutes,
      sourceName: entry.sourceName,
    })),
    [
      {
        id: 'healthkit-workout:walk',
        activityType: 'Walking',
        durationMinutes: 30,
        sourceName: 'Fictional Fitness Source',
      },
      {
        id: 'healthkit-workout:run',
        activityType: 'Running',
        durationMinutes: 30,
        sourceName: 'Fictional Fitness Source',
      },
    ]
  );
});

test('keeps missing HealthKit totals unavailable while preserving observed zero', () => {
  const missing = createHealthKitDailyFitnessSummary(
    rangeStart,
    rangeEnd,
    {},
    { sumQuantity: { quantity: Number.NaN, unit: 'kcal' } },
    []
  );
  const observedZero = createHealthKitDailyFitnessSummary(
    rangeStart,
    rangeEnd,
    { sumQuantity: { quantity: 0, unit: 'count' } },
    { sumQuantity: { quantity: 0, unit: 'kcal' } },
    []
  );

  assert.equal(missing.stepCount, undefined);
  assert.equal(missing.activeEnergyKilocalories, undefined);
  assert.equal(observedZero.stepCount, 0);
  assert.equal(observedZero.activeEnergyKilocalories, 0);
});

test('filters duplicate, invalid, and out-of-range workout records', () => {
  const mapped = mapHealthKitWorkoutSamples(
    [
      workout('valid', '2026-08-13T12:00:00.000Z', '2026-08-13T12:30:00.000Z'),
      workout('valid', '2026-08-13T13:00:00.000Z', '2026-08-13T13:30:00.000Z'),
      workout('', '2026-08-13T14:00:00.000Z', '2026-08-13T14:30:00.000Z'),
      workout('outside', '2026-08-13T05:00:00.000Z', '2026-08-13T05:30:00.000Z'),
      workout('reversed', '2026-08-13T16:00:00.000Z', '2026-08-13T15:30:00.000Z'),
      workout('bad-date', 'not-a-date', '2026-08-13T15:30:00.000Z'),
    ],
    rangeStart,
    rangeEnd
  );

  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].sourceRecordId, 'valid');
});

test('uses stable labels for known and future workout activity types', () => {
  assert.equal(workoutActivityLabel(57), 'Yoga');
  assert.equal(workoutActivityLabel(999_999), 'Workout');
});
