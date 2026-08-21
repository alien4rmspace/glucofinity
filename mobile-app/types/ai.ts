import type { GlucoseReadingSource, MealGlucoseResponse } from './health';

export type NutritionEstimateSource =
  | 'manual'
  | 'usda-label'
  | 'ai-estimated'
  | 'ai-corrected';

export interface FoodEstimate {
  name: string;
  estimatedGrams?: number;
  calories?: number;
  carbohydratesGrams?: number;
  proteinGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  confidence?: number;
}
export interface MealAnalysis {
  foods: FoodEstimate[];
  totalCalories?: number;
  totalCarbohydratesGrams?: number;
  totalProteinGrams?: number;
  totalFatGrams?: number;
  totalFiberGrams?: number;
  confidence?: number;
  providerId?: string;
  model?: string;
  generatedAt: string;
}

/**
 * Persisted, user-reviewable nutrition. Optional metadata keeps older locally
 * stored manual entries readable while all new AI estimates remain traceable.
 */
export interface NutritionEstimate {
  foods?: FoodEstimate[];
  calories?: number;
  carbohydratesGrams?: number;
  proteinGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  confidence?: number;
  source: NutritionEstimateSource;
  providerId?: string;
  model?: string;
  generatedAt?: string;
}

export interface MealPredictionFeatures {
  carbohydratesGrams?: number;
  proteinGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  calories?: number;
  estimatedMealGrams?: number;
  baselineGlucoseMgDl?: number;
  recentGlucoseSlopeMgDlPerMinute?: number;
  recentGlucoseMeanMgDl?: number;
  recentGlucoseVariabilityMgDl?: number;
  minutesSincePreviousMeal?: number;
  hourOfDay: number;
  dayOfWeek: number;
  recentExerciseMinutes?: number;
  sleepDurationHours?: number;
  historicalSimilarMealResponseMgDl?: number;
}

export interface GeneratedMealPredictionFeatures {
  featureVersion: string;
  mealId: string;
  mealTimestamp: string;
  features: MealPredictionFeatures;
}

export interface MealTrainingLabels {
  glucoseRiseMgDl?: number;
  peakGlucoseMgDl?: number;
  timeToPeakMinutes?: number;
  glucoseAt120MinutesMgDl?: number;
  incrementalAuc?: number;
}

export interface MealTrainingExample {
  exampleId: string;
  mealId: string;
  occurredAt: string;
  featureVersion: string;
  features: MealPredictionFeatures;
  labels: MealTrainingLabels;
  dataQuality: MealGlucoseResponse['dataQuality'];
  eligibleForTraining: boolean;
  exclusionReasons: string[];
  glucoseSources: GlucoseReadingSource[];
}

export interface MealTrainingDataset {
  schemaVersion: string;
  generatedAt: string;
  dataOrigin: 'authorized-user-export' | 'synthetic-fixture';
  examples: MealTrainingExample[];
}

export interface ModelEvaluationMetrics {
  mae?: number;
  rmse?: number;
  rSquared?: number;
}

export interface ModelMetadata {
  modelId: string;
  modelType: string;
  version: string;
  trainedAt?: string;
  trainingSampleCount?: number;
  metrics?: ModelEvaluationMetrics;
  featureVersion: string;
  dataOrigin?: 'authorized-user-export' | 'synthetic-fixture';
}

export interface MealResponsePrediction {
  kind: 'predicted';
  predictedRiseMgDl?: number;
  predictedPeakMgDl?: number;
  predictedTimeToPeakMinutes?: number;
  predicted120MinuteGlucoseMgDl?: number;
  predictedIncrementalAuc?: number;
  confidence?: number;
  modelId: string;
  modelVersion: string;
  featureVersion: string;
  generatedAt: string;
}

export interface InsightEvidenceMetric {
  label: string;
  value: number;
  unit?: string;
}

export interface InsightComparisonGroup {
  label: string;
  sampleSize: number;
  meanValue: number;
  unit: string;
}

export interface InsightEvidence {
  sampleSize: number;
  dateRange?: {
    start: string;
    end: string;
  };
  metricDifference?: number;
  confidence?: number;
  metrics?: InsightEvidenceMetric[];
  comparisonGroups?: InsightComparisonGroup[];
}

export interface GlucoseInsight {
  id: string;
  type: 'meal' | 'stability' | 'range' | 'comparison' | 'general';
  title: string;
  description: string;
  evidence: InsightEvidence;
  generatedAt: string;
}
