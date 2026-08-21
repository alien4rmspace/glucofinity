import type { LocalMealLanguageProvider } from '@/services/local-meal-language-provider.types';

export type {
  LocalMealModelAccessState,
  LocalMealModelAvailability,
} from '@/services/local-meal-language-provider.types';

const WEB_UNAVAILABLE_MESSAGE =
  'The local model is available only in an iOS development or release build.';

export const localMealLanguageProvider: LocalMealLanguageProvider = {
  providerId: 'react-native-executorch-local-v0.9.3',
  modelId: 'lfm2.5-1.2b-instruct-8da4w-rne-v0.9.0',

  async getAccessState() {
    return {
      availability: 'unsupported-platform',
      message: WEB_UNAVAILABLE_MESSAGE,
    };
  },

  async prepare() {
    throw new Error(WEB_UNAVAILABLE_MESSAGE);
  },

  async prefetch() {
    throw new Error(WEB_UNAVAILABLE_MESSAGE);
  },

  async extractMeal() {
    throw new Error(WEB_UNAVAILABLE_MESSAGE);
  },

  async extractMedication() {
    throw new Error(WEB_UNAVAILABLE_MESSAGE);
  },

  release() {},
};
