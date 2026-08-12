"use client";

import { Activity, Camera, Plus, Trash2, Utensils } from "lucide-react";
import { type FormEvent, useState } from "react";
import { MealResponseReview } from "@/components/demo/meal-response-review";
import { DemoCard, DemoNotice, DemoSectionHeading } from "@/components/demo/demo-ui";
import { mealVisionProvider } from "@/services/meal-vision-provider";
import type { NutritionEstimateSource } from "@/types/ai";
import type { DemoMeal, DemoMealDraft, DemoSettings } from "@/types/demo";

const emptyDraft: DemoMealDraft = {
  name: "",
  time: "12:00 PM",
  carbohydrates: undefined,
  protein: undefined,
  fat: undefined,
  fiber: undefined,
  calories: undefined,
  foods: "",
  note: "",
  source: "manual",
  nutritionSource: "manual",
};

export function DemoMeals({
  meals,
  settings,
  onAddMeal,
  onDeleteMeal,
}: {
  meals: DemoMeal[];
  settings: DemoSettings;
  onAddMeal: (meal: DemoMealDraft) => void;
  onDeleteMeal: (id: string) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<DemoMealDraft>(emptyDraft);
  const [message, setMessage] = useState("");
  const [selectedMealId, setSelectedMealId] = useState("meal-lunch");
  const selectedMeal = meals.find((meal) => meal.id === selectedMealId);

  async function simulateEstimate() {
    const analysis = await mealVisionProvider.analyzeMeal(
      "demo://meal-placeholder",
      "Vegetable grain bowl",
    );
    setDraft({
      name: analysis.foods.map((food) => food.name).join(", "),
      time: "1:15 PM",
      carbohydrates: analysis.totalCarbohydratesGrams ?? 0,
      protein: analysis.totalProteinGrams ?? 0,
      fat: analysis.totalFatGrams ?? 0,
      fiber: analysis.totalFiberGrams ?? 0,
      calories: analysis.totalCalories ?? 0,
      foods: analysis.foods.map((food) => food.name).join(", "),
      note: "Simulated estimate for demonstration; values require user review.",
      source: "simulated-estimate",
      nutritionSource: "ai-estimated",
      analysisProvider: analysis.providerId,
      analysisModel: analysis.model,
      analysisGeneratedAt: analysis.generatedAt,
    });
    setMessage("A structured fictional estimate was added. Editing a nutrition field records it as user-corrected.");
    setFormOpen(true);
  }

  function submitMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) {
      setMessage("Enter a meal name before adding it.");
      return;
    }

    onAddMeal({ ...draft, name: draft.name.trim(), note: draft.note.trim() });
    setDraft(emptyDraft);
    setMessage("Meal added to this browser session.");
    setFormOpen(false);
  }

  function updateNutritionNumber(
    field: "calories" | "carbohydrates" | "protein" | "fat" | "fiber",
    value: string,
  ) {
    const parsed = value.trim() ? Number(value) : undefined;
    setDraft((current) => ({
      ...current,
      [field]: parsed !== undefined && Number.isFinite(parsed) ? Math.max(0, parsed) : undefined,
      nutritionSource: correctedSource(current.nutritionSource),
    }));
  }

  function selectMeal(mealId: string) {
    setSelectedMealId(mealId);
    window.requestAnimationFrame(() => {
      document.getElementById("meal-response-review")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function removeMeal(mealId: string) {
    onDeleteMeal(mealId);
    if (selectedMealId === mealId) setSelectedMealId("");
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7257d9]">Meals</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#0b1f33] sm:text-4xl">Review meal context</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64768a]">Review computed response metrics for seeded meals, or add a session-only meal manually. Entries exist only in this open browser session.</p>
        </div>
        <button type="button" onClick={() => setFormOpen((current) => !current)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1268e8] px-4 text-sm font-semibold text-white hover:bg-[#0f57c3]" aria-expanded={formOpen}>
          <Plus className="size-4" aria-hidden="true" /> {formOpen ? "Close form" : "Add meal"}
        </button>
      </div>

      <DemoNotice icon={<Camera className="size-5" />} title="Simulated meal analysis" tone="purple">
        No image-recognition or nutrition service is connected. The simulation fills the form with fixed fictional values and does not inspect or upload a photo.
      </DemoNotice>

      <div>
        <button type="button" onClick={() => void simulateEstimate()} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#cfc4fa] bg-[#f5f2ff] px-4 text-sm font-semibold text-[#6049bc] hover:bg-[#ede8ff]">
          <Camera className="size-4" aria-hidden="true" /> Load simulated estimate
        </button>
        <p className="mt-2 min-h-5 text-xs text-[#64768a]" aria-live="polite">{message}</p>
      </div>

      {formOpen ? (
        <DemoCard className="p-5 sm:p-6">
          <form onSubmit={submitMeal} className="grid gap-5">
            <DemoSectionHeading title="Meal details" description="Review all estimated values before adding the entry." />
            <div className="rounded-lg border border-[#ddd5fb] bg-[#f7f4ff] p-4">
              <p className="text-sm font-semibold text-[#6049bc]">{nutritionSourceLabel(draft.nutritionSource)}</p>
              <p className="mt-1 text-xs leading-5 text-[#64768a]">
                {draft.nutritionSource === "manual"
                  ? "Nutrition was entered manually in this browser session."
                  : draft.nutritionSource === "ai-estimated"
                    ? "This deterministic provider estimate still requires review."
                    : "At least one generated food or nutrition value was changed by the user."}
              </p>
              {draft.analysisModel ? <p className="mt-2 text-[11px] text-[#718096]">Fixture provenance: {draft.analysisProvider} · {draft.analysisModel}</p> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-[#34495e] sm:col-span-2">
                Meal name
                <input required value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value, source: current.source === "simulated-estimate" ? current.source : "manual" }))} className="h-11 rounded-lg border border-[#cbd8e4] bg-white px-3 font-normal text-[#0b1f33]" placeholder="Example: Vegetable grain bowl" />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-[#34495e]">
                Time
                <input value={draft.time} onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))} className="h-11 rounded-lg border border-[#cbd8e4] bg-white px-3 font-normal text-[#0b1f33]" />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-[#34495e] sm:col-span-2">
                Foods (comma separated)
                <input value={draft.foods} onChange={(event) => setDraft((current) => ({ ...current, foods: event.target.value, nutritionSource: correctedSource(current.nutritionSource) }))} className="h-11 rounded-lg border border-[#cbd8e4] bg-white px-3 font-normal text-[#0b1f33]" placeholder="Example: Brown rice, salmon, vegetables" />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-[#34495e]">
                Estimated calories
                <input type="number" min="0" max="10000" value={draft.calories ?? ""} onChange={(event) => updateNutritionNumber("calories", event.target.value)} className="h-11 rounded-lg border border-[#cbd8e4] bg-white px-3 font-normal text-[#0b1f33]" />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-[#34495e]">
                Estimated carbohydrates (g)
                <input type="number" min="0" max="10000" value={draft.carbohydrates ?? ""} onChange={(event) => updateNutritionNumber("carbohydrates", event.target.value)} className="h-11 rounded-lg border border-[#cbd8e4] bg-white px-3 font-normal text-[#0b1f33]" />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-[#34495e]">
                Estimated protein (g)
                <input type="number" min="0" max="10000" value={draft.protein ?? ""} onChange={(event) => updateNutritionNumber("protein", event.target.value)} className="h-11 rounded-lg border border-[#cbd8e4] bg-white px-3 font-normal text-[#0b1f33]" />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-[#34495e]">
                Estimated fat (g)
                <input type="number" min="0" max="10000" value={draft.fat ?? ""} onChange={(event) => updateNutritionNumber("fat", event.target.value)} className="h-11 rounded-lg border border-[#cbd8e4] bg-white px-3 font-normal text-[#0b1f33]" />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-[#34495e]">
                Estimated fiber (g)
                <input type="number" min="0" max="10000" value={draft.fiber ?? ""} onChange={(event) => updateNutritionNumber("fiber", event.target.value)} className="h-11 rounded-lg border border-[#cbd8e4] bg-white px-3 font-normal text-[#0b1f33]" />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-[#34495e] sm:col-span-2">
                Notes
                <textarea value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} rows={3} className="rounded-lg border border-[#cbd8e4] bg-white px-3 py-2.5 font-normal text-[#0b1f33]" placeholder="Optional fictional context" />
              </label>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setFormOpen(false)} className="h-11 rounded-lg border border-[#cbd8e4] px-4 text-sm font-semibold text-[#34495e] hover:bg-[#f7fafc]">Cancel</button>
              <button type="submit" className="h-11 rounded-lg bg-[#1268e8] px-4 text-sm font-semibold text-white hover:bg-[#0f57c3]">Add to session</button>
            </div>
          </form>
        </DemoCard>
      ) : null}

      {selectedMeal ? (
        <section
          id="meal-response-review"
          aria-label={`Glucose response for ${selectedMeal.name}`}
          className="scroll-mt-24"
        >
          <MealResponseReview meal={selectedMeal} settings={settings} />
        </section>
      ) : null}

      <section className="grid gap-4" aria-labelledby="meal-log-heading">
        <DemoSectionHeading id="meal-log-heading" title="Meal log" description={`${meals.length} fictional or session-only entries`} />
        {meals.length === 0 ? (
          <DemoCard className="p-8 text-center">
            <Utensils className="mx-auto size-7 text-[#718096]" aria-hidden="true" />
            <p className="mt-3 font-semibold text-[#0b1f33]">No meals in this session</p>
            <p className="mt-1 text-sm text-[#64768a]">Add a manual entry or load the simulated estimate.</p>
          </DemoCard>
        ) : (
          <div className="grid gap-3">
            {meals.map((meal) => (
              <DemoCard key={meal.id} className="p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#f0edff] text-[#7257d9]"><Utensils className="size-5" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div><h3 className="font-semibold text-[#0b1f33]">{meal.name}</h3><p className="mt-1 text-xs text-[#718096]">{meal.time} · {meal.source === "simulated-estimate" ? "Simulated estimate" : meal.source === "manual" ? "Session entry" : "Fictional seed entry"} · {nutritionSourceLabel(meal.nutritionSource)}</p></div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          aria-pressed={selectedMealId === meal.id}
                          aria-label={selectedMealId === meal.id ? `Glucose response selected for ${meal.name}` : `Review glucose response for ${meal.name}`}
                          onClick={() => selectMeal(meal.id)}
                          className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold ${selectedMealId === meal.id ? "border-[#b8d3f0] bg-[#edf5ff] text-[#0e5ab7]" : "border-[#dce5ee] text-[#526477] hover:bg-[#f2f7fb]"}`}
                        >
                          <Activity className="size-4" aria-hidden="true" />
                          {selectedMealId === meal.id ? "Response selected" : "Review response"}
                        </button>
                        <button type="button" onClick={() => removeMeal(meal.id)} aria-label={`Remove ${meal.name}`} className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#ead3d3] text-[#a43b3b] hover:bg-[#fff1f1]"><Trash2 className="size-4" aria-hidden="true" /></button>
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
                      <div className="rounded-lg bg-[#f7fafc] p-2"><dt className="text-[11px] text-[#718096]">Calories</dt><dd className="mt-1 text-sm font-semibold text-[#0b1f33]">{formatNutrition(meal.calories)}</dd></div>
                      <div className="rounded-lg bg-[#f7fafc] p-2"><dt className="text-[11px] text-[#718096]">Carbs</dt><dd className="mt-1 text-sm font-semibold text-[#0b1f33]">{formatNutrition(meal.carbohydrates, "g")}</dd></div>
                      <div className="rounded-lg bg-[#f7fafc] p-2"><dt className="text-[11px] text-[#718096]">Protein</dt><dd className="mt-1 text-sm font-semibold text-[#0b1f33]">{formatNutrition(meal.protein, "g")}</dd></div>
                      <div className="rounded-lg bg-[#f7fafc] p-2"><dt className="text-[11px] text-[#718096]">Fat</dt><dd className="mt-1 text-sm font-semibold text-[#0b1f33]">{formatNutrition(meal.fat, "g")}</dd></div>
                      <div className="rounded-lg bg-[#f7fafc] p-2"><dt className="text-[11px] text-[#718096]">Fiber</dt><dd className="mt-1 text-sm font-semibold text-[#0b1f33]">{formatNutrition(meal.fiber, "g")}</dd></div>
                    </dl>
                    <p className="mt-3 text-xs leading-5 text-[#64768a]">Foods: {meal.foods || "Not specified"}</p>
                    {meal.note ? <p className="mt-3 text-xs leading-5 text-[#64768a]">{meal.note}</p> : null}
                  </div>
                </div>
              </DemoCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function correctedSource(source: NutritionEstimateSource): NutritionEstimateSource {
  return source === "ai-estimated" ? "ai-corrected" : source;
}

function nutritionSourceLabel(source: NutritionEstimateSource): string {
  if (source === "ai-estimated") return "AI-estimated nutrition";
  if (source === "ai-corrected") return "User-corrected AI estimate";
  return "Manual nutrition";
}

function formatNutrition(value: number | undefined, unit = ""): string {
  return value === undefined ? "Not available" : `${value}${unit ? ` ${unit}` : ""}`;
}
