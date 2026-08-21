import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { palette, spacing } from '@/constants/design';
import type { HourlyGlucoseSummary } from '@/types/health';
import { AppText } from './ui/app-text';

const HEIGHT = 190;

export function HourlyChart({ data }: { data: readonly HourlyGlucoseSummary[] }) {
  const [width, setWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const left = 32;
  const right = 8;
  const top = 16;
  const bottom = 28;
  const plotWidth = Math.max(1, width - left - right);
  const plotHeight = HEIGHT - top - bottom;
  const maximum = Math.max(200, ...data.map((item) => item.averageMgDl + 10));
  const selected = selectedIndex === null ? null : data[selectedIndex];

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 && data.length > 0 ? (
        <Pressable
          accessibilityRole="image"
          accessibilityLabel={`Hourly glucose average bar chart with ${data.length} hourly groups.`}
          accessibilityHint="Tap a bar to hear its average."
          onPress={(event) => {
            const relative = Math.max(0, Math.min(plotWidth, event.nativeEvent.locationX - left));
            setSelectedIndex(Math.min(data.length - 1, Math.floor((relative / plotWidth) * data.length)));
          }}>
          <Svg width={width} height={HEIGHT}>
            {[70, 180].map((value) => {
              const y = top + ((maximum - value) / maximum) * plotHeight;
              return (
                <Line
                  key={value}
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                  stroke={value === 70 ? palette.green : palette.amber}
                  strokeOpacity={0.35}
                  strokeDasharray="4 4"
                />
              );
            })}
            {data.map((item, index) => {
              const slot = plotWidth / data.length;
              const barWidth = Math.max(4, slot - 4);
              const barHeight = (item.averageMgDl / maximum) * plotHeight;
              const x = left + index * slot + (slot - barWidth) / 2;
              const y = top + plotHeight - barHeight;
              return (
                <Rect
                  key={item.hour}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={3}
                  fill={selectedIndex === index ? palette.purple : palette.blue}
                  opacity={selectedIndex === null || selectedIndex === index ? 1 : 0.45}
                />
              );
            })}
            {data.filter((_, index) => index % 4 === 0 || index === data.length - 1).map((item) => {
              const index = data.indexOf(item);
              const slot = plotWidth / data.length;
              return (
                <SvgText
                  key={`label-${item.hour}`}
                  x={left + index * slot + slot / 2}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill={palette.textMuted}>
                  {item.hour === 0 ? '12a' : item.hour < 12 ? `${item.hour}a` : item.hour === 12 ? '12p' : `${item.hour - 12}p`}
                </SvgText>
              );
            })}
          </Svg>
        </Pressable>
      ) : null}
      <View style={styles.caption}>
        <AppText variant="caption" color={palette.textMuted}>
          Hourly averages from displayed readings
        </AppText>
        {selected ? (
          <AppText variant="caption" color={palette.navy}>
            {selected.hour}:00 · {Math.round(selected.averageMgDl)} mg/dL
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
