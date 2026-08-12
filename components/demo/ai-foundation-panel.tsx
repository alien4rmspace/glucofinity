import {
  Binary,
  BrainCircuit,
  ChartNoAxesCombined,
  Eye,
  FileCheck2,
  MessageSquareText,
} from "lucide-react";
import { DemoCard, DemoNotice, DemoSectionHeading } from "@/components/demo/demo-ui";
import { demoGlucoseReadings } from "@/data/demo-data";
import {
  generateMealPredictionFeatures,
  isEligibleTrainingResponse,
} from "@/services/ai-foundation";
import type { DemoMeal } from "@/types/demo";
import type { MealGlucoseResponse } from "@/types/glucose";

const architecture = [
  { label: "Meal vision", status: "Fixture active", icon: Eye },
  { label: "Feature engine", status: "Versioned", icon: Binary },
  { label: "XGBoost", status: "No model loaded", icon: ChartNoAxesCombined },
  { label: "Forecasting", status: "Contract only", icon: BrainCircuit },
  { label: "Pattern evidence", status: "Calculated", icon: FileCheck2 },
  { label: "Explanation", status: "No external LLM", icon: MessageSquareText },
] as const;

export function AiFoundationPanel({
  meals,
  responses,
}: {
  meals: DemoMeal[];
  responses: MealGlucoseResponse[];
}) {
  const eligibleCount = responses.filter(isEligibleTrainingResponse).length;
  const selectedResponse = responses.find(isEligibleTrainingResponse);
  const selectedMeal = selectedResponse
    ? meals.find((meal) => meal.id === selectedResponse.mealId)
    : undefined;
  const generated = selectedMeal && selectedResponse
    ? generateMealPredictionFeatures(
      selectedMeal,
      selectedResponse,
      demoGlucoseReadings,
      meals,
    )
    : undefined;

  return (
    <section className="grid gap-4" aria-labelledby="ai-foundation-heading">
      <DemoSectionHeading
        id="ai-foundation-heading"
        title="AI/ML foundation"
        description="Specialized components remain separate. The demo calculates features and evidence, but it does not load a trained prediction or forecasting model."
      />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {architecture.map(({ label, status, icon: Icon }) => (
          <DemoCard key={label} className="flex items-center gap-3 p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#edf5ff] text-[#1268e8]">
              <Icon className="size-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#0b1f33]">{label}</p>
              <p className="mt-0.5 text-xs text-[#64768a]">{status}</p>
            </div>
          </DemoCard>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <DemoCard className="p-5 sm:p-6">
          <div className="flex flex-col gap-2 border-b border-[#e4ebf2] pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#7257d9]">Deterministic feature preview</p>
              <h3 className="mt-2 font-semibold text-[#0b1f33]">{selectedMeal?.name ?? "No eligible meal"}</h3>
            </div>
            <span className="w-fit rounded-full border border-[#cfc4fa] bg-[#f6f2ff] px-2.5 py-1 text-[11px] font-semibold text-[#6049bc]">
              {generated?.featureVersion ?? "Unavailable"}
            </span>
          </div>
          {generated ? (
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <FeatureValue label="Carbohydrates" value={formatFeature(generated.features.carbohydratesGrams, "g")} />
              <FeatureValue label="Baseline glucose" value={formatFeature(generated.features.baselineGlucoseMgDl, "mg/dL")} />
              <FeatureValue label="Recent mean" value={formatFeature(generated.features.recentGlucoseMeanMgDl, "mg/dL")} />
              <FeatureValue label="Recent slope" value={formatFeature(generated.features.recentGlucoseSlopeMgDlPerMinute, "mg/dL/min")} />
              <FeatureValue label="Previous-meal gap" value={formatFeature(generated.features.minutesSincePreviousMeal, "min")} />
              <FeatureValue label="Meal time" value={`${generated.features.hourOfDay.toFixed(2)} local demo hour`} />
            </dl>
          ) : <p className="mt-4 text-sm text-[#64768a]">No response currently meets the fictional eligibility rules.</p>}
          <p className="mt-4 rounded-lg bg-[#f7fafc] p-3 text-xs leading-5 text-[#64768a]">
            Sleep, recent exercise, and historical-similarity features are unavailable in this record. They remain missing rather than being changed to zero.
          </p>
        </DemoCard>

        <DemoCard className="p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#147b8c]">Training readiness</p>
          <p className="mt-3 text-3xl font-semibold text-[#0b1f33]">{eligibleCount} / {responses.length}</p>
          <p className="mt-1 text-sm leading-6 text-[#64768a]">fictional meal responses meet the complete-coverage eligibility rule</p>
          <dl className="mt-5 divide-y divide-[#e4ebf2] border-y border-[#e4ebf2] text-sm">
            <StatusRow label="Split method" value="Chronological" />
            <StatusRow label="Evaluation" value="MAE / RMSE / R²" />
            <StatusRow label="Model version" value="No evaluated model" />
          </dl>
        </DemoCard>
      </div>

      <DemoNotice icon={<ChartNoAxesCombined className="size-5" />} title="Observed remains separate from predicted" tone="amber">
        No meal-response prediction is displayed. A future prediction must pass model, feature-version, and provenance checks before reaching the interface.
      </DemoNotice>
    </section>
  );
}

function FeatureValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f7fafc] p-3">
      <dt className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#718096]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-[#0b1f33]">{value}</dd>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <dt className="text-[#64768a]">{label}</dt>
      <dd className="text-right font-semibold text-[#0b1f33]">{value}</dd>
    </div>
  );
}

function formatFeature(value: number | undefined, unit: string): string {
  return value === undefined ? "Not available" : `${value} ${unit}`;
}
