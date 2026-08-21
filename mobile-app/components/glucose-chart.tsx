import { useCallback, useMemo, useRef, useState } from 'react';
import { Pill, Utensils } from 'lucide-react-native';
import type { GestureResponderEvent, PointerEvent } from 'react-native';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { palette, radii, spacing } from '@/constants/design';
import type {
  GlucoseReading,
  GlucoseReadingTimeRange,
  MealEntry,
  MedicationEntry,
  TargetRange,
} from '@/types/health';
import {
  aggregateGlucoseReadingsByInterval,
  assignTimelineMarkerLanes,
  glucoseChartPointIntervalLabel,
  nearestPointByX,
  positionTimestampedItemsInTimeRange,
} from '@/utils/chart-time';
import { formatChartAxisTime, formatChartInspectionTime } from '@/utils/date';
import { AppText } from './ui/app-text';

const CHART_HEIGHT = 218;
const LEFT = 34;
const RIGHT = 12;
const TOP = 16;
const BOTTOM = 30;
const POINT_RADIUS = 3;
const SELECTED_POINT_RADIUS = 6;

interface GlucoseChartProps {
  readings: readonly GlucoseReading[];
  timeRange: GlucoseReadingTimeRange;
  targetRange: TargetRange;
  meals: readonly MealEntry[];
  onMealPress: (meal: MealEntry) => void;
  medicationEntries: readonly MedicationEntry[];
  onMedicationPress: (entry: MedicationEntry) => void;
  pointIntervalMinutes?: number;
}

interface ChartPoint {
  reading: GlucoseReading;
  timestamp: number;
  x: number;
  y: number;
}

type TimelineMarker =
  | { kind: 'meal'; item: MealEntry; timestamp: number; x: number }
  | { kind: 'medication'; item: MedicationEntry; timestamp: number; x: number };

export function GlucoseChart({
  readings,
  timeRange,
  targetRange,
  meals,
  onMealPress,
  medicationEntries,
  onMedicationPress,
  pointIntervalMinutes,
}: GlucoseChartProps) {
  const [width, setWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const chartRef = useRef<View>(null);
  const chartPageXRef = useRef<number | null>(null);
  const rangeStart = Date.parse(timeRange.startTime);
  const rangeEnd = Date.parse(timeRange.endTime);
  const rangeDuration = Math.max(1, rangeEnd - rangeStart);
  const displayReadings = useMemo(
    () =>
      pointIntervalMinutes
        ? aggregateGlucoseReadingsByInterval(readings, pointIntervalMinutes, rangeStart)
        : readings,
    [pointIntervalMinutes, rangeStart, readings]
  );
  const timedReadings = useMemo(
    () =>
      positionTimestampedItemsInTimeRange(displayReadings, rangeStart, rangeEnd).map(
        ({ item, timestamp, position }) => ({ reading: item, timestamp, position })
      ),
    [displayReadings, rangeEnd, rangeStart]
  );
  const values = timedReadings.map((point) => point.reading.valueMgDl);
  const minimum = Math.min(targetRange.lowMgDl - 15, ...values);
  const maximum = Math.max(targetRange.highMgDl + 20, ...values);
  const minY = Math.max(40, Math.floor(minimum / 10) * 10);
  const maxY = Math.min(300, Math.ceil(maximum / 10) * 10);
  const plotWidth = Math.max(1, width - LEFT - RIGHT);
  const plotHeight = CHART_HEIGHT - TOP - BOTTOM;
  const timelineMarkers = useMemo(
    () => {
      const positionedMeals: TimelineMarker[] = positionTimestampedItemsInTimeRange(
        meals,
        rangeStart,
        rangeEnd
      ).map(
        ({ item, timestamp, position }) => ({
          kind: 'meal',
          item,
          timestamp,
          x: LEFT + position * plotWidth,
        })
      );
      const positionedMedications: TimelineMarker[] = positionTimestampedItemsInTimeRange(
        medicationEntries,
        rangeStart,
        rangeEnd
      ).map(
        ({ item, timestamp, position }) => ({
          kind: 'medication',
          item,
          timestamp,
          x: LEFT + position * plotWidth,
        })
      );
      return assignTimelineMarkerLanes(
        [...positionedMeals, ...positionedMedications].sort((first, second) => first.x - second.x),
        44,
      );
    },
    [meals, medicationEntries, plotWidth, rangeEnd, rangeStart]
  );

  const points = useMemo<ChartPoint[]>(
    () =>
      timedReadings.map(({ reading, timestamp, position }) => ({
        reading,
        timestamp,
        x: LEFT + position * plotWidth,
        y:
          TOP +
          ((maxY - reading.valueMgDl) / Math.max(1, maxY - minY)) * plotHeight,
      })),
    [maxY, minY, plotHeight, plotWidth, timedReadings]
  );

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
  const selectedPoint = points.find((point) => point.reading.id === selectedId) ?? null;
  const pointIntervalLabel = pointIntervalMinutes
    ? glucoseChartPointIntervalLabel(pointIntervalMinutes)
    : null;
  const markerSummary =
    timelineMarkers.length > 0
      ? ` and ${timelineMarkers.length} logged event ${timelineMarkers.length === 1 ? 'marker' : 'markers'}`
      : '';
  const hasMealMarkers = timelineMarkers.some((marker) => marker.kind === 'meal');
  const hasMedicationMarkers = timelineMarkers.some((marker) => marker.kind === 'medication');
  const middleTime = rangeStart + rangeDuration / 2;
  const selectNearestPoint = useCallback((targetX: number) => {
    const nearest = nearestPointByX(points, targetX);
    setSelectedId(nearest?.reading.id ?? null);
  }, [points]);
  const selectFromPageX = useCallback((pageX: number, fallbackX: number) => {
    const knownChartPageX = chartPageXRef.current;
    if (knownChartPageX !== null) {
      selectNearestPoint(pageX - knownChartPageX);
      return;
    }

    if (!chartRef.current) {
      selectNearestPoint(fallbackX);
      return;
    }

    chartRef.current.measure((_x, _y, _width, _height, chartPageX) => {
      chartPageXRef.current = chartPageX;
      selectNearestPoint(pageX - chartPageX);
    });
  }, [selectNearestPoint]);
  const selectFromTouch = useCallback((event: GestureResponderEvent) => {
    const fallbackX = event.nativeEvent.locationX;
    const pageX = event.nativeEvent.pageX;

    if (!Number.isFinite(pageX)) {
      selectNearestPoint(fallbackX);
      return;
    }

    selectFromPageX(pageX, fallbackX);
  }, [selectFromPageX, selectNearestPoint]);
  const selectFromPointer = useCallback((event: PointerEvent) => {
    selectFromPageX(event.nativeEvent.pageX, event.nativeEvent.offsetX);
  }, [selectFromPageX]);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          Math.abs(gestureState.dx) > 2 &&
          Math.abs(gestureState.dx) >= Math.abs(gestureState.dy),
        onPanResponderGrant: selectFromTouch,
        onPanResponderMove: selectFromTouch,
        onPanResponderTerminationRequest: (_event, gestureState) =>
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onShouldBlockNativeResponder: () => false,
      }),
    [selectFromTouch]
  );
  const selectedPointIndex = selectedPoint
    ? points.findIndex((point) => point.reading.id === selectedPoint.reading.id)
    : -1;
  const selectAdjacentPoint = (direction: -1 | 1) => {
    const fallbackIndex = direction === 1 ? 0 : points.length - 1;
    const nextIndex = Math.max(
      0,
      Math.min(
        points.length - 1,
        selectedPointIndex === -1 ? fallbackIndex : selectedPointIndex + direction
      )
    );
    setSelectedId(points[nextIndex]?.reading.id ?? null);
  };

  return (
    <View
      onLayout={(event) => {
        chartPageXRef.current = null;
        setWidth(event.nativeEvent.layout.width);
      }}
      style={styles.container}>
      {width > 0 && points.length > 1 ? (
        <View style={styles.chartArea}>
          <View
            ref={chartRef}
            {...panResponder.panHandlers}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`Glucose line chart with ${points.length} ${pointIntervalLabel ? `averaged points from populated ${pointIntervalLabel} intervals` : 'displayed readings'}${markerSummary}. Values range from ${Math.min(...values)} to ${Math.max(...values)} milligrams per deciliter.`}
            accessibilityHint="Touch and drag across the chart to inspect readings. Screen-reader users can adjust to the previous or next reading. Logged event markers are separate buttons."
            accessibilityValue={{
              text: selectedPoint
                ? `${selectedPoint.reading.valueMgDl} milligrams per deciliter at ${formatChartInspectionTime(selectedPoint.reading.timestamp, rangeDuration)}`
                : 'No reading selected',
            }}
            accessibilityActions={[
              { name: 'decrement', label: 'Previous reading' },
              { name: 'increment', label: 'Next reading' },
            ]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'decrement') selectAdjacentPoint(-1);
              if (event.nativeEvent.actionName === 'increment') selectAdjacentPoint(1);
            }}
            onPointerDown={selectFromPointer}>
            <Svg width={width} height={CHART_HEIGHT}>
            <Rect
              x={LEFT}
              y={TOP + ((maxY - targetRange.highMgDl) / (maxY - minY)) * plotHeight}
              width={plotWidth}
              height={
                ((targetRange.highMgDl - targetRange.lowMgDl) / (maxY - minY)) * plotHeight
              }
              fill={palette.greenSoft}
              rx={4}
            />
            {[targetRange.lowMgDl, targetRange.highMgDl].map((value) => {
              const y = TOP + ((maxY - value) / (maxY - minY)) * plotHeight;
              return (
                <G key={value}>
                  <Line
                    x1={LEFT}
                    x2={width - RIGHT}
                    y1={y}
                    y2={y}
                    stroke={palette.green}
                    strokeDasharray="4 5"
                    strokeOpacity={0.45}
                  />
                  <SvgText x={LEFT - 5} y={y + 4} textAnchor="end" fontSize="10" fill={palette.textMuted}>
                    {value}
                  </SvgText>
                </G>
              );
            })}
            {timelineMarkers.map((marker) => (
              <Line
                key={`${marker.kind}-line-${marker.item.id}`}
                x1={marker.x}
                x2={marker.x}
                y1={TOP + 22 + marker.lane * 28}
                y2={CHART_HEIGHT - BOTTOM}
                stroke={marker.kind === 'meal' ? palette.amber : palette.cyan}
                strokeDasharray="3 5"
                strokeOpacity={0.28}
              />
            ))}
            <Path d={path} fill="none" stroke={palette.blue} strokeWidth={3} strokeLinejoin="round" />
            {points.map((point) => (
              <Circle
                key={point.reading.id}
                cx={point.x}
                cy={point.y}
                r={POINT_RADIUS}
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
                  strokeOpacity={0.25}
                />
                <Circle cx={selectedPoint.x} cy={selectedPoint.y} r={SELECTED_POINT_RADIUS} fill={palette.blue} stroke="#FFFFFF" strokeWidth={2} />
              </G>
            ) : null}
            <SvgText x={LEFT} y={CHART_HEIGHT - 8} fontSize="10" fill={palette.textMuted}>
              {formatChartAxisTime(rangeStart, rangeDuration)}
            </SvgText>
            <SvgText x={LEFT + plotWidth / 2} y={CHART_HEIGHT - 8} textAnchor="middle" fontSize="10" fill={palette.textMuted}>
              {formatChartAxisTime(middleTime, rangeDuration)}
            </SvgText>
            <SvgText x={width - RIGHT} y={CHART_HEIGHT - 8} textAnchor="end" fontSize="10" fill={palette.textMuted}>
              {formatChartAxisTime(rangeEnd, rangeDuration)}
            </SvgText>
            </Svg>
          </View>
          {timelineMarkers.map((marker) => (
            <Pressable
              key={`${marker.kind}:${marker.item.id}`}
              testID={`glucose-chart-${marker.kind}-${marker.item.id}`}
              accessibilityRole="button"
              accessibilityLabel={marker.kind === 'meal'
                ? `Open meal ${marker.item.name}, logged at ${formatChartInspectionTime(marker.item.timestamp, rangeDuration)}`
                : `Open medication log ${marker.item.medicationName}, recorded at ${formatChartInspectionTime(marker.item.timestamp, rangeDuration)}`}
              accessibilityHint={marker.kind === 'meal'
                ? 'Open this saved meal.'
                : 'Open this user-recorded medication event.'}
              hitSlop={2}
              onPress={() => marker.kind === 'meal'
                ? onMealPress(marker.item)
                : onMedicationPress(marker.item)}
              style={({ pressed }) => [
                styles.timelineMarkerButton,
                {
                  left: Math.max(0, Math.min(width - 44, marker.x - 22)),
                  top: TOP - 10 + marker.lane * 28,
                },
                pressed && styles.timelineMarkerPressed,
              ]}>
              <View style={[
                styles.timelineMarkerBadge,
                marker.kind === 'meal'
                  ? styles.mealMarkerBadge
                  : styles.medicationMarkerBadge,
              ]}>
                {marker.kind === 'meal'
                  ? <Utensils size={16} color={palette.amber} strokeWidth={2.25} />
                  : <Pill size={16} color={palette.cyan} strokeWidth={2.25} />}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.captionRow}>
        <View style={styles.legend}>
          <View style={styles.legendSwatch} />
          <AppText variant="caption" color={palette.textMuted}>
            Display range {targetRange.lowMgDl}–{targetRange.highMgDl} mg/dL
          </AppText>
        </View>
        {selectedPoint ? (
          <AppText variant="caption" color={palette.navy}>
            {selectedPoint.reading.valueMgDl} mg/dL ·{' '}
            {formatChartInspectionTime(selectedPoint.reading.timestamp, rangeDuration)}
          </AppText>
        ) : (
          <AppText variant="caption" color={palette.textMuted}>
            Tap to inspect
          </AppText>
        )}
      </View>
      {timelineMarkers.length > 0 ? (
        <View style={styles.timelineLegend}>
          {hasMealMarkers ? (
            <View style={[styles.timelineLegendBadge, styles.mealMarkerBadge]}>
              <Utensils size={12} color={palette.amber} strokeWidth={2.25} />
            </View>
          ) : null}
          {hasMedicationMarkers ? (
            <View style={[styles.timelineLegendBadge, styles.medicationMarkerBadge]}>
              <Pill size={12} color={palette.cyan} strokeWidth={2.25} />
            </View>
          ) : null}
          <AppText variant="caption" color={palette.textMuted}>
            Logged context · tap an icon to open
          </AppText>
        </View>
      ) : null}
      {pointIntervalLabel ? (
        <AppText variant="caption" color={palette.textMuted}>
          Points average available readings within each {pointIntervalLabel} interval.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: CHART_HEIGHT + 30,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  chartArea: {
    height: CHART_HEIGHT,
    position: 'relative',
  },
  timelineMarkerButton: {
    position: 'absolute',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineMarkerPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  timelineMarkerBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  mealMarkerBadge: {
    backgroundColor: palette.amberSoft,
    borderColor: palette.amber,
  },
  medicationMarkerBadge: {
    backgroundColor: palette.cyanSoft,
    borderColor: palette.cyan,
  },
  captionRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendSwatch: {
    width: 12,
    height: 8,
    borderRadius: 2,
    backgroundColor: palette.greenSoft,
    borderWidth: 1,
    borderColor: palette.green,
  },
  timelineLegend: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timelineLegendBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
