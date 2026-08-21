import assert from 'node:assert/strict';
import test from 'node:test';

import { hasUnprocessedTranscriptChanges } from '../services/voice-transcript-review';

test('detects a correction that must be reprocessed', () => {
  assert.equal(
    hasUnprocessedTranscriptChanges(
      'For lunch I had brown rice and salmon.',
      'For lunch I had brown rise and salmon.'
    ),
    true
  );
});

test('ignores surrounding whitespace after a transcript is processed', () => {
  assert.equal(
    hasUnprocessedTranscriptChanges(
      '  For lunch I had brown rice and salmon.  ',
      'For lunch I had brown rice and salmon.'
    ),
    false
  );
});
