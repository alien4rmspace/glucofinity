import type { GlucoseReading } from '@/types/health';

const MINUTE_MS = 60_000;

export function positionInTimeRange(
  timestamp: string | number | Date,
  startTime: number,
  endTime: number
): number | null {
  const timestampMs = new Date(timestamp).getTime();

  if (
    !Number.isFinite(timestampMs) ||
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    endTime <= startTime ||
    timestampMs < startTime ||
    timestampMs > endTime
  ) {
    return null;
  }

  return (timestampMs - startTime) / (endTime - startTime);
}

export interface PositionedTimestampedItem<T> {
  item: T;
  timestamp: number;
  position: number;
}

export function positionTimestampedItemsInTimeRange<T extends { timestamp: string }>(
  items: readonly T[],
  startTime: number,
  endTime: number
): PositionedTimestampedItem<T>[] {
  return items
    .map((item) => ({
      item,
      timestamp: Date.parse(item.timestamp),
      position: positionInTimeRange(item.timestamp, startTime, endTime),
    }))
    .filter(
      (positioned): positioned is typeof positioned & { position: number } =>
        positioned.position !== null
    )
    .sort((first, second) => first.timestamp - second.timestamp);
}

export function glucoseChartPointIntervalMinutes(rangeHours: number): number | undefined {
  if (rangeHours === 12) return 10;
  if (rangeHours === 7 * 24) return 60;
  if (rangeHours === 30 * 24) return 6 * 60;
  if (rangeHours === 365 * 24) return 7 * 24 * 60;
  return undefined;
}

export function glucoseChartPointIntervalLabel(intervalMinutes: number): string {
  if (intervalMinutes % (7 * 24 * 60) === 0) {
    const weeks = intervalMinutes / (7 * 24 * 60);
    return `${weeks}-week`;
  }
  if (intervalMinutes % (24 * 60) === 0) {
    const days = intervalMinutes / (24 * 60);
    return `${days}-day`;
  }
  if (intervalMinutes % 60 === 0) {
    const hours = intervalMinutes / 60;
    return `${hours}-hour`;
  }
  return `${intervalMinutes}-minute`;
}

export function aggregateGlucoseReadingsByInterval(
  readings: readonly GlucoseReading[],
  intervalMinutes: number,
  anchorTime: string | number | Date
): GlucoseReading[] {
  const intervalMs = intervalMinutes * MINUTE_MS;
  const anchorMs = new Date(anchorTime).getTime();

  if (!Number.isFinite(intervalMs) || intervalMs <= 0 || !Number.isFinite(anchorMs)) {
    return [...readings];
  }

  const buckets = new Map<number, { reading: GlucoseReading; timestamp: number }[]>();

  readings.forEach((reading) => {
    const timestamp = Date.parse(reading.timestamp);
    if (!Number.isFinite(timestamp)) return;

    const bucketIndex = Math.floor((timestamp - anchorMs) / intervalMs);
    const bucket = buckets.get(bucketIndex) ?? [];
    bucket.push({ reading, timestamp });
    buckets.set(bucketIndex, bucket);
  });

  return [...buckets.entries()]
    .sort(([firstIndex], [secondIndex]) => firstIndex - secondIndex)
    .map(([bucketIndex, bucket]) => {
      bucket.sort((first, second) => first.timestamp - second.timestamp);
      if (bucket.length === 1) return bucket[0].reading;

      const meanTimestamp =
        bucket.reduce((total, item) => total + item.timestamp, 0) / bucket.length;
      const representative = bucket.reduce((nearest, item) =>
        Math.abs(item.timestamp - meanTimestamp) < Math.abs(nearest.timestamp - meanTimestamp)
          ? item
          : nearest
      );
      const averageValue = Math.round(
        bucket.reduce((total, item) => total + item.reading.valueMgDl, 0) / bucket.length
      );

      return {
        ...representative.reading,
        id: `chart-average-${anchorMs}-${bucketIndex}`,
        valueMgDl: averageValue,
      };
    });
}

export function nearestPointByX<T extends { x: number }>(
  points: readonly T[],
  targetX: number
): T | undefined {
  return points.reduce<T | undefined>(
    (nearest, point) =>
      !nearest || Math.abs(point.x - targetX) < Math.abs(nearest.x - targetX)
        ? point
        : nearest,
    undefined
  );
}

export function assignTimelineMarkerLanes<T extends { x: number }>(
  markers: readonly T[],
  minimumGap: number,
  laneCount = 3
): (T & { lane: number })[] {
  const usableLaneCount = Math.max(1, Math.floor(laneCount));
  const lastXByLane = Array.from({ length: usableLaneCount }, () => -Infinity);

  return markers.map((marker) => {
    let lane = lastXByLane.findIndex((lastX) => marker.x - lastX >= minimumGap);
    if (lane === -1) {
      lane = lastXByLane.indexOf(Math.min(...lastXByLane));
    }
    lastXByLane[lane] = marker.x;
    return { ...marker, lane };
  });
}
