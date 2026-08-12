export type GlucosePoint = {
  time: string;
  glucose: number;
};

export type PostMealPoint = {
  minutes: number;
  glucose: number;
};

export type DemoGlucoseReadingSource =
  | "mock"
  | "healthkit"
  | "health-connect"
  | "import";

export type DemoGlucoseReading = {
  id: string;
  timestamp: string;
  valueMgDl: number;
  source: DemoGlucoseReadingSource;
  deviceName?: string;
  sourceRecordId?: string;
};

export type MealGlucoseResponse = {
  mealId: string;
  baselineGlucoseMgDl?: number;
  peakGlucoseMgDl?: number;
  glucoseRiseMgDl?: number;
  timeToPeakMinutes?: number;
  glucoseAt60MinutesMgDl?: number;
  glucoseAt120MinutesMgDl?: number;
  incrementalAuc?: number;
  returnToBaselineMinutes?: number;
  sampleCount: number;
  dataQuality: "good" | "limited" | "insufficient";
};

export type Feature = {
  title: string;
  description: string;
  icon: string;
};

export type Insight = {
  category: string;
  title: string;
  description: string;
  context: string;
  icon: string;
};

export type MealEstimate = {
  food: string;
  serving: string;
  carbohydrates: number;
  confidence: number;
};

export type TechnologyStage = {
  label: string;
  title: string;
  description: string;
  items: string[];
  icon: string;
};
