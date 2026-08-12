"use client";

import { Dumbbell, Footprints, MoonStar, Repeat2, Utensils } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { insights } from "@/data/mock-data";

const icons = { footprints: Footprints, moon: MoonStar, utensils: Utensils, repeat: Repeat2, dumbbell: Dumbbell };

export function Insights() {
  return (
    <section id="insights" className="scroll-mt-20 border-y border-[#dce5ee] bg-[#f7fafc] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Personalized insights" title="Patterns described with the right level of caution" description="GlucoFinity is designed to show what was observed, how much data supports it, and where uncertainty remains. These examples are fictional and informational." align="center" />
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          {insights.map((insight, index) => {
            const Icon = icons[insight.icon as keyof typeof icons];
            return (
              <article key={insight.title} className={`rounded-lg border border-[#d5e1ec] bg-white p-6 shadow-sm ${index < 2 ? "lg:col-span-3" : "lg:col-span-2"}`}>
                <div className="flex items-start justify-between gap-4"><div className="grid size-10 place-items-center rounded-lg bg-[#edf5ff] text-[#1268e8]"><Icon className="size-5" aria-hidden="true" /></div><span className="rounded-full bg-[#eef7f5] px-2.5 py-1 text-[11px] font-semibold text-[#087f6a]">Sample insight</span></div>
                <p className="mt-5 text-xs font-bold uppercase text-[#718096]">{insight.category}</p><h3 className="mt-2 text-lg font-semibold leading-7 text-[#0b1f33]">{insight.title}</h3><p className="mt-3 text-sm leading-6 text-[#526477]">{insight.description}</p><p className="mt-5 border-t border-[#e4ebf2] pt-4 text-xs font-semibold text-[#31506f]">Fictional evidence: {insight.context}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
