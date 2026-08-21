import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import {
  buildMealTranscriptMessages,
  extractGroundedMealFromTranscript,
  parseMealTranscriptExtraction,
  type MealTranscriptExtraction,
} from '@/services/meal-transcript-extraction';
import {
  buildMedicationTranscriptMessages,
  extractGroundedMedicationFromTranscript,
  parseMedicationTranscriptExtraction,
  type MedicationTranscriptExtraction,
} from '@/services/medication-transcript-extraction';
import type {
  LocalMealLanguageProvider,
  LocalMealModelAccessState,
} from '@/services/local-meal-language-provider.types';

type LLMInstance = import('react-native-executorch').LLMModule;

export type {
  LocalMealModelAccessState,
  LocalMealModelAvailability,
} from '@/services/local-meal-language-provider.types';

const PROVIDER_ID = 'react-native-executorch-local-v0.9.3';
const MODEL_ID = 'lfm2.5-1.2b-instruct-8da4w-rne-v0.9.0';

let initialized = false;
let loadedModel: LLMInstance | undefined;
let modelLoadPromise: Promise<void> | undefined;
let releaseAfterLoad = false;
let generationInProgress = false;
let releaseAfterGeneration = false;

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

async function loadRuntime() {
  return Promise.all([
    import('react-native-executorch'),
    import('react-native-executorch-expo-resource-fetcher'),
  ]);
}

export const localMealLanguageProvider: LocalMealLanguageProvider = {
  providerId: PROVIDER_ID,
  modelId: MODEL_ID,

  async getAccessState(): Promise<LocalMealModelAccessState> {
    if (Platform.OS !== 'ios') {
      return {
        availability: 'unsupported-platform',
        message: 'The local model is currently configured for the iOS voice workflow.',
      };
    }
    if (isExpoGo()) {
      return {
        availability: 'expo-go',
        message: 'The local model requires an iOS development build, not Expo Go.',
      };
    }
    try {
      const [executorch] = await loadRuntime();
      if (!executorch.isAvailable) {
        return {
          availability: 'runtime-unavailable',
          message: 'This device cannot load the included on-device model runtime.',
        };
      }
      return {
        availability: 'available',
        message: 'The local model can be prepared on this device.',
      };
    } catch {
      return {
        availability: 'native-build-required',
        message: 'Rebuild the iOS app to include the local model runtime.',
      };
    }
  },

  async prefetch(onProgress?: (progress: number) => void): Promise<void> {
    const access = await this.getAccessState();
    if (access.availability !== 'available') throw new Error(access.message);

    const [executorch, resourceFetcher] = await loadRuntime();
    if (!initialized) {
      executorch.initExecutorch({
        resourceFetcher: resourceFetcher.ExpoResourceFetcher,
      });
      initialized = true;
    }
    const model = executorch.models.llm.lfm2_5_1_2b_instruct({ quant: true });
    await resourceFetcher.ExpoResourceFetcher.fetch(
      onProgress,
      model.modelSource,
      model.tokenizerSource,
      model.tokenizerConfigSource
    );
  },

  async prepare(onProgress?: (progress: number) => void): Promise<void> {
    if (loadedModel) {
      releaseAfterGeneration = false;
      onProgress?.(1);
      return;
    }
    if (modelLoadPromise) {
      releaseAfterLoad = false;
      await modelLoadPromise;
      onProgress?.(1);
      return;
    }
    const access = await this.getAccessState();
    if (access.availability !== 'available') throw new Error(access.message);

    releaseAfterLoad = false;
    modelLoadPromise = (async () => {
      const [executorch, resourceFetcher] = await loadRuntime();
      if (!initialized) {
        executorch.initExecutorch({
          resourceFetcher: resourceFetcher.ExpoResourceFetcher,
        });
        initialized = true;
      }
      const model = await executorch.LLMModule.fromModelName(
        executorch.models.llm.lfm2_5_1_2b_instruct({ quant: true }),
        onProgress
      );
      model.configure({
        generationConfig: {
          temperature: 0.1,
          repetitionPenalty: 1.05,
        },
      });
      if (releaseAfterLoad) {
        model.delete();
      } else {
        loadedModel = model;
      }
    })();
    try {
      await modelLoadPromise;
    } finally {
      modelLoadPromise = undefined;
    }
  },

  async extractMeal(transcript: string): Promise<MealTranscriptExtraction> {
    if (!loadedModel) {
      throw new Error('Prepare the local meal model before using voice entry.');
    }
    if (generationInProgress) {
      throw new Error('The local meal model is already preparing a draft.');
    }
    generationInProgress = true;
    try {
      const modelOutput = await loadedModel.generate(
        buildMealTranscriptMessages(transcript)
      );
      try {
        const parsed = parseMealTranscriptExtraction(modelOutput, transcript);
        return parsed.foods.length > 0
          ? parsed
          : extractGroundedMealFromTranscript(transcript);
      } catch {
        return extractGroundedMealFromTranscript(transcript);
      }
    } finally {
      generationInProgress = false;
      if (releaseAfterGeneration) {
        loadedModel?.delete();
        loadedModel = undefined;
        releaseAfterGeneration = false;
      }
    }
  },

  async extractMedication(
    transcript: string,
    referenceDate = new Date(),
  ): Promise<MedicationTranscriptExtraction> {
    if (!loadedModel) {
      throw new Error('Prepare the local model before using voice entry.');
    }
    if (generationInProgress) {
      throw new Error('The local model is already preparing a draft.');
    }
    generationInProgress = true;
    try {
      const modelOutput = await loadedModel.generate(
        buildMedicationTranscriptMessages(transcript),
      );
      try {
        return parseMedicationTranscriptExtraction(
          modelOutput,
          transcript,
          referenceDate,
        );
      } catch {
        return extractGroundedMedicationFromTranscript(transcript, referenceDate);
      }
    } finally {
      generationInProgress = false;
      if (releaseAfterGeneration) {
        loadedModel?.delete();
        loadedModel = undefined;
        releaseAfterGeneration = false;
      }
    }
  },

  release(): void {
    releaseAfterLoad = true;
    if (generationInProgress) {
      releaseAfterGeneration = true;
      loadedModel?.interrupt();
      return;
    }
    loadedModel?.delete();
    loadedModel = undefined;
  },
};
