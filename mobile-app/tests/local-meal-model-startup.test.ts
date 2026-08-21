import assert from 'node:assert/strict';
import test from 'node:test';

import { warmLocalMealModelCache } from '../services/local-meal-model-startup';
import type { LocalMealLanguageProvider } from '../services/local-meal-language-provider.types';

function mockProvider(overrides: Partial<LocalMealLanguageProvider> = {}) {
  let prefetchCount = 0;
  let releaseCount = 0;
  const provider: LocalMealLanguageProvider = {
    providerId: 'test-provider',
    modelId: 'test-model',
    async getAccessState() {
      return { availability: 'available', message: 'Available for testing.' };
    },
    async prefetch(onProgress) {
      prefetchCount += 1;
      onProgress?.(0.5);
    },
    async prepare() {},
    async extractMeal() {
      return { mealName: '', foods: [] };
    },
    async extractMedication() {
      return {};
    },
    release() {
      releaseCount += 1;
    },
    ...overrides,
  };
  return {
    provider,
    counts: () => ({ prefetchCount, releaseCount }),
  };
}

test('prefetches an available local model without loading its runtime', async () => {
  const { provider, counts } = mockProvider();
  const progress: number[] = [];
  const result = await warmLocalMealModelCache(provider, {
    onProgress: (value) => progress.push(value),
  });

  assert.equal(result.status, 'ready');
  assert.deepEqual(counts(), { prefetchCount: 1, releaseCount: 0 });
  assert.deepEqual(progress, [0.5, 1]);
});

test('skips preparation on unsupported platforms', async () => {
  const { provider, counts } = mockProvider({
    async getAccessState() {
      return { availability: 'unsupported-platform', message: 'iOS only.' };
    },
  });
  const result = await warmLocalMealModelCache(provider);

  assert.equal(result.status, 'unavailable');
  assert.deepEqual(counts(), { prefetchCount: 0, releaseCount: 0 });
});

test('reports a failed background download', async () => {
  const { provider, counts } = mockProvider({
    async prefetch() {
      throw new Error('Download interrupted.');
    },
  });
  const result = await warmLocalMealModelCache(provider);

  assert.equal(result.status, 'error');
  assert.equal(result.error, 'Download interrupted.');
  assert.deepEqual(counts(), { prefetchCount: 0, releaseCount: 0 });
});
