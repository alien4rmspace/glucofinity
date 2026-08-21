import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TemplateInsightLanguageProvider,
  buildEvidenceOnlyExplanationInput,
} from '../services/insight-language-provider';
import { compareObservationGroups } from '../services/pattern-discovery';

const first = [1, 2, 3].map((day) => ({
  occurredAt: `2026-08-0${day}T12:00:00.000Z`,
  value: 130 + day,
}));
const second = [4, 5, 6].map((day) => ({
  occurredAt: `2026-08-0${day}T12:00:00.000Z`,
  value: 110 + day,
}));

test('discovers only sufficiently supported associative comparisons', () => {
  const comparison = compareObservationGroups({
    id: 'meal-comparison',
    title: 'Observed group comparison',
    firstLabel: 'Logged meals with feature A',
    first,
    secondLabel: 'Logged meals without feature A',
    second,
    unit: 'mg/dL',
    generatedAt: '2026-08-11T12:00:00.000Z',
  });

  assert.ok(comparison);
  assert.equal(comparison.evidence.sampleSize, 6);
  assert.equal(comparison.evidence.comparisonGroups?.[0].sampleSize, 3);
  assert.match(comparison.description, /were associated with/);

  assert.equal(
    compareObservationGroups({
      id: 'too-small',
      title: 'Too small',
      firstLabel: 'First',
      first: first.slice(0, 2),
      secondLabel: 'Second',
      second,
      unit: 'mg/dL',
      generatedAt: '2026-08-11T12:00:00.000Z',
    }),
    null
  );
});

test('keeps the language layer bounded to structured evidence', async () => {
  assert.throws(() =>
    buildEvidenceOnlyExplanationInput({ question: 'What happened?', insights: [] })
  );

  const comparison = compareObservationGroups({
    id: 'supported',
    title: 'Supported comparison',
    firstLabel: 'First group',
    first,
    secondLabel: 'Second group',
    second,
    unit: 'mg/dL',
    generatedAt: '2026-08-11T12:00:00.000Z',
  })!;
  const provider = new TemplateInsightLanguageProvider(
    () => new Date('2026-08-11T13:00:00.000Z')
  );
  const explanation = await provider.explain({
    question: 'What was observed?',
    insights: [{ ...comparison, type: 'comparison' }],
  });

  assert.deepEqual(explanation.insightIds, ['supported']);
  assert.match(explanation.text, /recorded data/);
});
