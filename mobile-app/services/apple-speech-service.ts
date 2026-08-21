import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import GlucofinitySpeech, {
  type NativeSpeechAvailability,
  type NativeLiveTranscriptEvent,
  type NativeSpeechTranscription,
} from '@/modules/glucofinity-speech';

export type AppleSpeechStatus =
  | NativeSpeechAvailability['status']
  | 'expo-go'
  | 'native-build-required'
  | 'unsupported-platform';

export interface AppleSpeechAvailability
  extends Omit<NativeSpeechAvailability, 'status'> {
  status: AppleSpeechStatus;
}

function deviceLocale(): string {
  return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
}

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

export const appleSpeechService = {
  async getAvailability(
    localeIdentifier = deviceLocale()
  ): Promise<AppleSpeechAvailability> {
    if (Platform.OS !== 'ios') {
      return {
        status: 'unsupported-platform',
        locale: localeIdentifier,
        message: 'Voice entry currently uses Apple speech recognition on iOS.',
      };
    }
    if (isExpoGo()) {
      return {
        status: 'expo-go',
        locale: localeIdentifier,
        message: 'Voice entry requires an iOS development build, not Expo Go.',
      };
    }
    if (!GlucofinitySpeech) {
      return {
        status: 'native-build-required',
        locale: localeIdentifier,
        message: 'Rebuild the iOS app to include the on-device speech module.',
      };
    }
    try {
      return await GlucofinitySpeech.getAvailabilityAsync(localeIdentifier);
    } catch {
      return {
        status: 'native-build-required',
        locale: localeIdentifier,
        message: 'The on-device speech module could not be initialized.',
      };
    }
  },

  async transcribeFile(
    fileUri: string,
    localeIdentifier = deviceLocale()
  ): Promise<NativeSpeechTranscription> {
    const availability = await this.getAvailability(localeIdentifier);
    if (availability.status !== 'available' || !GlucofinitySpeech) {
      throw new Error(availability.message);
    }
    if (!fileUri.trim()) throw new Error('A local audio recording is required.');
    return GlucofinitySpeech.transcribeFileAsync(fileUri, localeIdentifier);
  },

  async startLiveTranscription(
    onTranscript: (event: NativeLiveTranscriptEvent) => void,
    localeIdentifier = deviceLocale()
  ) {
    const availability = await this.getAvailability(localeIdentifier);
    if (availability.status !== 'available' || !GlucofinitySpeech) {
      throw new Error(availability.message);
    }
    const subscription = GlucofinitySpeech.addListener(
      'onLiveTranscript',
      onTranscript
    );
    try {
      await GlucofinitySpeech.startLiveTranscriptionAsync(localeIdentifier);
      return subscription;
    } catch (error) {
      subscription.remove();
      throw error;
    }
  },

  async stopLiveTranscription(): Promise<NativeSpeechTranscription> {
    if (!GlucofinitySpeech) {
      throw new Error('Rebuild the iOS app to include the on-device speech module.');
    }
    return GlucofinitySpeech.stopLiveTranscriptionAsync();
  },

  async cancelLiveTranscription(): Promise<void> {
    await GlucofinitySpeech?.cancelLiveTranscriptionAsync();
  },
};
