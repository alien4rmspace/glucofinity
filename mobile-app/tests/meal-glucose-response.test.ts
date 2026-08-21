import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeMealResponse,
  DEFAULT_MEAL_RESPONSE_CONFIG,
} from '../services/meal-glucose-response';
import type { GlucoseReading, MealEntry } from '../types/health';

const meal: MealEntry = {
  id: 'meal-test',
  timestamp: '2026-08-10T12:00:00.000Z',
  name: 'Deterministic test meal',
};

function atMinutes(isoTimestamp: string, minutes: number): string {
  return new Date(Date.parse(isoTimestamp) + minutes * 60_000).toISOString();
}

function reading(
  id: string,
  minutesFromMeal: number,
  valueMgDl: number,
  mealTimestamp = meal.timestamp
): GlucoseReading {
  return {
    id,
    timestamp: atMinutes(mealTimestamp, minutesFromMeal),
    valueMgDl,
    trend: 'steady',
    source: 'mock',
  };
}

function normalResponseReadings(): GlucoseReading[] {
  const postValues = [94, 105, 115, 125, 135, 145, 150, 145, 135, 125, 115, 105, 94];
  return [
    reading('baseline-30', -30, 90),
    reading('baseline-15', -15, 92),
    ...postValues.map((value, index) =>
      reading(`post-${index}`, index * 10, value)
    ),
  ];
}

test('calculates a normal observed meal response with good data quality', () => {
  const result = analyzeMealResponse(meal, normalResponseReadings());

  assert.equal(result.dataQuality, 'good');
  assert.equal(result.sampleCount, 15);
  assert.equal(result.baselineGlucoseMgDl, 92);
  assert.equal(result.peakGlucoseMgDl, 150);
  assert.equal(result.glucoseRiseMgDl, 58);
  assert.equal(result.timeToPeakMinutes, 60);
  assert.equal(result.glucoseAt60MinutesMgDl, 150);
  assert.equal(result.glucoseAt120MinutesMgDl, 94);
  assert.equal(result.returnToBaselineMinutes, 120);
  assert.ok(result.incrementalAuc !== undefined && result.incrementalAuc > 0);
});

test('does not create baseline-dependent metrics without reasonable baseline readings', () => {
  const result = analyzeMealResponse(
    meal,
    normalResponseReadings().filter((item) => Date.parse(item.timestamp) >= Date.parse(meal.timestamp))
  );

  assert.equal(result.dataQuality, 'limited');
  assert.equal(result.baselineGlucoseMgDl, undefined);
  assert.equal(result.glucoseRiseMgDl, undefined);
  assert.equal(result.incrementalAuc, undefined);
  assert.equal(result.peakGlucoseMgDl, 150);
});

test('marks a response insufficient when post-meal readings are missing', () => {
  const result = analyzeMealResponse(meal, [
    reading('baseline-20', -20, 98),
    reading('baseline-5', -5, 100),
    reading('only-post', 10, 105),
  ]);

  assert.equal(result.dataQuality, 'insufficient');
  assert.equal(result.sampleCount, 3);
});

test('handles irregular CGM intervals without filling gaps', () => {
  const result = analyzeMealResponse(meal, [
    reading('baseline-20', -20, 98),
    reading('baseline-5', -5, 100),
    reading('post-0', 0, 101),
    reading('post-7', 7, 108),
    reading('post-23', 23, 120),
    reading('post-41', 41, 132),
    reading('post-64', 64, 145),
    reading('post-91', 91, 125),
    reading('post-119', 119, 103),
    reading('post-146', 146, 99),
  ]);

  assert.equal(result.dataQuality, 'limited');
  assert.equal(result.glucoseAt60MinutesMgDl, 145);
  assert.equal(result.glucoseAt120MinutesMgDl, 103);
  assert.equal(result.sampleCount, 10);
});

test('removes duplicate reading IDs before response calculations', () => {
  const result = analyzeMealResponse(meal, [
    reading('baseline-20', -20, 100),
    reading('baseline-5', -5, 100),
    reading('same-record', 30, 120),
    reading('same-record', 30, 250),
    reading('post-60', 60, 130),
  ]);

  assert.equal(result.sampleCount, 4);
  assert.equal(result.peakGlucoseMgDl, 130);
});

test('calculates incremental AUC with trapezoids above baseline', () => {
  const result = analyzeMealResponse(
    meal,
    [
      reading('baseline-20', -20, 100),
      reading('baseline-5', -5, 100),
      reading('post-0', 0, 100),
      reading('post-30', 30, 140),
      reading('post-60', 60, 100),
    ],
    {
      ...DEFAULT_MEAL_RESPONSE_CONFIG,
      maximumIntegrationGapMinutes: 30,
    }
  );

  assert.equal(result.incrementalAuc, 1200);
});

test('selects the peak, time-to-peak, and nearest 60- and 120-minute readings', () => {
  const result = analyzeMealResponse(meal, [
    reading('baseline-20', -20, 100),
    reading('baseline-5', -5, 100),
    reading('post-0', 0, 102),
    reading('post-52', 52, 140),
    reading('post-68', 68, 150),
    reading('post-127', 127, 110),
  ]);

  assert.equal(result.peakGlucoseMgDl, 150);
  assert.equal(result.timeToPeakMinutes, 68);
  assert.equal(result.glucoseAt60MinutesMgDl, 140);
  assert.equal(result.glucoseAt120MinutesMgDl, 110);
});

test('finds the first return near baseline after the observed peak', () => {
  const result = analyzeMealResponse(meal, [
    reading('baseline-20', -20, 99),
    reading('baseline-5', -5, 101),
    reading('post-0', 0, 102),
    reading('peak', 45, 150),
    reading('still-high', 90, 112),
    reading('returned', 135, 104),
    reading('later', 150, 100),
  ]);

  assert.equal(result.baselineGlucoseMgDl, 100.7);
  assert.equal(result.returnToBaselineMinutes, 135);
});

test('analyzes readings that span midnight', () => {
  const midnightMeal: MealEntry = {
    ...meal,
    timestamp: '2026-08-10T23:50:00.000Z',
  };
  const result = analyzeMealResponse(midnightMeal, [
    reading('baseline-20', -20, 95, midnightMeal.timestamp),
    reading('baseline-5', -5, 97, midnightMeal.timestamp),
    reading('post-0', 0, 98, midnightMeal.timestamp),
    reading('next-day-60', 60, 140, midnightMeal.timestamp),
    reading('next-day-120', 120, 100, midnightMeal.timestamp),
  ]);

  assert.equal(result.peakGlucoseMgDl, 140);
  assert.equal(result.timeToPeakMinutes, 60);
  assert.equal(result.glucoseAt120MinutesMgDl, 100);
});

test('compares meal and reading timestamps by instant across time zones', () => {
  const offsetMeal: MealEntry = {
    ...meal,
    timestamp: '2026-08-10T12:00:00-07:00',
  };
  const result = analyzeMealResponse(offsetMeal, [
    {
      ...reading('baseline-15', 0, 90),
      timestamp: '2026-08-10T18:45:00.000Z',
    },
    {
      ...reading('baseline-5', 0, 94),
      timestamp: '2026-08-10T18:55:00.000Z',
    },
    {
      ...reading('post-0', 0, 96),
      timestamp: '2026-08-10T19:00:00.000Z',
    },
    {
      ...reading('post-60', 0, 140),
      timestamp: '2026-08-10T20:00:00.000Z',
    },
    {
      ...reading('post-120', 0, 100),
      timestamp: '2026-08-10T21:00:00.000Z',
    },
  ]);

  assert.equal(result.baselineGlucoseMgDl, 93.3);
  assert.equal(result.timeToPeakMinutes, 60);
  assert.equal(result.glucoseAt60MinutesMgDl, 140);
  assert.equal(result.glucoseAt120MinutesMgDl, 100);
});
