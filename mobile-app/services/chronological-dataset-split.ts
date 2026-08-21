export interface TimestampedExample {
  occurredAt: string;
}

export interface ChronologicalSplit<T> {
  training: T[];
  validation: T[];
  testing: T[];
}

export interface ChronologicalSplitRatios {
  training: number;
  validation: number;
  testing: number;
}

export const DEFAULT_CHRONOLOGICAL_SPLIT: Readonly<ChronologicalSplitRatios> = {
  training: 0.7,
  validation: 0.15,
  testing: 0.15,
};

export function chronologicalDatasetSplit<T extends TimestampedExample>(
  examples: readonly T[],
  ratios: ChronologicalSplitRatios = DEFAULT_CHRONOLOGICAL_SPLIT
): ChronologicalSplit<T> {
  const ratioTotal = ratios.training + ratios.validation + ratios.testing;
  if (
    ratios.training <= 0 ||
    ratios.validation <= 0 ||
    ratios.testing <= 0 ||
    Math.abs(ratioTotal - 1) > 1e-9
  ) {
    throw new Error('Chronological split ratios must be positive and sum to 1.');
  }
  if (examples.length < 3) {
    throw new Error('At least three examples are required for chronological splitting.');
  }
  const sorted = [...examples].sort((first, second) => {
    const firstTime = Date.parse(first.occurredAt);
    const secondTime = Date.parse(second.occurredAt);
    if (!Number.isFinite(firstTime) || !Number.isFinite(secondTime)) {
      throw new Error('Every training example must have a valid occurredAt timestamp.');
    }
    return firstTime - secondTime;
  });
  const trainingEnd = Math.min(
    sorted.length - 2,
    Math.max(1, Math.floor(sorted.length * ratios.training))
  );
  const validationSize = Math.max(1, Math.floor(sorted.length * ratios.validation));
  const validationEnd = Math.min(sorted.length - 1, trainingEnd + validationSize);
  return {
    training: sorted.slice(0, trainingEnd),
    validation: sorted.slice(trainingEnd, validationEnd),
    testing: sorted.slice(validationEnd),
  };
}
