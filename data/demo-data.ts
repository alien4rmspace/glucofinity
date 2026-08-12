import type { DemoMeal, DemoSettings } from "@/types/demo";
import type { DemoGlucoseReading } from "@/types/glucose";

const MINUTE_MS = 60_000;

type ResponseProfile = {
  mealId: string;
  mealTimestamp: string;
  points: readonly [minutes: number, valueMgDl: number][];
};

function buildResponseReadings(profile: ResponseProfile): DemoGlucoseReading[] {
  const mealTime = Date.parse(profile.mealTimestamp);
  return profile.points.map(([minutes, valueMgDl]) => {
    const timestamp = new Date(mealTime + minutes * MINUTE_MS).toISOString();
    const sourceRecordId = `${profile.mealId}-${minutes}`;
    return {
      id: `mock:${sourceRecordId}`,
      timestamp,
      valueMgDl,
      source: "mock",
      deviceName: "Deterministic demo generator",
      sourceRecordId,
    };
  });
}

export const initialDemoMeals: DemoMeal[] = [
  {
    id: "meal-breakfast",
    timestamp: "2026-08-09T08:10:00.000Z",
    name: "Oatmeal with berries",
    time: "8:10 AM",
    carbohydrates: 48,
    protein: 12,
    fat: 9,
    note: "Fictional breakfast entry",
    source: "seed",
  },
  {
    id: "meal-lunch",
    timestamp: "2026-08-09T12:35:00.000Z",
    name: "Salmon rice bowl",
    time: "12:35 PM",
    carbohydrates: 63,
    protein: 34,
    fat: 18,
    note: "Fictional lunch entry with a 24-minute walk logged afterward",
    source: "seed",
  },
  {
    id: "meal-dinner",
    timestamp: "2026-08-09T18:42:00.000Z",
    name: "Lentil vegetable soup",
    time: "6:42 PM",
    carbohydrates: 41,
    protein: 19,
    fat: 8,
    note: "Fictional dinner entry",
    source: "seed",
  },
];

const responseProfiles: ResponseProfile[] = [
  {
    mealId: "meal-breakfast",
    mealTimestamp: initialDemoMeals[0].timestamp,
    points: [
      [-30, 101], [-15, 102], [0, 103], [15, 112], [30, 129],
      [45, 144], [60, 151], [75, 148], [90, 139], [105, 129],
      [120, 119], [135, 111], [150, 106], [165, 103], [180, 101],
    ],
  },
  {
    mealId: "meal-lunch",
    mealTimestamp: initialDemoMeals[1].timestamp,
    points: [
      [-30, 109], [-15, 110], [0, 111], [15, 123], [30, 141],
      [45, 158], [60, 167], [75, 162], [90, 151], [105, 141],
      [120, 132], [135, 124], [150, 117], [165, 114], [180, 111],
    ],
  },
  {
    mealId: "meal-dinner",
    mealTimestamp: initialDemoMeals[2].timestamp,
    points: [
      [-30, 112], [-15, 113], [0, 114], [30, 139], [60, 154],
      [90, 145], [120, 131], [180, 116],
    ],
  },
];

export const demoGlucoseReadings: DemoGlucoseReading[] = responseProfiles
  .flatMap(buildResponseReadings)
  .sort((first, second) => Date.parse(first.timestamp) - Date.parse(second.timestamp));

export const defaultDemoSettings: DemoSettings = {
  showMockData: true,
  targetLow: 70,
  targetHigh: 180,
};
