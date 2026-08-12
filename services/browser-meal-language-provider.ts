import {
  parseMealTranscriptExtraction,
  validateMealTranscript,
} from "@/services/meal-transcript-extraction";
import type {
  LfmWorkerRequest,
  LfmWorkerResponse,
  LocalMealModelState,
  MealTranscriptExtraction,
} from "@/types/voice-entry";

export const WEB_LFM_PROVIDER_ID = "transformers-js-webgpu-v4.2.0";
export const WEB_LFM_MODEL_ID = "lfm2.5-1.2b-instruct-onnx-q4";

type PendingRequest = {
  transcript: string;
  resolve: (value: MealTranscriptExtraction) => void;
  reject: (error: Error) => void;
};

class BrowserMealLanguageProvider {
  private worker: Worker | undefined;
  private state: LocalMealModelState = { status: "idle", progress: 0 };
  private preparePromise: Promise<void> | undefined;
  private prepareResolve: (() => void) | undefined;
  private prepareReject: ((error: Error) => void) | undefined;
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly listeners = new Set<(state: LocalMealModelState) => void>();

  getState(): LocalMealModelState {
    return this.state;
  }

  subscribe(listener: (state: LocalMealModelState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  async getAccessMessage(): Promise<string | undefined> {
    if (typeof navigator === "undefined") return "WebGPU is unavailable during server rendering.";
    const gpu = (navigator as Navigator & {
      gpu?: { requestAdapter(): Promise<unknown | null> };
    }).gpu;
    if (!gpu) return "This browser does not support WebGPU. Manual meal entry remains available.";
    try {
      return (await gpu.requestAdapter())
        ? undefined
        : "No compatible graphics adapter is available for the local model.";
    } catch {
      return "This browser could not start WebGPU for the local model.";
    }
  }

  async prepare(): Promise<void> {
    if (this.state.status === "ready") return;
    if (this.preparePromise) return this.preparePromise;
    const accessMessage = await this.getAccessMessage();
    if (accessMessage) throw new Error(accessMessage);

    this.setState({ status: "preparing", progress: 0 });
    this.ensureWorker();
    this.preparePromise = new Promise<void>((resolve, reject) => {
      this.prepareResolve = resolve;
      this.prepareReject = reject;
    });
    this.post({ type: "prepare" });
    return this.preparePromise;
  }

  async extractMeal(transcript: string): Promise<MealTranscriptExtraction> {
    const reviewedTranscript = validateMealTranscript(transcript);
    await this.prepare();
    const requestId = this.nextRequestId++;
    return new Promise<MealTranscriptExtraction>((resolve, reject) => {
      this.pending.set(requestId, { transcript: reviewedTranscript, resolve, reject });
      this.post({ type: "extract", requestId, transcript: reviewedTranscript });
    });
  }

  private ensureWorker(): void {
    if (this.worker) return;
    this.worker = new Worker(new URL("../workers/lfm-meal.worker.ts", import.meta.url), {
      type: "module",
      name: "glucofinity-local-meal-model",
    });
    this.worker.addEventListener("message", (event: MessageEvent<LfmWorkerResponse>) => {
      this.handleMessage(event.data);
    });
    this.worker.addEventListener("error", () => {
      this.fail(new Error("The browser stopped the local model worker."));
    });
  }

  private post(message: LfmWorkerRequest): void {
    this.worker?.postMessage(message);
  }

  private handleMessage(message: LfmWorkerResponse): void {
    if (message.type === "progress") {
      const currentProgress = this.state.status === "preparing" ? this.state.progress : 0;
      this.setState({
        status: "preparing",
        progress: Math.max(currentProgress, Math.round(message.progress)),
      });
      return;
    }
    if (message.type === "ready") {
      this.setState({ status: "ready", progress: 100 });
      this.prepareResolve?.();
      this.clearPrepareCallbacks();
      return;
    }
    if (message.type === "result") {
      const request = this.pending.get(message.requestId);
      if (!request) return;
      this.pending.delete(message.requestId);
      try {
        request.resolve(parseMealTranscriptExtraction(message.output, request.transcript));
      } catch (error) {
        request.reject(error instanceof Error ? error : new Error("The meal draft was invalid."));
      }
      return;
    }
    const error = new Error(message.message);
    if (message.requestId !== undefined) {
      const request = this.pending.get(message.requestId);
      this.pending.delete(message.requestId);
      request?.reject(error);
      return;
    }
    this.fail(error);
  }

  private fail(error: Error): void {
    const progress = this.state.progress;
    this.setState({ status: "error", progress, message: error.message });
    this.prepareReject?.(error);
    this.clearPrepareCallbacks();
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
    this.worker?.terminate();
    this.worker = undefined;
  }

  private clearPrepareCallbacks(): void {
    this.preparePromise = undefined;
    this.prepareResolve = undefined;
    this.prepareReject = undefined;
  }

  private setState(state: LocalMealModelState): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}

export const browserMealLanguageProvider = new BrowserMealLanguageProvider();
