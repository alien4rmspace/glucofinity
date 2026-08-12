"use client";

import { Activity, Info, Sparkles } from "lucide-react";
import { AiFoundationPanel } from "@/components/demo/ai-foundation-panel";
import { DemoCard, DemoEmptyState, DemoNotice } from "@/components/demo/demo-ui";
import { demoGlucoseReadings } from "@/data/demo-data";
import { buildEvidenceBackedInsights } from "@/services/ai-foundation";
import { analyzeMealResponses } from "@/services/meal-glucose-response";
import type { InsightEvidence } from "@/types/ai";
import type { DemoMeal, DemoSettings, DemoTab } from "@/types/demo";

export function DemoInsights({
  settings,
  meals,
  onNavigate,
}: {
  settings: DemoSettings;
  meals: DemoMeal[];
  onNavigate: (tab: DemoTab) => void;
}) {
  if (!settings.showMockData || meals.length === 0) {
    return (
      <DemoEmptyState
        title="More fictional context is needed"
        description="Insights appear when mock readings are visible and at least one meal is available in the demo."
        action={<button type="button" onClick={() => onNavigate(settings.showMockData ? "meals" : "settings")} className="rounded-lg bg-[#1268e8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f57c3]">{settings.showMockData ? "Add a meal" : "Open Settings"}</button>}
      />
    );
  }

  const mealResponses = analyzeMealResponses(meals, demoGlucoseReadings);
  const observedRises = mealResponses
    .map((response) => response.glucoseRiseMgDl)
    .filter((value): value is number => value !== undefined);
  const goodCoverageCount = mealResponses.filter((response) => response.dataQuality === "good").length;
  const evidenceBackedInsights = buildEvidenceBackedInsights(
    meals,
    mealResponses,
    demoGlucoseReadings,
  );

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#a05a18]">Insights</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#0b1f33] sm:text-4xl">Review preliminary observations</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64768a]">Rule-based prototype statements show how findings could be presented with context and careful language.</p>
      </div>

      <DemoNotice icon={<Sparkles className="size-5" />} title="Calculated evidence before explanation" tone="purple">
        Deterministic services calculate each displayed metric and sample size. No external LLM or AI service is connected, and the language layer is not allowed to invent relationships.
      </DemoNotice>

      <DemoCard className="border-[#cfe0f3] bg-[#f8fbff] p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e5f8fb] text-[#147b8c]">
            <Activity className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.06em] text-[#147b8c]">Computed meal-response summary</span>
              <span className="rounded-full border border-[#cfe0f3] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#64768a]">Prototype</span>
            </div>
            <h2 className="mt-3 text-lg font-semibold leading-7 text-[#0b1f33]">
              {observedRises.length > 0
                ? `Observed rises ranged from ${Math.round(Math.min(...observedRises))} to ${Math.round(Math.max(...observedRises))} mg/dL`
                : "No meal-response rise could be calculated"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#526477]">
              {observedRises.length > 0
                ? `The displayed fictional meals had different surrounding glucose responses. ${goodCoverageCount} met the prototype's complete-coverage rules; differences may be related to meal composition, timing, movement, sleep, sampling, or other context.`
                : "The current session meals do not have enough surrounding fictional readings. The prototype does not fill missing observations with generated values."}
            </p>
            <p className="mt-4 text-xs font-semibold text-[#718096]">Context: {mealResponses.length} meals checked against normalized mock readings</p>
          </div>
        </div>
      </DemoCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {evidenceBackedInsights.map((insight, index) => (
          <DemoCard key={insight.title} className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fff1dc] text-sm font-bold text-[#a05a18]">{index + 1}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.06em] text-[#7257d9]">Evidence-backed observation</span>
                  <span className="rounded-full border border-[#dce5ee] px-2 py-0.5 text-[10px] font-semibold text-[#64768a]">Fictional prototype</span>
                </div>
                <h2 className="mt-3 text-lg font-semibold leading-7 text-[#0b1f33]">{insight.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#526477]">{insight.description}</p>
                <EvidenceSummary evidence={insight.evidence} />
              </div>
            </div>
          </DemoCard>
        ))}
      </div>

      <AiFoundationPanel meals={meals} responses={mealResponses} />

      <DemoCard className="flex items-start gap-4 border-[#ead9b8] bg-[#fffaf0] p-5 sm:p-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#fff0cc] text-[#9a5b08]"><Info className="size-5" aria-hidden="true" /></span>
        <div>
          <h2 className="font-semibold text-[#0b1f33]">Medical decisions require professional guidance</h2>
          <p className="mt-2 text-sm leading-6 text-[#675d4b]">These observations may be incomplete or inaccurate. Consult a qualified healthcare professional for medical decisions, and do not change medication or insulin because of this prototype.</p>
        </div>
      </DemoCard>
    </div>
  );
}

function EvidenceSummary({ evidence }: { evidence: InsightEvidence }) {
  return (
    <div className="mt-4 border-t border-[#e4ebf2] pt-4">
      <p className="text-xs font-semibold text-[#31506f]">Evidence: n = {evidence.sampleSize} {evidence.sampleUnit}</p>
      {evidence.metrics?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {evidence.metrics.map((metric) => (
            <span key={metric.label} className="rounded-md bg-[#f2f7fb] px-2.5 py-1.5 text-[11px] text-[#526477]">
              {metric.label}: <strong className="text-[#0b1f33]">{Math.round(metric.value * 10) / 10} {metric.unit}</strong>
            </span>
          ))}
        </div>
      ) : null}
      {evidence.comparisonGroups?.length ? (
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {evidence.comparisonGroups.map((group) => (
            <div key={group.label} className="rounded-lg bg-[#f7fafc] p-3">
              <dt className="text-[11px] leading-4 text-[#64768a]">{group.label} · n = {group.sampleSize}</dt>
              <dd className="mt-1 text-sm font-semibold text-[#0b1f33]">{group.meanValue} {group.unit}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
