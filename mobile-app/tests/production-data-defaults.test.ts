import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultSettings } from '@/constants/design';
import {
  normalizeStoredSettings,
  serializeSettings,
} from '@/repositories/settings-migration';
import {
  MockGlucoseRepository,
  mockGlucoseSampleIntervalMinutes,
} from '@/repositories/mock-glucose-repository';
import { withoutLegacySeededMeals } from '@/services/legacy-demo-data';
import type { MealEntry } from '@/types/health';
import { targetRangeForDisplayPreset } from '@/utils/glucose-display-range';

test('new installs start without a glucose source', () => {
  assert.equal(defaultSettings.glucoseDataSource, 'none');
  assert.equal(defaultSettings.glucoseDisplayRangePreset, 'custom');
});

test('older inherited mock settings migrate to no active source', () => {
  const settings = normalizeStoredSettings({
    glucoseDataSource: 'mock',
    targetRange: { lowMgDl: 80, highMgDl: 170 },
  });

  assert.equal(settings.glucoseDataSource, 'none');
  assert.deepEqual(settings.targetRange, { lowMgDl: 80, highMgDl: 170 });
  assert.equal(settings.glucoseDisplayRangePreset, 'custom');
});

test('an older native health selection survives the migration', () => {
  assert.equal(
    normalizeStoredSettings({ glucoseDataSource: 'healthkit' }).glucoseDataSource,
    'healthkit'
  );
});

test('an explicit current-version demo selection remains active', () => {
  const stored = serializeSettings({
    ...defaultSettings,
    glucoseDataSource: 'mock',
  });

  assert.equal(normalizeStoredSettings(stored).glucoseDataSource, 'mock');
});

test('the previous production storage version keeps an explicit demo selection', () => {
  assert.equal(
    normalizeStoredSettings({ storageVersion: 2, glucoseDataSource: 'mock' })
      .glucoseDataSource,
    'mock'
  );
});

test('display presets map to their intended ranges and persist explicit selection', () => {
  assert.deepEqual(targetRangeForDisplayPreset('diabetes'), {
    lowMgDl: 70,
    highMgDl: 180,
  });
  assert.deepEqual(targetRangeForDisplayPreset('prediabetes-or-no-diabetes'), {
    lowMgDl: 70,
    highMgDl: 140,
  });
  assert.equal(targetRangeForDisplayPreset('custom'), null);

  const stored = serializeSettings({
    ...defaultSettings,
    glucoseDisplayRangePreset: 'prediabetes-or-no-diabetes',
    targetRange: { lowMgDl: 70, highMgDl: 140 },
  });
  const restored = normalizeStoredSettings(stored);

  assert.equal(restored.glucoseDisplayRangePreset, 'prediabetes-or-no-diabetes');
  assert.deepEqual(restored.targetRange, { lowMgDl: 70, highMgDl: 140 });
});

test('fictional readings use bounded sampling intervals for long display ranges', () => {
  const hourMs = 60 * 60 * 1000;

  assert.equal(mockGlucoseSampleIntervalMinutes(36 * hourMs), 5);
  assert.equal(mockGlucoseSampleIntervalMinutes(7.5 * 24 * hourMs), 60);
  assert.equal(mockGlucoseSampleIntervalMinutes(30.5 * 24 * hourMs), 6 * 60);
  assert.equal(mockGlucoseSampleIntervalMinutes(365.5 * 24 * hourMs), 7 * 24 * 60);
});

test('the fictional one-year query stays bounded while covering the complete window', async () => {
  const repository = new MockGlucoseRepository();
  const endDate = new Date('2026-08-19T17:05:00.000Z');
  const startDate = new Date('2025-08-19T05:05:00.000Z');
  const readings = await repository.getReadings(startDate, endDate);
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  assert.ok(readings.length >= 52 && readings.length <= 54);
  assert.equal(readings.at(-1)?.timestamp, endDate.toISOString());
  assert.ok(Date.parse(readings[0].timestamp) - startDate.getTime() < weekMs);
});

test('legacy seeded meals are removed without deleting user meals', () => {
  const meals: MealEntry[] = [
    {
      id: 'mock-breakfast',
      timestamp: '2026-08-13T15:00:00.000Z',
      name: 'Greek yogurt bowl',
    },
    {
      id: 'user-meal-1',
      timestamp: '2026-08-13T19:00:00.000Z',
      name: 'Brown rice and salmon',
    },
  ];

  assert.deepEqual(withoutLegacySeededMeals(meals), [meals[1]]);
});
