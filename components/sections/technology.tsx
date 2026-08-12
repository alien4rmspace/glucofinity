"use client";

import { Activity, ArrowRight, BotMessageSquare, Database, Network, ScanLine } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { technologyStages } from "@/data/mock-data";

const icons = { database: Database, scan: ScanLine, nodes: Network, activity: Activity, message: BotMessageSquare };

export function Technology() {
  return (
    <section id="technology" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <SectionHeading eyebrow="AI/ML foundation" title="Specialized models, clear responsibilities" description="The architecture separates meal interpretation, deterministic features, tabular prediction, time-series forecasting, statistical evidence, and explanation." />
          <p className="max-w-2xl text-sm leading-6 text-[#718096] lg:justify-self-end">Status labels distinguish what this fictional demo calculates from foundational contracts and future models. No trained production model is represented as available.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {technologyStages.map((stage, index) => {
            const Icon = icons[stage.icon as keyof typeof icons];
            return (
              <article key={stage.label} className="relative rounded-lg border border-[#d5e1ec] bg-[#f9fbfd] p-6">
                <div className="flex items-center justify-between"><div className="grid size-10 place-items-center rounded-lg bg-white text-[#1268e8] shadow-sm"><Icon className="size-5" aria-hidden="true" /></div><span className="text-[11px] font-bold uppercase text-[#8a9aac]">{stage.label}</span></div>
                <span className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.05em] ${stage.status === "Demonstrated" ? "bg-[#e0f7f1] text-[#087f6a]" : stage.status === "Foundation" ? "bg-[#f0edff] text-[#6049bc]" : "bg-[#fff1dc] text-[#a05a18]"}`}>{stage.status}</span>
                <h3 className="mt-5 text-lg font-semibold text-[#0b1f33]">{stage.title}</h3><p className="mt-3 text-sm leading-6 text-[#526477]">{stage.description}</p>
                <ul className="mt-5 space-y-2 border-t border-[#dce5ee] pt-4">{stage.items.map((item) => <li key={item} className="flex gap-2 text-xs leading-5 text-[#31506f]"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#18a287]" aria-hidden="true" />{item}</li>)}</ul>
                {index < technologyStages.length - 1 ? <span className="absolute -right-2.5 top-9 z-10 hidden size-5 place-items-center rounded-full border border-[#d5e1ec] bg-white text-[#91aed0] xl:grid"><ArrowRight className="size-3" aria-hidden="true" /></span> : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
