"use client";

import { ArrowRight, BotMessageSquare, Database, Network, ScanLine } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { technologyStages } from "@/data/mock-data";

const icons = { database: Database, scan: ScanLine, nodes: Network, message: BotMessageSquare };

export function Technology() {
  return (
    <section id="technology" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <SectionHeading eyebrow="Planned technology" title="Specialized models, clear responsibilities" description="The proposed architecture separates data collection, meal interpretation, time-series analysis, and explanation. No single model is expected to perform every task." />
          <p className="max-w-2xl text-sm leading-6 text-[#718096] lg:justify-self-end">Integrations and model capabilities shown here describe a future technical direction. They are not represented as completed, validated, or production-ready features.</p>
        </div>
        <div className="mt-12 grid gap-4 lg:grid-cols-4">
          {technologyStages.map((stage, index) => {
            const Icon = icons[stage.icon as keyof typeof icons];
            return (
              <article key={stage.label} className="relative rounded-lg border border-[#d5e1ec] bg-[#f9fbfd] p-6">
                <div className="flex items-center justify-between"><div className="grid size-10 place-items-center rounded-lg bg-white text-[#1268e8] shadow-sm"><Icon className="size-5" aria-hidden="true" /></div><span className="text-[11px] font-bold uppercase text-[#8a9aac]">{stage.label}</span></div>
                <h3 className="mt-5 text-lg font-semibold text-[#0b1f33]">{stage.title}</h3><p className="mt-3 text-sm leading-6 text-[#526477]">{stage.description}</p>
                <ul className="mt-5 space-y-2 border-t border-[#dce5ee] pt-4">{stage.items.map((item) => <li key={item} className="flex gap-2 text-xs leading-5 text-[#31506f]"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#18a287]" aria-hidden="true" />{item}</li>)}</ul>
                {index < technologyStages.length - 1 ? <span className="absolute -right-2.5 top-9 z-10 hidden size-5 place-items-center rounded-full border border-[#d5e1ec] bg-white text-[#91aed0] lg:grid"><ArrowRight className="size-3" aria-hidden="true" /></span> : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
