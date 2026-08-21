import type { MealTranscriptExtraction } from '@/services/meal-transcript-extraction';
import type { MedicationTranscriptExtraction } from '@/services/medication-transcript-extraction';

export type LocalMealModelAvailability =
  | 'available'
  | 'expo-go'
  | 'native-build-required'
  | 'unsupported-platform'
  | 'runtime-unavailable';

export interface LocalMealModelAccessState {
  availability: LocalMealModelAvailability;
  message: string;
}

export interface LocalMealLanguageProvider {
  readonly providerId: string;
  readonly modelId: string;
  getAccessState(): Promise<LocalMealModelAccessState>;
  prefetch(onProgress?: (progress: number) => void): Promise<void>;
  prepare(onProgress?: (progress: number) => void): Promise<void>;
  extractMeal(transcript: string): Promise<MealTranscriptExtraction>;
  extractMedication(
    transcript: string,
    referenceDate?: Date,
  ): Promise<MedicationTranscriptExtraction>;
  release(): void;
}
