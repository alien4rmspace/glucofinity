import type { GlucoseInsight, NutritionEstimate } from './ai';
import type { ProductConsumptionContext } from './product-scoring';

export type GlucoseTrend =
  | 'rapidly-rising'
  | 'rising'
  | 'steady'
  | 'falling'
  | 'rapidly-falling';

export type GlucoseReadingSource =
  | 'mock'
  | 'healthkit'
  | 'health-connect'
  | 'import';

export interface GlucoseReading {
  id: string;
  timestamp: string;
  valueMgDl: number;
  trend: GlucoseTrend;
  source: GlucoseReadingSource;
  deviceName?: string;
  sourceRecordId?: string;
}

export interface GlucoseReadingTimeRange {
  startTime: string;
  endTime: string;
  endsAtLatestReading: boolean;
}

export type GlucoseDataSource = 'mock' | 'healthkit' | 'health-connect' | 'none';

export interface MealEntry {
  id: string;
  timestamp: string;
  timezoneOffsetMinutes?: number;
  name: string;
  description?: string;
  imageUri?: string;
  estimatedCarbsGrams?: number;
  proteinGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  notes?: string;
  nutritionEstimate?: NutritionEstimate;
  productContext?: ProductConsumptionContext;
}

export interface ExerciseEntry {
  id: string;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  activityType: string;
  intensity?: 'low' | 'moderate' | 'high';
  source?: 'healthkit';
  sourceRecordId?: string;
  sourceName?: string;
}

export interface DailyFitnessSummary {
  startTime: string;
  endTime: string;
  stepCount?: number;
  activeEnergyKilocalories?: number;
  workouts: ExerciseEntry[];
  source: 'healthkit';
}

export interface SleepEntry {
  id: string;
  startTime: string;
  endTime: string;
  durationMinutes?: number;
}

export type FeelingRating = 1 | 2 | 3 | 4 | 5;

export type FeelingSensation =
  | 'tired'
  | 'shaky'
  | 'lightheaded'
  | 'headache'
  | 'thirsty'
  | 'nauseated'
  | 'difficulty-concentrating'
  | 'other';

export interface FeelingCheckIn {
  id: string;
  timestamp: string;
  timezoneOffsetMinutes: number;
  overallFeeling: FeelingRating;
  energy?: FeelingRating;
  stress?: FeelingRating;
  focus?: FeelingRating;
  hunger?: FeelingRating;
  sensations: FeelingSensation[];
  notes?: string;
  source: 'manual';
}

export type MedicationLogStatus = 'taken' | 'skipped' | 'missed';

export type MedicationDoseUnit =
  | 'mg'
  | 'mcg'
  | 'g'
  | 'mL'
  | 'units'
  | 'tablet'
  | 'capsule'
  | 'other';

export type MedicationRoute =
  | 'oral'
  | 'injection'
  | 'topical'
  | 'inhaled'
  | 'sublingual'
  | 'other';

export interface MedicationEntry {
  id: string;
  timestamp: string;
  timezoneOffsetMinutes: number;
  medicationName: string;
  doseAmount?: number;
  doseUnit?: MedicationDoseUnit;
  route?: MedicationRoute;
  status: MedicationLogStatus;
  notes?: string;
  source: 'manual';
}

export interface TargetRange {
  lowMgDl: number;
  highMgDl: number;
}

export type GlucoseDisplayRangePreset =
  | 'diabetes'
  | 'prediabetes-or-no-diabetes'
  | 'custom';

export interface UserSettings {
  units: 'mg/dL';
  targetRange: TargetRange;
  glucoseDisplayRangePreset: GlucoseDisplayRangePreset;
  glucoseDataSource: GlucoseDataSource;
}

export type GlucoseStatus = 'below-range' | 'in-range' | 'elevated' | 'very-high';

export interface GlucoseMinMax {
  minimum: number;
  maximum: number;
}

export interface MealGlucoseResponse {
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
  dataQuality: 'good' | 'limited' | 'insufficient';
}

export interface LargestRise {
  riseMgDl: number;
  from: GlucoseReading;
  to: GlucoseReading;
}

export interface HourlyGlucoseSummary {
  hour: number;
  averageMgDl: number;
  readingCount: number;
}

export type InsightObservation = GlucoseInsight;

export type {
  FoodEstimate,
  GlucoseInsight,
  MealAnalysis,
  MealPredictionFeatures,
  MealResponsePrediction,
  MealTrainingDataset,
  MealTrainingExample,
  ModelMetadata,
  NutritionEstimate,
  NutritionEstimateSource,
} from './ai';
