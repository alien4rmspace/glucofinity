/// <reference lib="webworker" />

import {
  AutoModelForCausalLM,
  AutoTokenizer,
  TextStreamer,
} from "@huggingface/transformers";
import { buildMealTranscriptMessages } from "@/services/meal-transcript-extraction";
import type { LfmWorkerRequest, LfmWorkerResponse } from "@/types/voice-entry";

const MODEL_ID = "LiquidAI/LFM2.5-1.2B-Instruct-ONNX";

type Tokenizer = Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>;
type Model = Awaited<ReturnType<typeof AutoModelForCausalLM.from_pretrained>>;

let tokenizer: Tokenizer | undefined;
let model: Model | undefined;
let preparing: Promise<void> | undefined;

function send(message: LfmWorkerResponse): void {
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
  if (tokenizer && model) return;
  if (preparing) return preparing;
  preparing = (async () => {
    const progressCallback = (progress: unknown) => {
      const value = progressValue(progress);
      if (value !== undefined) send({ type: "progress", progress: value });
    };
    const loadedTokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
    const loadedModel = await AutoModelForCausalLM.from_pretrained(MODEL_ID, {
      device: "webgpu",
      dtype: "q4",
      progress_callback: progressCallback,
    });
    tokenizer = loadedTokenizer;
    model = loadedModel;
  })();
  try {
    await preparing;
  } finally {
    preparing = undefined;
  }
}

async function extract(requestId: number, transcript: string): Promise<void> {
  await prepare();
  if (!tokenizer || !model) throw new Error("The local model is not ready.");

  const input = tokenizer.apply_chat_template(buildMealTranscriptMessages(transcript), {
    add_generation_prompt: true,
    return_dict: true,
  });
  let generatedText = "";
  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (text) => {
      generatedText += text;
    },
  });
  await model.generate({
    ...input,
    max_new_tokens: 160,
    do_sample: false,
    repetition_penalty: 1.05,
    streamer,
  });
  send({ type: "result", requestId, output: generatedText });
}

self.addEventListener("message", (event: MessageEvent<LfmWorkerRequest>) => {
  const request = event.data;
  if (request.type === "prepare") {
    void prepare()
      .then(() => send({ type: "ready" }))
      .catch((error: unknown) =>
        send({
          type: "error",
          message: error instanceof Error ? error.message : "The local model could not load.",
        }),
      );
    return;
  }
  void extract(request.requestId, request.transcript).catch((error: unknown) =>
    send({
      type: "error",
      requestId: request.requestId,
      message: error instanceof Error ? error.message : "The local model could not extract a meal.",
    }),
  );
});
