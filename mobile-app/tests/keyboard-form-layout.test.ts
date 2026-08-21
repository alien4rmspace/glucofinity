import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function source(relativePath: string): string {
  return readFileSync(path.resolve(relativePath), 'utf8');
}

test('keeps modal form actions reachable while the keyboard is open', () => {
  for (const relativePath of [
    'app/meal/[id].tsx',
    'app/check-in/[id].tsx',
    'app/medication/[id].tsx',
  ]) {
    const screen = source(relativePath);
    assert.match(screen, /<KeyboardAvoidingView/);
    assert.match(screen, /behavior=\{Platform\.OS === 'ios' \? 'padding' : undefined\}/);
    assert.match(screen, /<ScrollView\s+style=\{styles\.flex\}/);
    assert.match(screen, /keyboardDismissMode=\{Platform\.OS === 'ios' \? 'interactive' : 'on-drag'\}/);
    assert.match(screen, /keyboardShouldPersistTaps="handled"/);
    assert.match(screen, /<View style=\{styles\.footer\}>/);
  }
});

test('uses the keyboard-safe scroll pattern in settings and barcode entry', () => {
  const sharedScreen = source('components/ui/screen.tsx');
  const scanner = source('app/product-scan.tsx');

  assert.match(sharedScreen, /<KeyboardAvoidingView/);
  assert.match(sharedScreen, /<ScrollView\s+style=\{styles\.flex\}/);
  assert.match(sharedScreen, /keyboardDismissMode=/);
  assert.match(scanner, /<ScrollView\s+style=\{styles\.flex\}/);
  assert.match(scanner, /keyboardDismissMode=/);
});

test('provides a shared iOS Done control for every FormField', () => {
  const field = source('components/ui/form-field.tsx');
  const accessory = source('components/ui/form-keyboard-accessory.tsx');
  const root = source('app/_layout.tsx');

  assert.match(field, /FORM_KEYBOARD_ACCESSORY_ID/);
  assert.match(field, /inputAccessoryViewID=/);
  assert.match(accessory, /<InputAccessoryView nativeID=\{FORM_KEYBOARD_ACCESSORY_ID\}>/);
  assert.match(accessory, /accessibilityLabel="Dismiss keyboard"/);
  assert.match(accessory, /onPress=\{Keyboard\.dismiss\}/);
  assert.match(root, /<FormKeyboardAccessory \/>/);
});

test('configures Android to resize the app above the software keyboard', () => {
  const config = JSON.parse(source('app.json')) as {
    expo?: { android?: { softwareKeyboardLayoutMode?: string } };
  };

  assert.equal(config.expo?.android?.softwareKeyboardLayoutMode, 'resize');
});
