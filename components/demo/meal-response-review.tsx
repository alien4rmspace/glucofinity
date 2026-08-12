"use client";

import { Activity, Database, Info } from "lucide-react";
import { MealResponseChart } from "@/components/charts/glucose-charts";
import { DemoCard, DemoMetric, DemoNotice, DemoSectionHeading } from "@/components/demo/demo-ui";
import { demoGlucoseReadings } from "@/data/demo-data";
import { analyzeMealResponse, getMealResponseReadings } from "@/services/meal-glucose-response";
import type { DemoMeal, DemoSettings } from "@/types/demo";

export function MealResponseReview({
  meal,
  settings,
}: {
  meal: DemoMeal;
  settings: DemoSettings;
}) {
  const readings = settings.showMockData
    ? getMealResponseReadings(meal.timestamp, demoGlucoseReadings)
    : [];
  const response = analyzeMealResponse(meal, readings);

  if (!settings.showMockData) {
    return (
      <DemoCard className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#edf5ff] text-[#1268e8]">
            <Database className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-semibold text-[#0b1f33]">Mock glucose data is hidden</h3>
            <p className="mt-2 text-sm leading-6 text-[#64768a]">
              Turn the deterministic fictional readings back on in Settings to review a meal response.
            </p>
          </div>
        </div>
      </DemoCard>
    );
  }

  if (response.dataQuality === "insufficient") {
    return (
      <DemoCard className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#fff7e8] text-[#9a5b08]">
            <Info className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-semibold text-[#0b1f33]">Not enough glucose data</h3>
            <p className="mt-2 text-sm leading-6 text-[#64768a]">
              This session-only meal has no surrounding fictional readings. The prototype leaves the response unavailable instead of inventing values.
            </p>
          </div>
        </div>
      </DemoCard>
    );
  }

  const deviceName = readings.find((reading) => reading.deviceName)?.deviceName ?? "Mock source";
  const qualityLabel = response.dataQuality === "good" ? "Good coverage" : "Limited coverage";
  const qualityClassName = response.dataQuality === "good"
    ? "border-[#bfe4d7] bg-[#e8f8f2] text-[#087f6a]"
    : "border-[#ecd9b4] bg-[#fff9ec] text-[#8b570d]";

  return (
    <div className="grid gap-4">
      <DemoSectionHeading
        title="Observed glucose response"
        description={`Fictional readings from 30 minutes before through 3 hours after ${meal.name}.`}
        action={(
          <span className={`w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${qualityClassName}`}>
            {qualityLabel}
          </span>
        )}
      />

      {response.dataQuality === "limited" ? (
        <DemoNotice icon={<Info className="size-5" />} title="Some response metrics are unavailable" tone="amber">
          The baseline, timing coverage, or sampling intervals did not meet the prototype&apos;s complete-coverage rules. Missing intervals remain visible as gaps.
        </DemoNotice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DemoMetric label="Baseline" value={formatGlucose(response.baselineGlucoseMgDl)} helper="mg/dL estimated before meal" />
        <DemoMetric label="Peak" value={formatGlucose(response.peakGlucoseMgDl)} helper="mg/dL observed in window" />
        <DemoMetric label="Rise" value={formatSigned(response.glucoseRiseMgDl)} helper="mg/dL above baseline" />
        <DemoMetric label="Time to peak" value={formatMinutes(response.timeToPeakMinutes)} helper="after meal" />
        <DemoMetric label="1 hour" value={formatGlucose(response.glucoseAt60MinutesMgDl)} helper="mg/dL nearest 60 minutes" />
        <DemoMetric label="2 hours" value={formatGlucose(response.glucoseAt120MinutesMgDl)} helper="mg/dL nearest 120 minutes" />
        <DemoMetric label="Incremental AUC" value={formatGlucose(response.incrementalAuc)} helper="mg/dL x min above baseline" />
        <DemoMetric label="Return near baseline" value={formatMinutes(response.returnToBaselineMinutes)} helper="within 5 mg/dL" />
      </div>

      <DemoCard className="p-3 sm:p-5">
        <MealResponseChart
          readings={readings}
          mealTimestamp={meal.timestamp}
          baselineMgDl={response.baselineGlucoseMgDl}
          targetLow={settings.targetLow}
          targetHigh={settings.targetHigh}
        />
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[#e4ebf2] px-1 pt-4 text-xs text-[#64768a]">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-0.5 bg-[#7257d9]" />Meal time</span>
          <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-[#147b8c]" />Estimated baseline</span>
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-4 rounded-sm bg-[#dff7ef]" />Prototype range</span>
        </div>
      </DemoCard>

      <DemoNotice icon={<Activity className="size-5" />} title="Fictional source and method" tone="blue">
        {response.sampleCount} normalized mock readings from {deviceName}. Baseline and response metrics are descriptive calculations; they do not diagnose, explain causation, or recommend treatment changes.
      </DemoNotice>
    </div>
  );
}

function formatGlucose(value: number | undefined): string {
  return value === undefined ? "Not available" : String(Math.round(value));
}

function formatSigned(value: number | undefined): string {
  if (value === undefined) return "Not available";
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function formatMinutes(value: number | undefined): string {
  return value === undefined ? "Not available" : `${Math.round(value)} min`;
}
