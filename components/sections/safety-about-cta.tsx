"use client";

import { ArrowRight, Beaker, Braces, ChartSpline, GraduationCap, HeartPulse, Palette, ShieldCheck, Stethoscope, TriangleAlert } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";

const limitations = [
  "GlucoFinity is an educational and informational prototype, not a substitute for a licensed healthcare professional.",
  "AI-generated insights may be incomplete, inaccurate, or based on insufficient context.",
  "Nutrition values and glucose predictions are estimates that require user review.",
  "Medication or insulin decisions should not be changed solely because of information shown by the application.",
  "A production healthcare version would require rigorous validation, privacy protections, security controls, and regulatory review where applicable.",
];

const disciplines = [
  { label: "Computer science", icon: Braces },
  { label: "Pharmacy knowledge", icon: Stethoscope },
  { label: "Bioengineering", icon: Beaker },
  { label: "Data science", icon: ChartSpline },
  { label: "Human-centered design", icon: Palette },
];

export function SafetyAboutCta() {
  return (
    <>
      <section id="safety" className="scroll-mt-20 border-y border-[#ead9b8] bg-[#fffaf0] py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.62fr_1.38fr] lg:px-8">
          <div><div className="grid size-12 place-items-center rounded-lg bg-[#fff0cc] text-[#9a5b08]"><ShieldCheck className="size-6" aria-hidden="true" /></div><p className="mt-5 text-xs font-bold uppercase text-[#9a5b08]">Safety and limitations</p><h2 className="mt-3 text-3xl font-semibold text-[#0b1f33] sm:text-4xl">Designed to inform, never to replace care</h2><p className="mt-4 text-sm leading-6 text-[#675d4b]">Clear limits are part of a responsible health product, not fine print.</p></div>
          <ul className="divide-y divide-[#ead9b8] border-y border-[#ead9b8]">{limitations.map((limitation) => <li key={limitation} className="flex gap-3 py-4 text-sm leading-6 text-[#4e493f]"><TriangleAlert className="mt-1 size-4 shrink-0 text-[#b66b06]" aria-hidden="true" />{limitation}</li>)}</ul>
        </div>
      </section>

      <section id="about" className="scroll-mt-20 bg-[#f7fafc] py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:px-8">
          <div>
            <SectionHeading eyebrow="About the project" title="Built at the intersection of health and technology" description="GlucoFinity is an interdisciplinary university healthcare technology project exploring how complex glucose and lifestyle data could become more understandable without losing scientific caution." />
            <div className="mt-7 flex items-start gap-3 border-l-2 border-[#1268e8] pl-4"><GraduationCap className="mt-0.5 size-5 shrink-0 text-[#1268e8]" aria-hidden="true" /><p className="text-sm leading-6 text-[#526477]">The current site is a product concept and interactive demonstration. It does not imply university endorsement, clinical evidence, or a completed healthcare integration.</p></div>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-[#dce5ee] bg-[#dce5ee] sm:grid-cols-2">
            {disciplines.map((discipline, index) => { const Icon = discipline.icon; return <div key={discipline.label} className={`flex min-h-28 items-center gap-4 bg-white p-5 ${index === disciplines.length - 1 ? "sm:col-span-2" : ""}`}><div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#edf5ff] text-[#1268e8]"><Icon className="size-5" aria-hidden="true" /></div><p className="font-semibold text-[#0b1f33]">{discipline.label}</p></div>; })}
          </div>
        </div>
      </section>

      <section id="cta" className="bg-[#0b1f33] py-16 sm:py-20">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="max-w-2xl"><div className="flex items-center gap-2 text-xs font-bold uppercase text-[#63d5e8]"><HeartPulse className="size-4" aria-hidden="true" />Interactive prototype</div><h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Explore the GlucoFinity Demo</h2><p className="mt-4 text-base leading-7 text-[#c4d2df]">See how fictional glucose, meal, sleep, activity, and medication data can be organized into a more understandable daily picture.</p></div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row"><a href="#demo" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-[#0b1f33] hover:bg-[#edf5ff]">Explore the Demo <ArrowRight className="size-4" aria-hidden="true" /></a><a href="#about" className="inline-flex h-12 items-center justify-center rounded-lg border border-[#476078] px-5 text-sm font-semibold text-white hover:border-[#7e96ad] hover:bg-[#122a42]">Learn about the project</a></div>
        </div>
        <p className="mx-auto mt-8 max-w-7xl px-4 text-xs text-[#91a8bc] sm:px-6 lg:px-8">Current version: university project prototype using deterministic mock data.</p>
      </section>
    </>
  );
}
