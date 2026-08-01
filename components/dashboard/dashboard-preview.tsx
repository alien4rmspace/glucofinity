"use client";

import { ArrowRight, Bike, Clock3, MoonStar, Pill, Sparkles, TrendingUp, Utensils } from "lucide-react";
import { DailyGlucoseChart } from "@/components/charts/glucose-charts";

const contextEvents = [
  { icon: Utensils, label: "Recent meal", value: "Salmon rice bowl", detail: "12:35 PM", color: "text-[#7257d9] bg-[#f0edff]" },
  { icon: MoonStar, label: "Sleep", value: "7 h 18 min", detail: "Good continuity", color: "text-[#3156a4] bg-[#eaf1ff]" },
  { icon: Bike, label: "Exercise", value: "24 min walk", detail: "1:18 PM", color: "text-[#087f6a] bg-[#e0f7f1]" },
  { icon: Pill, label: "Medication", value: "Event logged", detail: "8:05 AM", color: "text-[#a05a18] bg-[#fff1dc]" },
];

export function DashboardPreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-[#d5e1ec] bg-white shadow-[0_24px_70px_rgba(11,31,51,0.14)]">
      <div className="flex flex-col gap-3 border-b border-[#e4ebf2] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-[#eaf3ff] text-[#1268e8]"><TrendingUp className="size-5" aria-hidden="true" /></div>
          <div><p className="text-sm font-semibold text-[#0b1f33]">Today&apos;s overview</p><p className="text-xs text-[#718096]">Fictional demonstration data</p></div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#087f6a]"><span className="size-2 rounded-full bg-[#10a37f]" aria-hidden="true" />Demo sensor connected</div>
      </div>

      <div className="grid border-b border-[#e4ebf2] sm:grid-cols-[1.2fr_1fr_1fr]">
        <div className="px-5 py-5 sm:border-r sm:border-[#e4ebf2]">
          <p className="text-xs font-semibold uppercase text-[#718096]">Current glucose</p>
          <div className="mt-2 flex items-end gap-2"><span className="text-4xl font-semibold text-[#0b1f33]">118</span><span className="pb-1 text-sm text-[#526477]">mg/dL</span><TrendingUp className="mb-1 size-5 text-[#087f6a]" aria-label="steady trend" /></div>
          <p className="mt-2 text-xs text-[#087f6a]">Within demonstration target range</p>
        </div>
        <div className="border-t border-[#e4ebf2] px-5 py-5 sm:border-r sm:border-t-0"><p className="text-xs font-semibold uppercase text-[#718096]">Time in range</p><p className="mt-2 text-3xl font-semibold text-[#0b1f33]">84%</p><p className="mt-2 text-xs text-[#526477]">70-180 mg/dL</p></div>
        <div className="border-t border-[#e4ebf2] px-5 py-5 sm:border-t-0"><p className="text-xs font-semibold uppercase text-[#718096]">Daily average</p><p className="mt-2 text-3xl font-semibold text-[#0b1f33]">126</p><p className="mt-2 text-xs text-[#526477]">mg/dL</p></div>
      </div>

      <div className="border-b border-[#e4ebf2] px-3 py-5 sm:px-5">
        <div className="mb-1 flex items-center justify-between px-2">
          <div><h3 className="text-sm font-semibold text-[#0b1f33]">24-hour glucose trend</h3><p className="mt-1 text-xs text-[#718096]">Shaded area shows the demo target range</p></div>
          <Clock3 className="size-4 text-[#718096]" aria-hidden="true" />
        </div>
        <DailyGlucoseChart />
      </div>

      <div className="grid border-b border-[#e4ebf2] sm:grid-cols-2 lg:grid-cols-4">
        {contextEvents.map((event, index) => {
          const Icon = event.icon;
          return (
            <div key={event.label} className={`flex min-w-0 gap-3 px-4 py-4 ${index > 0 ? "border-t border-[#e4ebf2] sm:border-t-0" : ""} ${index % 2 ? "sm:border-l" : ""} ${index === 2 ? "lg:border-l" : ""}`}>
              <div className={`grid size-8 shrink-0 place-items-center rounded-lg ${event.color}`}><Icon className="size-4" aria-hidden="true" /></div>
              <div className="min-w-0"><p className="text-[11px] font-semibold uppercase text-[#718096]">{event.label}</p><p className="mt-1 truncate text-sm font-semibold text-[#0b1f33]">{event.value}</p><p className="mt-0.5 text-xs text-[#718096]">{event.detail}</p></div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 bg-[#f6f2ff] px-5 py-5 sm:flex-row sm:items-start">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#7257d9] text-white"><Sparkles className="size-4" aria-hidden="true" /></div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold uppercase text-[#5e46bc]">AI-assisted insight</p><span className="rounded-full border border-[#cfc4fa] px-2 py-0.5 text-[10px] font-semibold text-[#5e46bc]">Prototype</span></div>
          <p className="mt-2 text-sm leading-6 text-[#27394b]">Your glucose response after similar rice-based meals was lower on days when you walked within 30 minutes after eating.</p>
        </div>
        <a href="#insights" className="inline-flex items-center gap-1 text-xs font-semibold text-[#5e46bc] hover:text-[#49349f]">Context <ArrowRight className="size-3.5" aria-hidden="true" /></a>
      </div>
    </div>
  );
}
