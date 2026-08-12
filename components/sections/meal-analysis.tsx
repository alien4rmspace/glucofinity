"use client";

import { Check, Edit3, Info, ScanLine, Utensils } from "lucide-react";
import { useState } from "react";
import { PostMealChart } from "@/components/charts/glucose-charts";
import { SectionHeading } from "@/components/ui/section-heading";
import { mealEstimates } from "@/data/mock-data";
import type { NutritionEstimateSource } from "@/types/ai";

export function MealAnalysis() {
  const [editing, setEditing] = useState(false);
  const [carbohydrates, setCarbohydrates] = useState(mealEstimates.map((item) => item.carbohydrates));
  const [nutritionSource, setNutritionSource] = useState<NutritionEstimateSource>("ai-estimated");
  const totalCarbohydrates = carbohydrates.reduce((total, item) => total + item, 0);

  return (
    <section id="meal-analysis" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Meal analysis demonstration" title="A meal estimate you can inspect and correct" description="The prototype proposes structured meal details and pairs them with the following glucose response. Every nutrition value remains an estimate until the user reviews it." />
        <div className="mt-12 grid overflow-hidden rounded-lg border border-[#d5e1ec] bg-white shadow-[0_18px_55px_rgba(11,31,51,0.08)] lg:grid-cols-[0.9fr_1.1fr]">
          <div className="border-b border-[#dce5ee] lg:border-b-0 lg:border-r">
            <div className="relative min-h-72 overflow-hidden bg-[#eaf3f2] p-6">
              <div className="absolute left-5 top-5 z-10 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#31506f] shadow-sm"><ScanLine className="size-3.5 text-[#1268e8]" aria-hidden="true" />Meal photo placeholder</div>
              <div className="meal-scene" aria-hidden="true"><div className="meal-plate"><span className="meal-salmon" /><span className="meal-rice" /><span className="meal-greens" /><span className="meal-carrot" /></div></div>
            </div>
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-xs font-bold uppercase text-[#718096]">Recognized meal</p><h3 className="mt-2 text-xl font-semibold text-[#0b1f33]">Salmon rice bowl</h3><p className="mt-1 text-sm text-[#526477]">12:35 PM - Fictional demo</p><span className="mt-3 inline-flex rounded-full border border-[#cfc4fa] bg-[#f6f2ff] px-2.5 py-1 text-[11px] font-semibold text-[#6049bc]">{nutritionSource === "ai-corrected" ? "User-corrected AI estimate" : "AI-estimated nutrition"}</span></div>
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#f0edff] text-[#7257d9]"><Utensils className="size-5" aria-hidden="true" /></div>
              </div>
              <div className="mt-6 divide-y divide-[#e4ebf2] border-y border-[#e4ebf2]">
                {mealEstimates.map((item, index) => (
                  <div key={item.food} className="grid grid-cols-[1fr_auto] gap-4 py-4">
                    <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-[#0b1f33]">{item.food}</p><span className="text-[11px] font-semibold text-[#087f6a]">{item.confidence}% confidence</span></div><p className="mt-1 text-xs text-[#718096]">Estimated serving: {item.serving}</p><div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-[#e5edf3]" aria-hidden="true"><div className="h-full rounded-full bg-[#18a287]" style={{ width: `${item.confidence}%` }} /></div></div>
                    <div className="text-right">
                      {editing ? (
                        <label className="block text-xs font-semibold text-[#526477]"><span className="sr-only">Estimated carbohydrates for {item.food}</span><input type="number" min="0" max="200" value={carbohydrates[index]} onChange={(event) => { const next = [...carbohydrates]; next[index] = Number(event.target.value); setCarbohydrates(next); setNutritionSource("ai-corrected"); }} className="h-9 w-20 rounded-lg border border-[#9eb4c9] px-2 text-right text-sm text-[#0b1f33]" /><span className="ml-1">g</span></label>
                      ) : <><p className="text-sm font-semibold text-[#0b1f33]">{carbohydrates[index]} g</p><p className="mt-1 text-[11px] text-[#718096]">estimated carbs</p></>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-xs text-[#718096]">Estimated total carbohydrates</p><p className="mt-1 text-2xl font-semibold text-[#0b1f33]">{totalCarbohydrates} g</p></div>
                <button type="button" onClick={() => setEditing((current) => !current)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#b9c9d8] bg-white px-4 text-sm font-semibold text-[#0b1f33] hover:bg-[#f2f7fb]">{editing ? <Check className="size-4" /> : <Edit3 className="size-4" />}{editing ? "Save estimates" : "Edit estimates"}</button>
              </div>
            </div>
          </div>
          <div className="flex min-w-0 flex-col p-5 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase text-[#7257d9]">Observed response</p><h3 className="mt-2 text-xl font-semibold text-[#0b1f33]">Three-hour post-meal curve</h3><p className="mt-2 text-sm leading-6 text-[#526477]">Peak of 168 mg/dL at approximately 60 minutes in this fictional example.</p></div><span className="self-start rounded-full border border-[#cfc4fa] bg-[#f6f2ff] px-3 py-1 text-xs font-semibold text-[#5e46bc]">Demo response</span></div>
            <div className="mt-6 min-w-0 flex-1"><PostMealChart /></div>
            <div className="mt-5 flex gap-3 border-t border-[#e4ebf2] pt-5"><Info className="mt-0.5 size-4 shrink-0 text-[#1268e8]" aria-hidden="true" /><p className="text-xs leading-5 text-[#526477]">Food recognition, serving sizes, nutrition values, and glucose predictions are estimates. Users should review meal details before using them as personal context.</p></div>
          </div>
        </div>
      </div>
    </section>
  );
}
