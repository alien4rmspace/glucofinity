"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dailyGlucoseData, postMealGlucoseData } from "@/data/mock-data";
import type { DemoGlucoseReading, GlucosePoint } from "@/types/glucose";

const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #dce5ee",
  borderRadius: "8px",
  boxShadow: "0 12px 32px rgba(11, 31, 51, 0.12)",
  color: "#0b1f33",
  fontSize: "12px",
};

type DailyGlucoseChartProps = {
  data?: GlucosePoint[];
  targetLow?: number;
  targetHigh?: number;
  heightClassName?: string;
};

export function DailyGlucoseChart({
  data = dailyGlucoseData,
  targetLow = 70,
  targetHigh = 180,
  heightClassName = "h-[260px]",
}: DailyGlucoseChartProps = {}) {
  return (
    <div className={`${heightClassName} min-w-0 w-full`} role="img" aria-label={`Demonstration glucose line chart with a prototype target range from ${targetLow} to ${targetHigh} milligrams per deciliter`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} accessibilityLayer>
          <CartesianGrid stroke="#e7edf3" strokeDasharray="3 5" vertical={false} />
          <ReferenceArea y1={targetLow} y2={targetHigh} fill="#dff7ef" fillOpacity={0.62} />
          <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: "#718096", fontSize: 11 }} interval={5} />
          <YAxis domain={[60, 200]} ticks={[70, 120, 180]} axisLine={false} tickLine={false} tick={{ fill: "#718096", fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#526477", marginBottom: 4 }} formatter={(value) => [`${value} mg/dL`, "Glucose"]} cursor={{ stroke: "#9ab8d7", strokeDasharray: "3 3" }} />
          <Line type="monotone" dataKey="glucose" stroke="#1268e8" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#1268e8", stroke: "#ffffff", strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PostMealChart() {
  return (
    <div className="h-[245px] min-w-0 w-full" role="img" aria-label="Demonstration three-hour glucose response after a meal with a target range from 70 to 180 milligrams per deciliter">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={postMealGlucoseData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} accessibilityLayer>
          <CartesianGrid stroke="#e7edf3" strokeDasharray="3 5" vertical={false} />
          <ReferenceArea y1={70} y2={180} fill="#dff7ef" fillOpacity={0.62} />
          <XAxis dataKey="minutes" axisLine={false} tickLine={false} tick={{ fill: "#718096", fontSize: 11 }} tickFormatter={(value) => (value === 0 ? "Meal" : `${value}m`)} />
          <YAxis domain={[60, 190]} ticks={[70, 120, 180]} axisLine={false} tickLine={false} tick={{ fill: "#718096", fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#526477", marginBottom: 4 }} labelFormatter={(value) => Number(value) === 0 ? "At meal" : `${value} minutes after meal`} formatter={(value) => [`${value} mg/dL`, "Glucose"]} cursor={{ stroke: "#9ab8d7", strokeDasharray: "3 3" }} />
          <Line type="monotone" dataKey="glucose" stroke="#7257d9" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#7257d9", stroke: "#ffffff", strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

type MealResponseChartProps = {
  readings: readonly DemoGlucoseReading[];
  mealTimestamp: string;
  baselineMgDl?: number;
  targetLow?: number;
  targetHigh?: number;
};

type MealChartPoint = {
  minutes: number;
  glucose: number | null;
};

export function MealResponseChart({
  readings,
  mealTimestamp,
  baselineMgDl,
  targetLow = 70,
  targetHigh = 180,
}: MealResponseChartProps) {
  const mealTime = Date.parse(mealTimestamp);
  const observed = readings
    .map((reading) => ({
      minutes: Math.round((Date.parse(reading.timestamp) - mealTime) / 60_000),
      glucose: reading.valueMgDl,
    }))
    .filter((point) => Number.isFinite(point.minutes) && point.minutes >= -30 && point.minutes <= 180)
    .sort((first, second) => first.minutes - second.minutes);
  const chartData = observed.reduce<MealChartPoint[]>((points, point, index) => {
    const previous = observed[index - 1];
    if (previous && point.minutes - previous.minutes > 20) {
      points.push({ minutes: (previous.minutes + point.minutes) / 2, glucose: null });
    }
    points.push(point);
    return points;
  }, []);
  const values = observed.map((point) => point.glucose);
  const lowerValue = Math.min(targetLow - 10, baselineMgDl ?? Number.POSITIVE_INFINITY, ...values);
  const upperValue = Math.max(targetHigh + 10, baselineMgDl ?? Number.NEGATIVE_INFINITY, ...values);
  const yMinimum = Math.max(40, Math.floor(lowerValue / 10) * 10);
  const yMaximum = Math.ceil(upperValue / 10) * 10;

  return (
    <div
      className="h-[300px] min-w-0 w-full"
      role="img"
      aria-label={`Observed fictional meal glucose response chart with ${readings.length} readings from 30 minutes before through 3 hours after the saved meal. Gaps indicate missing readings.`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} accessibilityLayer>
          <CartesianGrid stroke="#e7edf3" strokeDasharray="3 5" vertical={false} />
          <ReferenceArea y1={targetLow} y2={targetHigh} fill="#dff7ef" fillOpacity={0.62} />
          <ReferenceLine x={0} stroke="#7257d9" strokeWidth={2} strokeDasharray="4 4" />
          {baselineMgDl !== undefined ? (
            <ReferenceLine y={baselineMgDl} stroke="#147b8c" strokeDasharray="5 5" />
          ) : null}
          <XAxis
            type="number"
            dataKey="minutes"
            domain={[-30, 180]}
            ticks={[-30, 0, 60, 120, 180]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#718096", fontSize: 11 }}
            tickFormatter={(value) => value === 0 ? "Meal" : value < 0 ? `${value}m` : value === 180 ? "+3h" : `+${value}m`}
          />
          <YAxis
            domain={[yMinimum, yMaximum]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#718096", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#526477", marginBottom: 4 }}
            labelFormatter={(value) => {
              const minuteValue = Number(value);
              if (minuteValue === 0) return "At meal";
              return minuteValue < 0
                ? `${Math.abs(minuteValue)} minutes before meal`
                : `${minuteValue} minutes after meal`;
            }}
            formatter={(value) => value === null ? ["Missing", "Glucose"] : [`${value} mg/dL`, "Glucose"]}
            cursor={{ stroke: "#9ab8d7", strokeDasharray: "3 3" }}
          />
          <Line
            type="linear"
            dataKey="glucose"
            stroke="#1268e8"
            strokeWidth={2.75}
            dot={{ r: 2.5, fill: "#1268e8", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#1268e8", stroke: "#ffffff", strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
