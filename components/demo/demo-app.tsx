"use client";

import { BarChart3, LayoutDashboard, Lightbulb, Settings, Utensils } from "lucide-react";
import { useRef, useState } from "react";
import { DemoDashboard } from "@/components/demo/demo-dashboard";
import { DemoInsights } from "@/components/demo/demo-insights";
import { DemoMeals } from "@/components/demo/demo-meals";
import { DemoSettingsPanel } from "@/components/demo/demo-settings";
import { DemoTrends } from "@/components/demo/demo-trends";
import { defaultDemoSettings, initialDemoMeals } from "@/data/demo-data";
import type { DemoMeal, DemoMealDraft, DemoSettings, DemoTab } from "@/types/demo";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "meals", label: "Meals", icon: Utensils },
  { id: "trends", label: "Trends", icon: BarChart3 },
  { id: "insights", label: "Insights", icon: Lightbulb },
  { id: "settings", label: "Settings", icon: Settings },
] satisfies { id: DemoTab; label: string; icon: typeof LayoutDashboard }[];

export function DemoApp() {
  const [activeTab, setActiveTab] = useState<DemoTab>("dashboard");
  const [meals, setMeals] = useState<DemoMeal[]>(() => initialDemoMeals.map((meal) => ({ ...meal })));
  const [settings, setSettings] = useState<DemoSettings>({ ...defaultDemoSettings });
  const nextMealId = useRef(1);

  function navigate(tab: DemoTab) {
    setActiveTab(tab);
    window.history.replaceState(null, "", `#${tab}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addMeal(draft: DemoMealDraft) {
    const id = `session-meal-${nextMealId.current}`;
    nextMealId.current += 1;
    setMeals((current) => [{ ...draft, id }, ...current]);
  }

  function resetDemo() {
    setMeals(initialDemoMeals.map((meal) => ({ ...meal })));
    setSettings({ ...defaultDemoSettings });
    nextMealId.current = 1;
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:px-8 lg:py-10">
      <aside className="rounded-lg border border-[#dce5ee] bg-white p-2 lg:sticky lg:top-24" aria-label="Demo sections">
        <nav className="flex gap-1 overflow-x-auto lg:grid" aria-label="Interactive prototype navigation">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`demo-tab-${tab.id}`}
                type="button"
                aria-current={selected ? "page" : undefined}
                aria-controls="demo-panel"
                onClick={() => navigate(tab.id)}
                className={`inline-flex min-w-fit items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold lg:w-full ${selected ? "bg-[#1268e8] text-white" : "text-[#526477] hover:bg-[#f2f7fb] hover:text-[#0b1f33]"}`}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-2 hidden border-t border-[#e4ebf2] px-3 py-4 lg:block">
          <p className="text-xs font-semibold text-[#34495e]">Session-only prototype</p>
          <p className="mt-1 text-[11px] leading-5 text-[#718096]">Changes reset when this page reloads.</p>
        </div>
      </aside>

      <section id="demo-panel" aria-labelledby={`demo-tab-${activeTab}`} className="min-w-0">
        {activeTab === "dashboard" ? <DemoDashboard settings={settings} mealCount={meals.length} onNavigate={navigate} /> : null}
        {activeTab === "meals" ? <DemoMeals meals={meals} onAddMeal={addMeal} onDeleteMeal={(id) => setMeals((current) => current.filter((meal) => meal.id !== id))} /> : null}
        {activeTab === "trends" ? <DemoTrends settings={settings} meals={meals} onNavigate={navigate} /> : null}
        {activeTab === "insights" ? <DemoInsights settings={settings} meals={meals} onNavigate={navigate} /> : null}
        {activeTab === "settings" ? <DemoSettingsPanel settings={settings} onChange={setSettings} onReset={resetDemo} /> : null}
      </section>
    </div>
  );
}
