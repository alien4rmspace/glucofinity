import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicScreenSources = [
  'app/(tabs)/index.tsx',
  'app/(tabs)/insights.tsx',
  'app/(tabs)/logs.tsx',
  'app/(tabs)/settings.tsx',
  'app/(tabs)/trends.tsx',
  'app/meal/[id].tsx',
  'app/medication/[id].tsx',
  'app/product-scan.tsx',
  'components/glucose-chart.tsx',
].map((path) => readFileSync(resolve(repositoryRoot, path), 'utf8')).join('\n');

test('public screens omit development and simulated-feature advisories', () => {
  assert.doesNotMatch(publicScreenSources, /Educational prototype/i);
  assert.doesNotMatch(publicScreenSources, /Simulated insight engine/i);
  assert.doesNotMatch(publicScreenSources, /Run simulated nutrition estimate/i);
  assert.doesNotMatch(publicScreenSources, /prototype range/i);
  assert.doesNotMatch(publicScreenSources, /\bMVP\b/);
});

test('public settings retain safety, privacy, and fictional sample labels', () => {
  assert.match(publicScreenSources, /Medical disclaimer/);
  assert.match(publicScreenSources, /not copied to AsyncStorage or uploaded by GlucoFinity/);
  assert.match(publicScreenSources, /Use fictional sample data/);
});
