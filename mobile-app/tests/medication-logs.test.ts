import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  findPotentialDuplicateMedicationLog,
  formatMedicationDose,
  normalizeMedicationEntry,
  sortMedicationEntries,
} from '../services/medication-logs';
import type { MedicationEntry } from '../types/health';

const syntheticMedication: MedicationEntry = {
  id: 'medication-synthetic-1',
  timestamp: '2026-08-20T12:00:00.000Z',
  timezoneOffsetMinutes: 420,
  medicationName: 'Example medication',
  doseAmount: 500,
  doseUnit: 'mg',
  route: 'oral',
  status: 'taken',
  notes: 'Synthetic test entry',
  source: 'manual',
};

test('normalizes a complete user-recorded medication log', () => {
  const normalized = normalizeMedicationEntry({
    ...syntheticMedication,
    id: ' medication-synthetic-1 ',
    medicationName: ' Example medication ',
    notes: ' Synthetic test entry ',
  });

  assert.deepEqual(normalized, syntheticMedication);
  assert.equal(formatMedicationDose(syntheticMedication), '500 mg');
});

test('rejects incomplete or invalid medication dose records', () => {
  assert.equal(
    normalizeMedicationEntry({ ...syntheticMedication, medicationName: '  ' }),
    undefined,
  );
  assert.equal(
    normalizeMedicationEntry({ ...syntheticMedication, doseAmount: -1 }),
    undefined,
  );
  const { doseUnit: _doseUnit, ...missingDoseUnit } = syntheticMedication;
  assert.equal(normalizeMedicationEntry(missingDoseUnit), undefined);
  assert.equal(
    normalizeMedicationEntry({ ...syntheticMedication, source: 'prescription' }),
    undefined,
  );
});

test('sorts medication logs newest first and flags only nearby taken duplicates', () => {
  const older = { ...syntheticMedication, id: 'older', timestamp: '2026-08-20T11:00:00.000Z' };
  const nearby = { ...syntheticMedication, id: 'nearby', timestamp: '2026-08-20T12:10:00.000Z' };
  const later = { ...syntheticMedication, id: 'later', timestamp: '2026-08-20T13:00:00.000Z' };

  assert.deepEqual(
    sortMedicationEntries([older, later, nearby]).map(({ id }) => id),
    ['later', 'nearby', 'older'],
  );
  assert.equal(
    findPotentialDuplicateMedicationLog([nearby], syntheticMedication)?.id,
    'nearby',
  );
  assert.equal(findPotentialDuplicateMedicationLog([later], syntheticMedication), undefined);
  assert.equal(
    findPotentialDuplicateMedicationLog(
      [nearby],
      { ...syntheticMedication, status: 'skipped' },
    ),
    undefined,
  );
});

test('wires medication logs into persistence, reset, unified logs, and chart markers', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const registry = readFileSync(resolve(root, 'repositories/repository-registry.ts'), 'utf8');
  const provider = readFileSync(resolve(root, 'providers/app-data-provider.tsx'), 'utf8');
  const logs = readFileSync(resolve(root, 'app/(tabs)/logs.tsx'), 'utf8');
  const tabs = readFileSync(resolve(root, 'app/(tabs)/_layout.tsx'), 'utf8');
  const editor = readFileSync(resolve(root, 'app/medication/[id].tsx'), 'utf8');
  const chart = readFileSync(resolve(root, 'components/glucose-chart.tsx'), 'utf8');

  assert.match(registry, /medications: new AsyncStorageMedicationRepository/);
  assert.match(provider, /repositories\.medications\.replaceAll\(\[\]\)/);
  assert.match(logs, /Review daily context in one chronological timeline/);
  assert.match(logs, /kind: 'medication'/);
  assert.match(tabs, /name="logs"/);
  assert.doesNotMatch(tabs, /name="meals"/);
  assert.match(editor, /VoiceMedicationEntry/);
  assert.match(editor, /Add to session/);
  assert.match(editor, /Possible duplicate/);
  const voiceEntry = readFileSync(
    resolve(root, 'components/voice-medication-entry.tsx'),
    'utf8',
  );
  assert.match(voiceEntry, /cancelable=\{false\}/);
  assert.match(voiceEntry, /pressRetentionOffset=\{1000\}/);
  assert.match(voiceEntry, /extractMedication/);
  assert.match(voiceEntry, /onApply\(extraction\)/);
  assert.match(voiceEntry, /Medication fields filled/);
  assert.doesNotMatch(voiceEntry, /Use in editable form/);
  assert.match(editor, /setMedicationName\(draft\.medicationName\)/);
  assert.match(editor, /setDoseAmount\(String\(draft\.doseAmount\)\)/);
  assert.match(editor, /setRoute\(draft\.route \?\? 'not-recorded'\)/);
  assert.match(chart, /glucose-chart-\$\{marker\.kind\}/);
  assert.match(chart, /Open medication log/);
});
