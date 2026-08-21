import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { palette, radii, spacing } from '@/constants/design';
import {
  DEFAULT_MEAL_RESPONSE_CONFIG,
  getMealAnalysisWindow,
} from '@/services/meal-glucose-response';
import type { GlucoseReading, TargetRange } from '@/types/health';
import { formatReadingTime } from '@/utils/date';
import { AppText } from './ui/app-text';

const CHART_HEIGHT = 196;
const LEFT = 34;
const RIGHT = 12;
const TOP = 14;
const BOTTOM = 28;
const MINUTE_MS = 60_000;

interface MealGlucoseChartProps {
  readings: readonly GlucoseReading[];
  mealTimestamp: string;
  targetRange: TargetRange;
  baselineMgDl?: number;
}

interface ChartPoint {
  reading: GlucoseReading;
  x: number;
  y: number;
  timestamp: number;
}

export function MealGlucoseChart({
  readings,
  mealTimestamp,
  targetRange,
  baselineMgDl,
}: MealGlucoseChartProps) {
  const [width, setWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const window = getMealAnalysisWindow(mealTimestamp);
  const mealTime = Date.parse(mealTimestamp);
  const values = readings.map((reading) => reading.valueMgDl);
  const minimum = Math.min(targetRange.lowMgDl - 10, baselineMgDl ?? Infinity, ...values);
  const maximum = Math.max(targetRange.highMgDl + 10, baselineMgDl ?? -Infinity, ...values);
  const minY = Math.max(40, Math.floor(minimum / 10) * 10);
  const maxY = Math.ceil(maximum / 10) * 10;
  const plotWidth = Math.max(1, width - LEFT - RIGHT);
  const plotHeight = CHART_HEIGHT - TOP - BOTTOM;
  const startTime = window?.startDate.getTime() ?? mealTime;
  const endTime = window?.endDate.getTime() ?? mealTime + 1;
  const timeSpan = Math.max(1, endTime - startTime);

  const points = useMemo<ChartPoint[]>(
    () =>
      readings
        .map((reading) => ({ reading, timestamp: Date.parse(reading.timestamp) }))
        .filter(
          (point) =>
            Number.isFinite(point.timestamp) &&
            point.timestamp >= startTime &&
            point.timestamp <= endTime
        )
        .sort((first, second) => first.timestamp - second.timestamp)
        .map((point) => ({
          ...point,
          x: LEFT + ((point.timestamp - startTime) / timeSpan) * plotWidth,
          y:
            TOP +
            ((maxY - point.reading.valueMgDl) / Math.max(1, maxY - minY)) *
              plotHeight,
        })),
    [endTime, maxY, minY, plotHeight, plotWidth, readings, startTime, timeSpan]
  );

  const paths = useMemo(() => {
    const segments: ChartPoint[][] = [];
    points.forEach((point) => {
      const segment = segments.at(-1);
      const previous = segment?.at(-1);
      const gapMinutes = previous
        ? (point.timestamp - previous.timestamp) / MINUTE_MS
        : 0;
      if (!segment || gapMinutes > DEFAULT_MEAL_RESPONSE_CONFIG.goodQualityMaximumGapMinutes) {
        segments.push([point]);
      } else {
        segment.push(point);
      }
    });
    return segments
      .filter((segment) => segment.length > 1)
      .map((segment) =>
        segment
          .map(
            (point, index) =>
              `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
          )
          .join(' ')
      );
  }, [points]);

  const selectedPoint = points.find((point) => point.reading.id === selectedId);
  const mealX = LEFT + ((mealTime - startTime) / timeSpan) * plotWidth;
  const valueToY = (value: number) =>
    TOP + ((maxY - value) / Math.max(1, maxY - minY)) * plotHeight;
  const targetTop = valueToY(Math.min(maxY, targetRange.highMgDl));
  const targetBottom = valueToY(Math.max(minY, targetRange.lowMgDl));

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.container}>
      {width > 0 && window && points.length > 1 ? (
        <Pressable
          accessibilityRole="image"
          accessibilityLabel={`Observed meal glucose response chart with ${points.length} readings from 30 minutes before to 3 hours after the saved meal. Gaps in the line indicate missing readings.`}
          accessibilityHint="Tap the chart to inspect the nearest reading."
          onPress={(event) => {
            const targetX = event.nativeEvent.locationX;
            const nearest = points.reduce<ChartPoint | undefined>((current, point) =>
              !current || Math.abs(point.x - targetX) < Math.abs(current.x - targetX)
                ? point
                : current
            , undefined);
            setSelectedId(nearest?.reading.id ?? null);
          }}>
          <Svg width={width} height={CHART_HEIGHT}>
            <Rect
              x={LEFT}
              y={Math.min(targetTop, targetBottom)}
              width={plotWidth}
              height={Math.abs(targetBottom - targetTop)}
              fill={palette.greenSoft}
              rx={4}
            />
            <Line
              x1={mealX}
              x2={mealX}
              y1={TOP}
              y2={CHART_HEIGHT - BOTTOM}
              stroke={palette.purple}
              strokeWidth={2}
              strokeDasharray="4 4"
            />
            {baselineMgDl !== undefined ? (
              <Line
                x1={LEFT}
                x2={width - RIGHT}
                y1={valueToY(baselineMgDl)}
                y2={valueToY(baselineMgDl)}
                stroke={palette.cyan}
                strokeOpacity={0.7}
                strokeDasharray="5 5"
              />
            ) : null}
            {paths.map((path, index) => (
              <Path
                key={`${index}-${path}`}
                d={path}
                fill="none"
                stroke={palette.blue}
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {points.map((point) => (
              <Circle
                key={point.reading.id}
                cx={point.x}
                cy={point.y}
                r={2.25}
                fill={palette.blue}
              />
            ))}
            {selectedPoint ? (
              <G>
                <Line
                  x1={selectedPoint.x}
                  x2={selectedPoint.x}
                  y1={TOP}
                  y2={CHART_HEIGHT - BOTTOM}
                  stroke={palette.navy}
                  strokeOpacity={0.22}
                />
                <Circle
                  cx={selectedPoint.x}
                  cy={selectedPoint.y}
                  r={5}
                  fill={palette.blue}
                  stroke={palette.surface}
                  strokeWidth={2}
                />
              </G>
            ) : null}
            <SvgText x={LEFT} y={CHART_HEIGHT - 7} fontSize="10" fill={palette.textMuted}>
              −30
            </SvgText>
            <SvgText
              x={mealX}
              y={CHART_HEIGHT - 7}
              textAnchor="middle"
              fontSize="10"
              fill={palette.purple}>
              Meal
            </SvgText>
            <SvgText
              x={width - RIGHT}
              y={CHART_HEIGHT - 7}
              textAnchor="end"
              fontSize="10"
              fill={palette.textMuted}>
              +3h
            </SvgText>
          </Svg>
        </Pressable>
      ) : null}
      <View style={styles.captionRow}>
        <View style={styles.legend}>
          <View style={styles.mealSwatch} />
          <AppText variant="caption" color={palette.textMuted}>
            Meal time
          </AppText>
          {baselineMgDl !== undefined ? (
            <>
              <View style={styles.baselineSwatch} />
              <AppText variant="caption" color={palette.textMuted}>
                Estimated baseline
              </AppText>
            </>
          ) : null}
        </View>
        {selectedPoint ? (
          <AppText variant="caption" color={palette.navy}>
            {selectedPoint.reading.valueMgDl} mg/dL ·{' '}
            {formatReadingTime(selectedPoint.reading.timestamp)}
          </AppText>
        ) : (
          <AppText variant="caption" color={palette.textMuted}>
            Tap to inspect
          </AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: CHART_HEIGHT + 44,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  captionRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  mealSwatch: {
    width: 3,
    height: 12,
    borderRadius: 1,
    backgroundColor: palette.purple,
  },
  baselineSwatch: {
    width: 14,
    height: 2,
    backgroundColor: palette.cyan,
  },
});
