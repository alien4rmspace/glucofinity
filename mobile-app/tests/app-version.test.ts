import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAppVersionInfo } from '@/services/app-version-format';

test('uses installed native application version and build values', () => {
  const info = resolveAppVersionInfo({
    nativeVersion: '1.2.0',
    nativeBuild: '11',
    configuredVersion: '1.1.0',
    configuredBuild: '4',
  });

  assert.deepEqual(info, { version: '1.2.0', build: '11' });
});

test('falls back to configured values outside an installed native binary', () => {
  const info = resolveAppVersionInfo({
    nativeVersion: null,
    nativeBuild: null,
    configuredVersion: '1.2.0',
    configuredBuild: 4,
  });

  assert.deepEqual(info, { version: '1.2.0', build: '4' });
});
