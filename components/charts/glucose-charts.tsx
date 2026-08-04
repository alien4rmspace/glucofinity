"use client";

import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { dailyGlucoseData, postMealGlucoseData } from "@/data/mock-data";
import type { GlucosePoint } from "@/types/glucose";

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
