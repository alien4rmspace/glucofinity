"use client";

import { Activity, BarChart3, Info } from "lucide-react";
import { DailyGlucoseChart } from "@/components/charts/glucose-charts";
import { DemoCard, DemoEmptyState, DemoMetric, DemoNotice, DemoSectionHeading } from "@/components/demo/demo-ui";
import { dailyGlucoseData } from "@/data/mock-data";
import type { DemoMeal, DemoSettings, DemoTab } from "@/types/demo";

export function DemoTrends({
  settings,
  meals,
  onNavigate,
}: {
  settings: DemoSettings;
  meals: DemoMeal[];
  onNavigate: (tab: DemoTab) => void;
}) {
  if (!settings.showMockData) {
    return (
      <DemoEmptyState
        title="Not enough information to calculate trends"
        description="Turn mock glucose data back on to explore descriptive calculations from the fixed sample day."
        action={<button type="button" onClick={() => onNavigate("settings")} className="rounded-lg bg-[#1268e8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f57c3]">Open Settings</button>}
      />
    );
  }

  const values = dailyGlucoseData.map((point) => point.glucose);
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / values.length;
  const standardDeviation = Math.sqrt(variance);
  const inRange = values.filter((value) => value >= settings.targetLow && value <= settings.targetHigh).length;
  const largestRise = dailyGlucoseData.slice(1).reduce((largest, point, index) => Math.max(largest, point.glucose - dailyGlucoseData[index].glucose), 0);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7257d9]">Trends</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#0b1f33] sm:text-4xl">Describe the displayed patterns</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64768a]">These calculations summarize one fictional day. They do not represent clinical conclusions or individualized targets.</p>
      </div>

      <DemoNotice icon={<Info className="size-5" />} title="Descriptive prototype metrics" tone="blue">
        A repeated observation or numerical association does not establish why a glucose change occurred.
      </DemoNotice>

      <section className="grid gap-4" aria-labelledby="trends-summary-heading">
        <DemoSectionHeading id="trends-summary-heading" title="24-hour summary" description="Calculated from the deterministic chart data rather than hard-coded display values." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <DemoMetric label="Average glucose" value={`${Math.round(average)}`} helper="mg/dL" />
          <DemoMetric label="Minimum / maximum" value={`${Math.min(...values)} / ${Math.max(...values)}`} helper="mg/dL" />
          <DemoMetric label="Time in range" value={`${Math.round((inRange / values.length) * 100)}%`} helper={`${settings.targetLow}–${settings.targetHigh} mg/dL prototype range`} />
          <DemoMetric label="Variability" value={`${Math.round(standardDeviation)}`} helper="standard deviation in mg/dL" />
          <DemoMetric label="Largest hourly rise" value={`${largestRise}`} helper="observed mg/dL" />
          <DemoMetric label="Meal comparisons" value={`${meals.length}`} helper="fictional or session entries" />
        </div>
      </section>

      <section className="grid gap-4" aria-labelledby="hourly-pattern-heading">
        <DemoSectionHeading id="hourly-pattern-heading" title="Hourly pattern" description="Hover or focus the chart to inspect individual fictional readings." />
        <DemoCard className="p-3 sm:p-5">
          <DailyGlucoseChart data={dailyGlucoseData} targetLow={settings.targetLow} targetHigh={settings.targetHigh} heightClassName="h-[320px]" />
        </DemoCard>
      </section>

      <section className="grid gap-4" aria-labelledby="metric-explanations-heading">
        <DemoSectionHeading id="metric-explanations-heading" title="What the metrics mean" />
        <DemoCard className="divide-y divide-[#e4ebf2]">
          <Explanation icon={<Activity className="size-5" />} title="Time in range" body="The share of displayed fictional readings within the range selected in Settings. The range is interface context, not personalized guidance." />
          <Explanation icon={<BarChart3 className="size-5" />} title="Variability" body="Standard deviation describes how spread out the displayed values were during the sample day." />
          <Explanation icon={<Info className="size-5" />} title="Meal comparison" body="Meal entries provide reviewable context. A difference after a meal may be related to multiple factors and does not demonstrate causation." />
        </DemoCard>
      </section>
    </div>
  );
}

function Explanation({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-4 p-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#edf5ff] text-[#1268e8]" aria-hidden="true">{icon}</span>
      <div><h3 className="font-semibold text-[#0b1f33]">{title}</h3><p className="mt-1 text-sm leading-6 text-[#64768a]">{body}</p></div>
    </div>
  );
}
