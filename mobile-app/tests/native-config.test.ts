import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

interface PluginOptions {
  cameraPermission?: string | false;
  microphonePermission?: string | false;
  recordAudioAndroid?: boolean;
  NSHealthShareUsageDescription?: string;
  NSHealthUpdateUsageDescription?: string;
}

interface ExpoConfigShape {
  expo: {
    ios?: {
      infoPlist?: Record<string, unknown>;
    };
    android?: {
      blockedPermissions?: string[];
    };
    plugins?: (string | [string, PluginOptions])[];
  };
}

const config = JSON.parse(
  readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../app.json'),
    'utf8'
  )
) as ExpoConfigShape;

function pluginOptions(name: string): PluginOptions | undefined {
  const entry = config.expo.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === name
  );
  return Array.isArray(entry) ? entry[1] : undefined;
}

test('iOS microphone and speech purpose strings are configured', () => {
  assert.equal(
    typeof config.expo.ios?.infoPlist?.NSMicrophoneUsageDescription,
    'string'
  );
  assert.equal(
    typeof config.expo.ios?.infoPlist?.NSSpeechRecognitionUsageDescription,
    'string'
  );
});

test('native plugins preserve the iOS microphone purpose string', () => {
  const imagePicker = pluginOptions('expo-image-picker');
  const camera = pluginOptions('expo-camera');
  const audio = pluginOptions('expo-audio');

  assert.equal(typeof imagePicker?.microphonePermission, 'string');
  assert.equal(imagePicker?.microphonePermission, audio?.microphonePermission);
  assert.equal(camera?.microphonePermission, audio?.microphonePermission);
});

test('camera plugins explain meal photos and on-device barcode scanning consistently', () => {
  const imagePicker = pluginOptions('expo-image-picker');
  const camera = pluginOptions('expo-camera');

  assert.equal(imagePicker?.cameraPermission, camera?.cameraPermission);
  assert.match(String(camera?.cameraPermission), /barcode/i);
  assert.match(String(camera?.cameraPermission), /processed on this device/i);
  assert.equal(camera?.recordAudioAndroid, false);
});

test('Android recording remains disabled while voice entry is iOS-only', () => {
  assert.equal(pluginOptions('expo-audio')?.recordAudioAndroid, false);
  assert.ok(
    config.expo.android?.blockedPermissions?.includes(
      'android.permission.RECORD_AUDIO'
    )
  );
});

test('HealthKit purpose strings cover the read-only fitness scope and remain consistent', () => {
  const healthKit = pluginOptions('@kingstinct/react-native-healthkit');
  const shareDescription = config.expo.ios?.infoPlist
    ?.NSHealthShareUsageDescription;
  const updateDescription = config.expo.ios?.infoPlist
    ?.NSHealthUpdateUsageDescription;

  assert.equal(typeof shareDescription, 'string');
  assert.equal(shareDescription, updateDescription);
  assert.equal(shareDescription, healthKit?.NSHealthShareUsageDescription);
  assert.equal(updateDescription, healthKit?.NSHealthUpdateUsageDescription);
  assert.match(String(shareDescription), /step count/i);
  assert.match(String(shareDescription), /active energy/i);
  assert.match(String(shareDescription), /workout/i);
  assert.match(String(shareDescription), /does not add or change/i);
});
