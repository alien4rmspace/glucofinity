export type BrowserSpeechAvailability =
  | "checking"
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable";

export type BrowserSpeechSupport = {
  availability: BrowserSpeechAvailability;
  message: string;
};

export type MealTranscriptExtraction = {
  mealName?: string;
  foods: string[];
};

export type LocalMealModelState =
  | { status: "idle"; progress: 0 }
  | { status: "preparing"; progress: number }
  | { status: "ready"; progress: 100 }
  | { status: "error"; progress: number; message: string };

export type LfmWorkerRequest =
  | { type: "prepare" }
  | { type: "extract"; requestId: number; transcript: string };

export type LfmWorkerResponse =
  | { type: "progress"; progress: number }
  | { type: "ready" }
  | { type: "result"; requestId: number; output: string }
  | { type: "error"; requestId?: number; message: string };
