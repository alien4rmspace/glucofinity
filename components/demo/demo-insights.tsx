"use client";

import { Info, Sparkles } from "lucide-react";
import { DemoCard, DemoEmptyState, DemoNotice } from "@/components/demo/demo-ui";
import { insights } from "@/data/mock-data";
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

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#a05a18]">Insights</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#0b1f33] sm:text-4xl">Review preliminary observations</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64768a]">Rule-based prototype statements show how findings could be presented with context and careful language.</p>
      </div>

      <DemoNotice icon={<Sparkles className="size-5" />} title="Simulated insight engine" tone="purple">
        No external AI service is connected. These fixed observations were written for the fictional demonstration dataset.
      </DemoNotice>

      <div className="grid gap-4 lg:grid-cols-2">
        {insights.map((insight, index) => (
          <DemoCard key={insight.title} className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fff1dc] text-sm font-bold text-[#a05a18]">{index + 1}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.06em] text-[#7257d9]">{insight.category}</span>
                  <span className="rounded-full border border-[#dce5ee] px-2 py-0.5 text-[10px] font-semibold text-[#64768a]">Prototype</span>
                </div>
                <h2 className="mt-3 text-lg font-semibold leading-7 text-[#0b1f33]">{insight.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#526477]">{insight.description}</p>
                <p className="mt-4 text-xs font-semibold text-[#718096]">Context: {insight.context}</p>
              </div>
            </div>
          </DemoCard>
        ))}
      </div>

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
