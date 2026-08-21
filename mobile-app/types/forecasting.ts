import type { GlucoseReadingSource, MealEntry } from './health';
import type { ModelMetadata } from './ai';

export type GlucoseForecastHorizonMinutes = 15 | 30 | 45 | 60 | 90 | 120;

export interface GlucoseForecastContext {
  generatedAt: string;
  lookbackMinutes: number;
  glucoseSequenceMgDl: number[];
  glucoseSequenceTimestamps: string[];
  mealEvents?: MealEntry[];
  recentExerciseMinutes?: number;
  sleepDurationHours?: number;
  glucoseSources: GlucoseReadingSource[];
}
export interface GlucoseForecastPoint {
  horizonMinutes: GlucoseForecastHorizonMinutes;
  predictedGlucoseMgDl: number;
}

export interface GlucoseForecast {
  kind: 'predicted';
  points: GlucoseForecastPoint[];
  modelId: string;
  modelVersion: string;
  featureVersion: string;
  generatedAt: string;
}

export interface ContinuousGlucoseForecaster {
  readonly metadata: ModelMetadata;
  forecast(context: GlucoseForecastContext): Promise<GlucoseForecast>;
}
