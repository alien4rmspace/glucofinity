import type { InsightComparisonGroup, InsightEvidence } from '@/types/ai';

export interface GroupedObservation {
  occurredAt: string;
  value: number;
}

export interface PatternComparison {
  id: string;
  title: string;
  description: string;
  evidence: InsightEvidence;
  generatedAt: string;
}

export interface CompareObservationGroupsInput {
  id: string;
  title: string;
  firstLabel: string;
  first: readonly GroupedObservation[];
  secondLabel: string;
  second: readonly GroupedObservation[];
  unit: string;
  minimumGroupSize?: number;
  generatedAt: string;
}

function validObservations(
  observations: readonly GroupedObservation[]
): GroupedObservation[] {
  return observations
    .filter(
      (observation) =>
        Number.isFinite(observation.value) &&
        Number.isFinite(Date.parse(observation.occurredAt))
    )
    .sort((first, second) => Date.parse(first.occurredAt) - Date.parse(second.occurredAt));
}

function group(
  label: string,
  observations: readonly GroupedObservation[],
  unit: string
): InsightComparisonGroup {
  return {
    label,
    sampleSize: observations.length,
    meanValue:
      Math.round(
        (observations.reduce((sum, observation) => sum + observation.value, 0) /
          observations.length) *
          10
      ) / 10,
    unit,
  };
}

export function compareObservationGroups({
  id,
  title,
  firstLabel,
  first,
  secondLabel,
  second,
  unit,
  minimumGroupSize = 3,
  generatedAt,
}: CompareObservationGroupsInput): PatternComparison | null {
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new Error('Pattern generatedAt must be a valid timestamp.');
  }
  if (!Number.isInteger(minimumGroupSize) || minimumGroupSize < 2) {
    throw new Error('Pattern minimumGroupSize must be an integer of at least 2.');
  }
  const firstValid = validObservations(first);
  const secondValid = validObservations(second);
  if (firstValid.length < minimumGroupSize || secondValid.length < minimumGroupSize) {
    return null;
  }
  const firstGroup = group(firstLabel, firstValid, unit);
  const secondGroup = group(secondLabel, secondValid, unit);
  const difference = Math.round((firstGroup.meanValue - secondGroup.meanValue) * 10) / 10;
  const all = [...firstValid, ...secondValid].sort(
    (left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt)
  );
  return {
    id,
    title,
    description: `${firstLabel} were associated with an average value ${Math.abs(difference)} ${unit} ${difference >= 0 ? 'higher' : 'lower'} than ${secondLabel}.`,
    evidence: {
      sampleSize: all.length,
      dateRange: {
        start: new Date(all[0].occurredAt).toISOString(),
        end: new Date(all.at(-1)!.occurredAt).toISOString(),
      },
      metricDifference: difference,
      comparisonGroups: [firstGroup, secondGroup],
    },
    generatedAt: new Date(generatedAt).toISOString(),
  };
}
