import type {
  LocalMealModelState,
  WhisperWorkerRequest,
  WhisperWorkerResponse,
} from "@/types/voice-entry";

export const WEB_WHISPER_PROVIDER_ID = "transformers-js-webgpu-v4.2.0";
export const WEB_WHISPER_MODEL_ID = "distil-small.en-onnx-fp32-q4";

const TARGET_SAMPLE_RATE = 16_000;

type PendingRequest = {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
};

class BrowserWhisperSpeechProvider {
  private worker: Worker | undefined;
  private state: LocalMealModelState = { status: "idle", progress: 0 };
  private preparePromise: Promise<void> | undefined;
  private prepareResolve: (() => void) | undefined;
  private prepareReject: ((error: Error) => void) | undefined;
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly listeners = new Set<(state: LocalMealModelState) => void>();
  private mediaRecorder: MediaRecorder | undefined;
  private mediaStream: MediaStream | undefined;
  private recordedChunks: Blob[] = [];

  getState(): LocalMealModelState {
    return this.state;
  }

  subscribe(listener: (state: LocalMealModelState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  async getAccessMessage(): Promise<string | undefined> {
    if (typeof window === "undefined") return "Local Whisper is unavailable during server rendering.";
    if (!window.isSecureContext) return "Local Whisper recording requires a secure HTTPS connection.";
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return "This browser cannot record audio for local Whisper transcription.";
    }
    if (typeof AudioContext === "undefined" || typeof OfflineAudioContext === "undefined") {
      return "This browser cannot prepare recorded audio for local Whisper transcription.";
    }
    const gpu = (navigator as Navigator & {
      gpu?: { requestAdapter(): Promise<unknown | null> };
    }).gpu;
    if (!gpu) return "This browser does not support WebGPU for local Whisper transcription.";
    try {
      return (await gpu.requestAdapter())
        ? undefined
        : "No compatible graphics adapter is available for local Whisper transcription.";
    } catch {
      return "This browser could not start WebGPU for local Whisper transcription.";
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

  async startRecording(): Promise<void> {
    if (this.state.status !== "ready") throw new Error("Prepare local Distil-Whisper first.");
    if (this.mediaRecorder?.state === "recording") return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const recorder = new MediaRecorder(stream);
    this.mediaStream = stream;
    this.mediaRecorder = recorder;
    this.recordedChunks = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) this.recordedChunks.push(event.data);
    });
    recorder.start(1_000);
  }

  async stopRecordingAndTranscribe(): Promise<string> {
    const recorder = this.mediaRecorder;
    if (!recorder || recorder.state === "inactive") {
      throw new Error("No local recording is active.");
    }

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        recorder.addEventListener(
          "stop",
          () => resolve(new Blob(this.recordedChunks, { type: recorder.mimeType })),
          { once: true },
        );
        recorder.addEventListener(
          "error",
          () => reject(new Error("The browser could not finish the recording.")),
          { once: true },
        );
        recorder.stop();
      });
      if (blob.size === 0) throw new Error("The recording did not contain any audio.");
      const audio = await this.decodeAndResample(blob);
      return await this.transcribe(audio);
    } finally {
      this.releaseRecording();
    }
  }

  cancelRecording(): void {
    const recorder = this.mediaRecorder;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    this.releaseRecording();
  }

  private async decodeAndResample(blob: Blob): Promise<Float32Array> {
    const audioContext = new AudioContext();
    let decoded: AudioBuffer;
    try {
      decoded = await audioContext.decodeAudioData(await blob.arrayBuffer());
    } finally {
      await audioContext.close();
    }

    const frameCount = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE));
    const offlineContext = new OfflineAudioContext(1, frameCount, TARGET_SAMPLE_RATE);
    const source = offlineContext.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineContext.destination);
    source.start();
    const resampled = await offlineContext.startRendering();
    return new Float32Array(resampled.getChannelData(0));
  }

  private transcribe(audio: Float32Array): Promise<string> {
    const requestId = this.nextRequestId++;
    return new Promise<string>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.post({ type: "transcribe", requestId, audio }, [audio.buffer]);
    });
  }

  private ensureWorker(): void {
    if (this.worker) return;
    this.worker = new Worker(new URL("../workers/whisper-meal.worker.ts", import.meta.url), {
      type: "module",
      name: "glucofinity-local-distil-whisper",
    });
    this.worker.addEventListener("message", (event: MessageEvent<WhisperWorkerResponse>) => {
      this.handleMessage(event.data);
    });
    this.worker.addEventListener("error", () => {
      this.fail(new Error("The browser stopped the local Distil-Whisper worker."));
    });
  }

  private post(message: WhisperWorkerRequest, transfer: Transferable[] = []): void {
    this.worker?.postMessage(message, transfer);
  }

  private handleMessage(message: WhisperWorkerResponse): void {
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
      this.pending.delete(message.requestId);
      request?.resolve(message.transcript);
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

  private releaseRecording(): void {
    for (const track of this.mediaStream?.getTracks() ?? []) track.stop();
    this.mediaRecorder = undefined;
    this.mediaStream = undefined;
    this.recordedChunks = [];
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

export const browserWhisperSpeechProvider = new BrowserWhisperSpeechProvider();
