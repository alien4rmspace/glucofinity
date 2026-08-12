"use client";

import { Activity, ArrowRight, Database, TrendingUp, Utensils } from "lucide-react";
import { useMemo, useState } from "react";
import { DailyGlucoseChart } from "@/components/charts/glucose-charts";
import { DemoCard, DemoEmptyState, DemoMetric, DemoNotice, DemoSectionHeading } from "@/components/demo/demo-ui";
import { dailyGlucoseData } from "@/data/mock-data";
import type { DemoSettings, DemoTab } from "@/types/demo";

const rangeOptions = [3, 6, 12, 24];

export function DemoDashboard({
  settings,
  mealCount,
  onNavigate,
}: {
  settings: DemoSettings;
  mealCount: number;
  onNavigate: (tab: DemoTab) => void;
}) {
  const [rangeHours, setRangeHours] = useState(6);
  const visibleData = useMemo(() => dailyGlucoseData.slice(-rangeHours), [rangeHours]);
  const average = Math.round(dailyGlucoseData.reduce((total, point) => total + point.glucose, 0) / dailyGlucoseData.length);
  const minimum = Math.min(...dailyGlucoseData.map((point) => point.glucose));
  const maximum = Math.max(...dailyGlucoseData.map((point) => point.glucose));
  const inRangeCount = dailyGlucoseData.filter(
    (point) => point.glucose >= settings.targetLow && point.glucose <= settings.targetHigh,
  ).length;
  const timeInRange = Math.round((inRangeCount / dailyGlucoseData.length) * 100);
  const latest = dailyGlucoseData.at(-1)!;
  const status = latest.glucose < settings.targetLow
    ? "Below prototype range"
    : latest.glucose > settings.targetHigh
      ? "Above prototype range"
      : "Within prototype range";

  if (!settings.showMockData) {
    return (
      <DemoEmptyState
        title="Mock glucose data is hidden"
        description="This public demo has no sensor connection. Turn the deterministic fictional readings back on in Settings to explore the dashboard."
        action={(
          <button type="button" onClick={() => onNavigate("settings")} className="rounded-lg bg-[#1268e8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f57c3]">
            Open Settings
          </button>
        )}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1268e8]">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#0b1f33] sm:text-4xl">Your fictional day at a glance</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64768a]">Explore deterministic sample readings and daily context. Nothing shown is connected to a person or medical device.</p>
      </div>

      <DemoNotice icon={<Database className="size-5" />} title="Mock data is active" tone="blue">
        The values are normalized fictional examples with source provenance, so every visitor sees the same meal-response demonstration.
      </DemoNotice>

      <DemoCard className="overflow-hidden">
        <div className="grid gap-px bg-[#e4ebf2] lg:grid-cols-[1.25fr_0.75fr]">
          <div className="bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#718096]">Latest mock reading</p>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-5xl font-semibold text-[#0b1f33]">{latest.glucose}</span>
                  <span className="pb-1.5 text-sm text-[#64768a]">mg/dL</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm font-medium text-[#087f6a]">
                  <TrendingUp className="size-4" aria-hidden="true" /> Steady fictional trend
                </div>
              </div>
              <span className="w-fit rounded-full bg-[#e0f7f1] px-3 py-1.5 text-xs font-semibold text-[#087f6a]">{status}</span>
            </div>
            <p className="mt-5 text-xs text-[#718096]">Most recent demonstration sample at {latest.time}</p>
          </div>
          <div className="grid bg-white p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-[#f0edff] text-[#7257d9]"><Utensils className="size-5" aria-hidden="true" /></span>
              <div><p className="text-xs font-bold uppercase text-[#718096]">Meals logged</p><p className="mt-1 text-2xl font-semibold text-[#0b1f33]">{mealCount}</p></div>
            </div>
            <button type="button" onClick={() => onNavigate("meals")} className="mt-5 inline-flex items-center gap-1.5 self-end text-sm font-semibold text-[#1268e8] hover:text-[#0f57c3]">
              Review meal response metrics <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </DemoCard>

      <section className="grid gap-4" aria-labelledby="glucose-overview-heading">
        <DemoSectionHeading
          id="glucose-overview-heading"
          title="Glucose overview"
          description="Choose a time window and inspect the fictional readings with the configured prototype range."
          action={(
            <div className="inline-flex rounded-lg border border-[#d5e1ec] bg-white p-1" aria-label="Glucose chart time range">
              {rangeOptions.map((hours) => (
                <button
                  key={hours}
                  type="button"
                  aria-pressed={rangeHours === hours}
                  onClick={() => setRangeHours(hours)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${rangeHours === hours ? "bg-[#1268e8] text-white" : "text-[#526477] hover:bg-[#f2f7fb]"}`}
                >
                  {hours}h
                </button>
              ))}
            </div>
          )}
        />
        <DemoCard className="p-3 sm:p-5">
          <DailyGlucoseChart data={visibleData} targetLow={settings.targetLow} targetHigh={settings.targetHigh} heightClassName="h-[300px]" />
        </DemoCard>
      </section>

      <section className="grid gap-4" aria-labelledby="daily-summary-heading">
        <DemoSectionHeading id="daily-summary-heading" title="24-hour summary" description="Descriptive calculations from the displayed fictional dataset." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DemoMetric label="Average" value={`${average}`} helper="mg/dL" />
          <DemoMetric label="Minimum / maximum" value={`${minimum} / ${maximum}`} helper="mg/dL" />
          <DemoMetric label="Time in range" value={`${timeInRange}%`} helper={`${settings.targetLow}–${settings.targetHigh} mg/dL prototype range`} />
          <DemoMetric label="Data points" value={`${dailyGlucoseData.length}`} helper="one fictional day" />
        </div>
      </section>

      <DemoNotice icon={<Activity className="size-5" />} title="Safety context" tone="neutral">
        This display is educational and does not diagnose, predict treatment needs, or recommend medication or insulin changes.
      </DemoNotice>
    </div>
  );
}
