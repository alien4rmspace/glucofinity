import {
  requireOptionalNativeModule,
  type EventSubscription,
  type NativeModule,
} from 'expo-modules-core';

export type NativeSpeechStatus =
  | 'available'
  | 'permission-denied'
  | 'on-device-unavailable'
  | 'unsupported-locale';

export type NativeSpeechEngine = 'speech-analyzer' | 'sf-speech-on-device';

export interface NativeSpeechAvailability {
  status: NativeSpeechStatus;
  engine?: NativeSpeechEngine;
  locale: string;
  message: string;
}

export interface NativeSpeechTranscription {
  transcript: string;
  engine: NativeSpeechEngine;
  locale: string;
}

export interface NativeLiveTranscriptEvent {
  transcript: string;
  isFinal: boolean;
}

type GlucofinitySpeechEvents = {
  onLiveTranscript: (event: NativeLiveTranscriptEvent) => void;
};

type GlucofinitySpeechNativeModule = NativeModule<GlucofinitySpeechEvents> & {
  addListener(
    eventName: 'onLiveTranscript',
    listener: (event: NativeLiveTranscriptEvent) => void
  ): EventSubscription;
  getAvailabilityAsync(localeIdentifier: string): Promise<NativeSpeechAvailability>;
  transcribeFileAsync(
    fileUri: string,
    localeIdentifier: string
  ): Promise<NativeSpeechTranscription>;
  startLiveTranscriptionAsync(localeIdentifier: string): Promise<void>;
  stopLiveTranscriptionAsync(): Promise<NativeSpeechTranscription>;
  cancelLiveTranscriptionAsync(): Promise<void>;
};

export default requireOptionalNativeModule<GlucofinitySpeechNativeModule>(
  'GlucofinitySpeech'
);
