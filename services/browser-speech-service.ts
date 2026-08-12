import type { BrowserSpeechSupport } from "@/types/voice-entry";

const SPEECH_LANGUAGE = "en-US";

type BrowserSpeechRecognitionResult = {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
};

type BrowserSpeechRecognitionEvent = Event & {
  readonly results: ArrayLike<BrowserSpeechRecognitionResult>;
};

type BrowserSpeechRecognitionErrorEvent = Event & {
  readonly error: string;
  readonly message?: string;
};

export type BrowserSpeechRecognition = EventTarget & {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally: boolean;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type SpeechAvailabilityResult =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable";

type BrowserSpeechRecognitionConstructor = {
  new (): BrowserSpeechRecognition;
  prototype: BrowserSpeechRecognition;
  available?: (options: {
    langs: string[];
    processLocally: true;
  }) => Promise<SpeechAvailabilityResult>;
  install?: (options: {
    langs: string[];
    processLocally: true;
  }) => Promise<boolean>;
};

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

function recognitionConstructor(): BrowserSpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const speechWindow = window as WindowWithSpeechRecognition;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

export async function getLocalSpeechSupport(): Promise<BrowserSpeechSupport> {
  if (typeof window === "undefined" || !window.isSecureContext) {
    return {
      availability: "unavailable",
      message: "Local browser speech requires a secure HTTPS connection.",
    };
  }

  const Recognition = recognitionConstructor();
  if (!Recognition || !("processLocally" in Recognition.prototype)) {
    return {
      availability: "unavailable",
      message:
        "This browser cannot guarantee on-device speech recognition. Type the meal instead, or try a current browser with local speech support.",
    };
  }

  if (!Recognition.available) {
    return {
      availability: "available",
      message: "This browser reports local speech support.",
    };
  }

  try {
    const availability = await Recognition.available({
      langs: [SPEECH_LANGUAGE],
      processLocally: true,
    });
    if (availability === "available") {
      return {
        availability,
        message: "English speech recognition is available on this device.",
      };
    }
    if (availability === "downloadable") {
      return {
        availability,
        message: "Install the browser's English speech pack before recording.",
      };
    }
    if (availability === "downloading") {
      return {
        availability,
        message: "The browser is downloading its local English speech pack.",
      };
    }
  } catch {
    // A blocked Permissions-Policy or incomplete implementation is not safe to
    // reinterpret as permission to use a remote recognition service.
  }

  return {
    availability: "unavailable",
    message:
      "On-device English speech recognition is unavailable here. Manual meal entry remains available.",
  };
}

export async function installLocalSpeechPack(): Promise<BrowserSpeechSupport> {
  const Recognition = recognitionConstructor();
  if (!Recognition?.install) {
    return {
      availability: "unavailable",
      message: "This browser cannot install an on-device speech pack.",
    };
  }
  try {
    const installed = await Recognition.install({
      langs: [SPEECH_LANGUAGE],
      processLocally: true,
    });
    return installed
      ? getLocalSpeechSupport()
      : {
          availability: "unavailable",
          message: "The local English speech pack could not be installed.",
        };
  } catch {
    return {
      availability: "unavailable",
      message: "The local English speech pack could not be installed.",
    };
  }
}

export function createLocalSpeechRecognition(): BrowserSpeechRecognition {
  const Recognition = recognitionConstructor();
  if (!Recognition || !("processLocally" in Recognition.prototype)) {
    throw new Error("On-device browser speech recognition is unavailable.");
  }
  const recognition = new Recognition();
  recognition.lang = SPEECH_LANGUAGE;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.processLocally = true;
  return recognition;
}

export function speechErrorMessage(error: string): string {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Microphone or local speech access was denied. You can continue with manual entry.";
  }
  if (error === "language-not-supported" || error === "language-unavailable") {
    return "The local English speech pack is unavailable on this device.";
  }
  if (error === "no-speech") return "No speech was detected. Try again or type the meal.";
  if (error === "audio-capture") return "The browser could not access a microphone.";
  return "Local speech recognition stopped before it produced a transcript.";
}
