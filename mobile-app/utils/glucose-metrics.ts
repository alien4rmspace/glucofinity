import type {
  GlucoseMinMax,
  GlucoseReading,
  GlucoseStatus,
  HourlyGlucoseSummary,
  LargestRise,
  TargetRange,
} from '@/types/health';

export function averageGlucose(readings: readonly GlucoseReading[]): number | null {
  if (readings.length === 0) return null;
  return readings.reduce((sum, reading) => sum + reading.valueMgDl, 0) / readings.length;
}

export function glucoseMinMax(readings: readonly GlucoseReading[]): GlucoseMinMax | null {
  if (readings.length === 0) return null;
  return readings.reduce<GlucoseMinMax>(
    (result, reading) => ({
      minimum: Math.min(result.minimum, reading.valueMgDl),
      maximum: Math.max(result.maximum, reading.valueMgDl),
    }),
    { minimum: readings[0].valueMgDl, maximum: readings[0].valueMgDl }
  );
}

export function timeInRangePercentage(
  readings: readonly GlucoseReading[],
  targetRange: TargetRange
): number | null {
  if (readings.length === 0) return null;
  const inRangeCount = readings.filter(
    (reading) =>
      reading.valueMgDl >= targetRange.lowMgDl && reading.valueMgDl <= targetRange.highMgDl
  ).length;
  return (inRangeCount / readings.length) * 100;
}

export function glucoseStandardDeviation(readings: readonly GlucoseReading[]): number | null {
  const average = averageGlucose(readings);
  if (average === null) return null;
  const variance =
    readings.reduce((sum, reading) => sum + (reading.valueMgDl - average) ** 2, 0) /
    readings.length;
  return Math.sqrt(variance);
}

export function classifyGlucoseStatus(valueMgDl: number, targetRange: TargetRange): GlucoseStatus {
  if (valueMgDl < targetRange.lowMgDl) return 'below-range';
  if (valueMgDl <= targetRange.highMgDl) return 'in-range';
  if (valueMgDl <= 250) return 'elevated';
  return 'very-high';
}

export function largestObservedRise(
  readings: readonly GlucoseReading[],
  windowMinutes = 60
): LargestRise | null {
  if (readings.length < 2) return null;
  const sorted = [...readings].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const targetWindowMs = windowMinutes * 60 * 1000;
  let result: LargestRise | null = null;

  for (let index = 1; index < sorted.length; index += 1) {
    const currentTime = new Date(sorted[index].timestamp).getTime();
    let closestPrevious: GlucoseReading | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
      const previous = sorted[previousIndex];
      const elapsed = currentTime - new Date(previous.timestamp).getTime();
      const distance = Math.abs(elapsed - targetWindowMs);
      if (elapsed > 0 && distance < closestDistance) {
        closestPrevious = previous;
        closestDistance = distance;
      }
    }

    if (!closestPrevious || closestDistance > 15 * 60 * 1000) continue;
    const riseMgDl = sorted[index].valueMgDl - closestPrevious.valueMgDl;
    if (!result || riseMgDl > result.riseMgDl) {
      result = { riseMgDl, from: closestPrevious, to: sorted[index] };
    }
  }

  return result;
}

export function hourlyGlucoseSummary(
  readings: readonly GlucoseReading[]
): HourlyGlucoseSummary[] {
  const groups = new Map<number, GlucoseReading[]>();
  readings.forEach((reading) => {
    const hour = new Date(reading.timestamp).getHours();
    groups.set(hour, [...(groups.get(hour) ?? []), reading]);
  });

  return [...groups.entries()]
    .sort(([firstHour], [secondHour]) => firstHour - secondHour)
    .map(([hour, group]) => ({
      hour,
      averageMgDl: averageGlucose(group) ?? 0,
      readingCount: group.length,
    }));
}

export function trendDescription(trend: GlucoseReading['trend']): string {
  const labels: Record<GlucoseReading['trend'], string> = {
    'rapidly-rising': 'Rising quickly',
    rising: 'Rising',
    steady: 'Steady',
    falling: 'Falling',
    'rapidly-falling': 'Falling quickly',
  };
  return labels[trend];
}
