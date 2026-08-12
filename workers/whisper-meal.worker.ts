/// <reference lib="webworker" />

import { pipeline } from "@huggingface/transformers";
import type { WhisperWorkerRequest, WhisperWorkerResponse } from "@/types/voice-entry";

const MODEL_ID = "onnx-community/distil-small.en";

type Transcriber = Awaited<
  ReturnType<typeof pipeline<"automatic-speech-recognition">>
>;

let transcriber: Transcriber | undefined;
let preparing: Promise<void> | undefined;

function send(message: WhisperWorkerResponse): void {
  self.postMessage(message);
}

function progressValue(progress: unknown): number | undefined {
  if (typeof progress !== "object" || progress === null || !("progress" in progress)) {
    return undefined;
  }
  const value = (progress as { progress?: unknown }).progress;
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : undefined;
}

async function prepare(): Promise<void> {
  if (transcriber) return;
  if (preparing) return preparing;
  preparing = (async () => {
    transcriber = await pipeline("automatic-speech-recognition", MODEL_ID, {
      device: "webgpu",
      dtype: {
        encoder_model: "fp32",
        decoder_model_merged: "q4",
      },
      progress_callback: (progress: unknown) => {
        const value = progressValue(progress);
        if (value !== undefined) send({ type: "progress", progress: value });
      },
    });
  })();
  try {
    await preparing;
  } finally {
    preparing = undefined;
  }
}

async function transcribe(requestId: number, audio: Float32Array): Promise<void> {
  await prepare();
  if (!transcriber) throw new Error("Local Distil-Whisper is not ready.");
  if (audio.length < 1_600) throw new Error("The recording was too short to transcribe.");

  const result = await transcriber(audio, {
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  const transcript = result.text.trim();
  if (!transcript) throw new Error("No speech was detected in the recording.");
  send({ type: "result", requestId, transcript });
}

self.addEventListener("message", (event: MessageEvent<WhisperWorkerRequest>) => {
  const request = event.data;
  if (request.type === "prepare") {
    void prepare()
      .then(() => send({ type: "ready" }))
      .catch((error: unknown) =>
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Local Distil-Whisper could not load.",
        }),
      );
    return;
  }
  void transcribe(request.requestId, request.audio).catch((error: unknown) =>
    send({
      type: "error",
      requestId: request.requestId,
      message: error instanceof Error ? error.message : "The recording could not be transcribed.",
    }),
  );
});
