import type { GroupedObservation } from "@/services/ai-foundation";

export const exerciseContextFixture: {
  withRecentExercise: GroupedObservation[];
  withoutRecentExercise: GroupedObservation[];
} = {
  withRecentExercise: [
    { occurredAt: "2026-08-01T12:00:00.000Z", value: 29 },
    { occurredAt: "2026-08-03T12:00:00.000Z", value: 33 },
    { occurredAt: "2026-08-05T12:00:00.000Z", value: 31 },
  ],
  withoutRecentExercise: [
    { occurredAt: "2026-08-02T12:00:00.000Z", value: 44 },
    { occurredAt: "2026-08-04T12:00:00.000Z", value: 41 },
    { occurredAt: "2026-08-06T12:00:00.000Z", value: 45 },
  ],
};
