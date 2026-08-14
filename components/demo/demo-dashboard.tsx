"use client";

import { Activity, ArrowRight, Database, HeartPulse, TrendingUp, Utensils } from "lucide-react";
import { useMemo, useState } from "react";
import { DailyGlucoseChart } from "@/components/charts/glucose-charts";
import { DemoFitnessSummary } from "@/components/demo/demo-fitness-summary";
import { DemoCard, DemoEmptyState, DemoMetric, DemoNotice, DemoSectionHeading } from "@/components/demo/demo-ui";
import { dailyGlucoseData } from "@/data/mock-data";
import type { DemoSettings, DemoTab } from "@/types/demo";

const rangeOptions = [3, 6, 12, 24];

export function DemoDashboard({
  settings,
  mealCount,
  onNavigate,
  onSettingsChange,
}: {
  settings: DemoSettings;
  mealCount: number;
  onNavigate: (tab: DemoTab) => void;
  onSettingsChange: (settings: DemoSettings) => void;
}) {
  const [rangeHours, setRangeHours] = useState(6);
  const [healthPromptDismissed, setHealthPromptDismissed] = useState(false);
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

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1268e8]">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#0b1f33] sm:text-4xl">Your fictional day at a glance</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64768a]">Explore deterministic sample readings and daily context. Nothing shown is connected to a person or medical device.</p>
      </div>

      {settings.fitnessPreviewState === "not-selected" && !healthPromptDismissed ? (
        <DemoCard className="border-[#cce8db] bg-[#eefaf3] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[#087f6a]">
              <HeartPulse className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-[#0b1f33]">Connect Apple Health</h2>
              <p className="mt-1 text-sm leading-6 text-[#526477]">
                The iOS app can optionally display blood glucose and fitness records that a user chooses to share. This browser card previews that invitation only.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => onNavigate("settings")} className="rounded-lg bg-[#1268e8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f57c3]">
                  Open Settings preview
                </button>
                <button type="button" onClick={() => setHealthPromptDismissed(true)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#526477] hover:bg-white">
                  Not now
                </button>
              </div>
            </div>
          </div>
        </DemoCard>
      ) : null}

      {settings.showMockData ? (
        <>
          <DemoNotice icon={<Database className="size-5" />} title="Fictional demo data is active" tone="blue">
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
            <DemoSectionHeading id="daily-summary-heading" title="Today at a glance" description="Calculated from the displayed fictional readings." />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DemoMetric label="Daily average" value={`${average}`} helper="mg/dL" />
              <DemoMetric label="Observed range" value={`${minimum}–${maximum}`} helper="mg/dL" />
              <DemoMetric label="In prototype range" value={`${timeInRange}%`} helper={`${settings.targetLow}–${settings.targetHigh} mg/dL`} />
              <DemoMetric label="Meals logged" value={`${mealCount}`} helper="fictional session" />
            </div>
          </section>
        </>
      ) : (
        <>
          <DemoNotice icon={<Database className="size-5" />} title="No glucose source is active" tone="neutral">
            This website cannot connect to a sensor. Fictional demo mode remains optional for testing the glucose interface.
          </DemoNotice>
          <DemoEmptyState
            title="No glucose source selected"
            description="Turn deterministic fictional glucose readings back on in Settings to explore the chart and glucose metrics."
            action={(
              <button type="button" onClick={() => onNavigate("settings")} className="rounded-lg bg-[#1268e8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f57c3]">
                Open Settings
              </button>
            )}
          />
        </>
      )}

      <DemoFitnessSummary
        previewState={settings.fitnessPreviewState}
        onNavigate={onNavigate}
        onRetry={() => onSettingsChange({ ...settings, fitnessPreviewState: "records" })}
      />

      <DemoNotice icon={<Activity className="size-5" />} title="Safety context" tone="neutral">
        This display is educational and does not diagnose, predict treatment needs, or recommend medication or insulin changes.
      </DemoNotice>
    </div>
  );
}
