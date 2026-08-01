"use client";

import { Activity, ChartNoAxesCombined, History, LockKeyhole, MoonStar, Pill, ScanLine, Sparkles } from "lucide-react";
import { features } from "@/data/mock-data";
import { SectionHeading } from "@/components/ui/section-heading";

const icons = { activity: Activity, scan: ScanLine, chart: ChartNoAxesCombined, sparkles: Sparkles, moon: MoonStar, pill: Pill, history: History, lock: LockKeyhole };

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="A fuller picture" title="Bring daily context into the glucose story" description="Individual readings are only one part of the picture. GlucoFinity is designed to organize the events around them so patterns are easier to inspect and discuss." align="center" />
        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-[#dce5ee] bg-[#dce5ee] sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = icons[feature.icon as keyof typeof icons];
            return <article key={feature.title} className="min-h-56 bg-white p-6"><div className="grid size-10 place-items-center rounded-lg bg-[#edf5ff] text-[#1268e8]"><Icon className="size-5" aria-hidden="true" /></div><h3 className="mt-5 text-lg font-semibold text-[#0b1f33]">{feature.title}</h3><p className="mt-3 text-sm leading-6 text-[#526477]">{feature.description}</p></article>;
          })}
        </div>
      </div>
    </section>
  );
}
