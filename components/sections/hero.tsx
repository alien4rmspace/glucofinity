"use client";

import { ArrowDown, ArrowRight, FlaskConical } from "lucide-react";
import { DashboardPreview } from "@/components/dashboard/dashboard-preview";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden border-b border-[#dce5ee] bg-[#f7fafc]">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[0.78fr_1.22fr] lg:px-8 lg:pb-20 lg:pt-24">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#cddceb] bg-white px-3 py-1.5 text-xs font-semibold text-[#31506f]"><FlaskConical className="size-3.5 text-[#1268e8]" aria-hidden="true" />University healthcare technology prototype</div>
          <h1 className="mt-6 text-5xl font-semibold text-[#0b1f33] sm:text-6xl lg:text-7xl">GlucoFinity</h1>
          <p className="mt-5 text-xl font-semibold leading-8 text-[#1268e8] sm:text-2xl">Discover the possibilities within your glucose data.</p>
          <p className="mt-5 max-w-lg text-base leading-7 text-[#526477] sm:text-lg">GlucoFinity combines glucose readings with meals, sleep, activity, and medication data to help users recognize meaningful patterns in their health.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#demo" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#1268e8] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0f57c3]">Explore the Demo <ArrowRight className="size-4" aria-hidden="true" /></a>
            <a href="#how-it-works" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[#c9d7e4] bg-white px-5 text-sm font-semibold text-[#0b1f33] transition-colors hover:border-[#91aed0] hover:bg-[#f2f7fb]">How It Works <ArrowDown className="size-4" aria-hidden="true" /></a>
          </div>
          <p className="mt-5 text-xs leading-5 text-[#718096]">Educational prototype. Not intended for diagnosis, treatment, or medication decisions.</p>
        </div>
        <div id="demo" className="min-w-0 scroll-mt-24"><DashboardPreview /></div>
      </div>
    </section>
  );
}
