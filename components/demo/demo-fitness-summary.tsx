import { Activity, Footprints, RefreshCcw } from "lucide-react";
import { DemoCard, DemoEmptyState, DemoMetric, DemoNotice, DemoSectionHeading } from "@/components/demo/demo-ui";
import { demoFitnessSummary } from "@/data/demo-data";
import type { DemoFitnessPreviewState, DemoTab } from "@/types/demo";

const demoNumberFormatter = new Intl.NumberFormat("en-US");

export function DemoFitnessSummary({
  previewState,
  onNavigate,
  onRetry,
}: {
  previewState: DemoFitnessPreviewState;
  onNavigate: (tab: DemoTab) => void;
  onRetry: () => void;
}) {
  const hasRecords = previewState === "records";
  const workoutMinutes = hasRecords
    ? demoFitnessSummary.workouts.reduce(
        (total, workout) => total + workout.durationMinutes,
        0,
      )
    : undefined;

  return (
    <section className="grid gap-4" aria-labelledby="fitness-context-heading">
      <DemoSectionHeading
        id="fitness-context-heading"
        title="Today’s fitness context"
        description="The iOS app displays permitted Apple Health activity as observed context that may be associated with glucose patterns, never as proof of cause."
        action={(
          <span className="w-fit rounded-full border border-[#cfc4fa] bg-[#f6f2ff] px-3 py-1.5 text-xs font-semibold text-[#6049bc]">
            Fictional UI preview
          </span>
        )}
      />

      {previewState === "not-selected" ? (
        <DemoEmptyState
          title="Apple Health is not selected"
          description="In the iOS app, Settings starts the read-only permission flow. This static website cannot open or read Apple Health."
          action={(
            <button
              type="button"
              onClick={() => onNavigate("settings")}
              className="rounded-lg border border-[#cbd8e4] bg-white px-4 py-2.5 text-sm font-semibold text-[#1268e8] hover:bg-[#f2f7fb]"
            >
              Open Settings preview
            </button>
          )}
        />
      ) : previewState === "unavailable" ? (
        <DemoEmptyState
          title="Fitness context unavailable"
          description="This previews the app’s safe error state when permitted Apple Health fitness records cannot be loaded."
          action={(
            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1268e8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f57c3]"
              >
                <RefreshCcw className="size-4" aria-hidden="true" /> Try again
              </button>
              <button
                type="button"
                onClick={() => onNavigate("settings")}
                className="rounded-lg border border-[#cbd8e4] bg-white px-4 py-2.5 text-sm font-semibold text-[#1268e8] hover:bg-[#f2f7fb]"
              >
                Review in Settings
              </button>
            </div>
          )}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DemoMetric
              label="Steps"
              value={hasRecords ? demoNumberFormatter.format(demoFitnessSummary.stepCount) : "—"}
              helper={hasRecords ? "fictional preview total" : "No permitted total"}
            />
            <DemoMetric
              label="Active energy"
              value={hasRecords ? demoNumberFormatter.format(demoFitnessSummary.activeEnergyKilocalories) : "—"}
              helper={hasRecords ? "fictional kcal total" : "No permitted total"}
            />
            <DemoMetric
              label="Workout time"
              value={workoutMinutes === undefined ? "—" : demoNumberFormatter.format(workoutMinutes)}
              helper={workoutMinutes === undefined ? "No permitted workouts" : "fictional minutes"}
            />
            <DemoMetric
              label="Workouts"
              value={hasRecords ? String(demoFitnessSummary.workouts.length) : "—"}
              helper={hasRecords ? "fictional records" : "No permitted records"}
            />
          </div>

          {hasRecords ? (
            <DemoCard className="p-5 sm:p-6">
              <div className="flex items-center gap-2 text-[#6049bc]">
                <Activity className="size-5" aria-hidden="true" />
                <h3 className="font-semibold text-[#0b1f33]">Recent workouts</h3>
              </div>
              <div className="mt-4 divide-y divide-[#e4ebf2]">
                {demoFitnessSummary.workouts
                  .slice()
                  .reverse()
                  .map((workout) => (
                    <div key={workout.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#0b1f33]">{workout.activityType}</p>
                        <p className="mt-1 text-xs leading-5 text-[#718096]">
                          Started {workout.startTime} · {workout.sourceName}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm text-[#64768a]">{workout.durationMinutes} min</p>
                    </div>
                  ))}
              </div>
            </DemoCard>
          ) : (
            <DemoNotice icon={<Footprints className="size-5" />} title="No permitted fitness records today" tone="neutral">
              In the iOS app, this can mean no activity was recorded or read access was not allowed. HealthKit does not let the app distinguish those cases.
            </DemoNotice>
          )}

          <DemoNotice icon={<Footprints className="size-5" />} title="Website preview only" tone="purple">
            These fitness values are deterministic fictional examples. This static website does not request, receive, store, or upload Apple Health records.
          </DemoNotice>
        </>
      )}
    </section>
  );
}
