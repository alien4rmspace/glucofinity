import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MedicationTranscriptExtractionError,
  buildMedicationTranscriptMessages,
  detectMedicationEventStatus,
  extractGroundedMedicationFromTranscript,
  parseMedicationTranscriptExtraction,
  refineMedicationTranscript,
} from '../services/medication-transcript-extraction';

const referenceDate = new Date(2026, 7, 20, 12, 0, 0);
const takenTranscript =
  'I took 500 milligrams of metformin by mouth at 8 this morning.';

test('builds a medication-only extraction prompt without dosing advice', () => {
  const messages = buildMedicationTranscriptMessages(takenTranscript);

  assert.equal(messages.length, 2);
  assert.match(messages[0].content, /Never infer a dose/);
  assert.match(messages[0].content, /Do not provide instructions/);
  assert.match(messages[1].content, /metformin/);
});

test('extracts only explicit completed-event medication details', () => {
  const result = parseMedicationTranscriptExtraction(
    JSON.stringify({
      medicationName: 'metformin',
      status: 'taken',
      doseAmount: 500,
      doseUnit: 'mg',
      route: 'oral',
      timeExpression: 'at 8 this morning',
    }),
    takenTranscript,
    referenceDate,
  );

  assert.equal(result.medicationName, 'metformin');
  assert.equal(result.status, 'taken');
  assert.equal(result.doseAmount, 500);
  assert.equal(result.doseUnit, 'mg');
  assert.equal(result.route, 'oral');
  assert.equal(new Date(result.occurredAt ?? '').getHours(), 8);
  assert.equal(new Date(result.occurredAt ?? '').getDate(), 20);
});

test('fills medication and compact dose fields from a natural contraction', () => {
  const result = extractGroundedMedicationFromTranscript(
    "I've taken 500mg of metformin.",
    referenceDate,
  );

  assert.deepEqual(result, {
    medicationName: 'metformin',
    status: 'taken',
    doseAmount: 500,
    doseUnit: 'mg',
  });
});

test('records a missed event without inventing a dose, route, or time', () => {
  const result = extractGroundedMedicationFromTranscript(
    'I forgot metformin.',
    referenceDate,
  );

  assert.deepEqual(result, {
    medicationName: 'metformin',
    status: 'missed',
  });
});

test('does not turn medication instructions or future plans into completed events', () => {
  assert.equal(
    detectMedicationEventStatus('I am supposed to take metformin tonight.'),
    undefined,
  );
  assert.deepEqual(
    extractGroundedMedicationFromTranscript(
      'I will take metformin at 8 tonight.',
      referenceDate,
    ),
    {},
  );
  assert.equal(
    detectMedicationEventStatus('I had to take metformin every day.'),
    undefined,
  );
  assert.equal(
    detectMedicationEventStatus('I used to take metformin.'),
    undefined,
  );
});

test('keeps spoken-number doses and yesterday timestamps deterministic', () => {
  const result = extractGroundedMedicationFromTranscript(
    'I injected ten units of insulin yesterday at 8:30 PM.',
    referenceDate,
  );
  const occurredAt = new Date(result.occurredAt ?? '');

  assert.equal(result.medicationName, 'insulin');
  assert.equal(result.doseAmount, 10);
  assert.equal(result.doseUnit, 'units');
  assert.equal(result.route, 'injection');
  assert.equal(occurredAt.getDate(), 19);
  assert.equal(occurredAt.getHours(), 20);
  assert.equal(occurredAt.getMinutes(), 30);
});

test('does not apply a contradictory future clock time to a completed event', () => {
  const result = extractGroundedMedicationFromTranscript(
    'I took metformin at 8 PM.',
    referenceDate,
  );

  assert.equal(result.medicationName, 'metformin');
  assert.equal(result.status, 'taken');
  assert.equal(result.occurredAt, undefined);
});

test('rejects a hallucinated medication name or unsupported dose', () => {
  assert.throws(
    () => parseMedicationTranscriptExtraction(
      '{"medicationName":"insulin","status":"taken","doseAmount":500,"doseUnit":"mg","route":"oral","timeExpression":null}',
      takenTranscript,
      referenceDate,
    ),
    MedicationTranscriptExtractionError,
  );
  assert.throws(
    () => parseMedicationTranscriptExtraction(
      '{"medicationName":"metformin","status":"taken","doseAmount":1000,"doseUnit":"mg","route":"oral","timeExpression":null}',
      takenTranscript,
      referenceDate,
    ),
    MedicationTranscriptExtractionError,
  );
});

test('refines punctuation without changing medication content', () => {
  assert.equal(
    refineMedicationTranscript('i missed metformin'),
    'I missed metformin.',
  );
});
