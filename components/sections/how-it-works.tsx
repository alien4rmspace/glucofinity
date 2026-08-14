"use client";

import { Activity, ArrowRight, BrainCircuit, ClipboardPlus, DatabaseZap, Lightbulb, MoonStar, Pill, Utensils } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";

const steps = [
  { number: "01", title: "Connect health data", description: "Choose permitted blood glucose and fitness records in the native mobile prototype.", icon: DatabaseZap },
  { number: "02", title: "Log meals and events", description: "Add meals, medication, sleep, activity, and useful notes.", icon: ClipboardPlus },
  { number: "03", title: "Analyze responses", description: "Compare timing, magnitude, and repeated glucose patterns.", icon: BrainCircuit },
  { number: "04", title: "Discover patterns", description: "Review cautious summaries with the source context attached.", icon: Lightbulb },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-y border-[#dce5ee] bg-[#f7fafc] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="How it works" title="From scattered signals to reviewable context" description="Each part of the planned system has a focused role, from collecting user-approved data to presenting an understandable pattern summary." />
        <ol className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.number} className="relative border-t-2 border-[#cddceb] pt-6">
                <div className="flex items-center justify-between"><div className="grid size-10 place-items-center rounded-lg bg-[#1268e8] text-white"><Icon className="size-5" aria-hidden="true" /></div><span className="text-xs font-bold text-[#8a9aac]">{step.number}</span></div>
                <h3 className="mt-5 text-lg font-semibold text-[#0b1f33]">{step.title}</h3><p className="mt-2 text-sm leading-6 text-[#526477]">{step.description}</p>
                {index < steps.length - 1 ? <ArrowRight className="absolute -right-5 top-7 hidden size-4 text-[#91aed0] lg:block" aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ol>
        <div className="mt-14 overflow-hidden rounded-lg border border-[#d4e1ed] bg-white">
          <div className="grid items-stretch lg:grid-cols-[1fr_auto_0.7fr_auto_0.8fr]">
            <div className="p-6"><p className="text-xs font-bold uppercase text-[#718096]">Daily context</p><div className="mt-4 flex flex-wrap gap-4 text-[#34495e]"><span className="inline-flex items-center gap-2 text-sm"><Activity className="size-4 text-[#1268e8]" /> CGM</span><span className="inline-flex items-center gap-2 text-sm"><Utensils className="size-4 text-[#7257d9]" /> Meals</span><span className="inline-flex items-center gap-2 text-sm"><MoonStar className="size-4 text-[#3156a4]" /> Sleep</span><span className="inline-flex items-center gap-2 text-sm"><Pill className="size-4 text-[#a05a18]" /> Medication</span></div></div>
            <div className="hidden items-center px-2 text-[#91aed0] lg:flex"><ArrowRight className="size-5" /></div>
            <div className="border-t border-[#dce5ee] p-6 lg:border-l lg:border-t-0"><p className="text-xs font-bold uppercase text-[#718096]">Specialized analysis</p><p className="mt-3 text-sm font-semibold text-[#0b1f33]">Responses aligned by time and context</p></div>
            <div className="hidden items-center px-2 text-[#91aed0] lg:flex"><ArrowRight className="size-5" /></div>
            <div className="border-t border-[#dce5ee] bg-[#eff8ff] p-6 lg:border-l lg:border-t-0"><p className="text-xs font-bold uppercase text-[#1268e8]">Understandable insight</p><p className="mt-3 text-sm font-semibold text-[#0b1f33]">A pattern summary with supporting context</p></div>
          </div>
        </div>
      </div>
    </section>
  );
}
