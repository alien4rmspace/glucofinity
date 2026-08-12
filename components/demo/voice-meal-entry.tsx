"use client";

import {
  Cpu,
  Download,
  Mic,
  MicOff,
  ShieldCheck,
  WandSparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  browserMealLanguageProvider,
  WEB_LFM_MODEL_ID,
  WEB_LFM_PROVIDER_ID,
} from "@/services/browser-meal-language-provider";
import {
  createLocalSpeechRecognition,
  getLocalSpeechSupport,
  installLocalSpeechPack,
  speechErrorMessage,
  type BrowserSpeechRecognition,
} from "@/services/browser-speech-service";
import type {
  BrowserSpeechSupport,
  LocalMealModelState,
} from "@/types/voice-entry";
import { DemoCard } from "@/components/demo/demo-ui";

type VoiceDraft = {
  transcript: string;
  mealName: string;
  foodsText: string;
  generatedAt: string;
  edited: boolean;
};

export type AppliedBrowserVoiceMealDraft = {
  transcript: string;
  mealName: string;
  foods: string[];
  providerId: string;
  model: string;
  generatedAt: string;
  edited: boolean;
};

export function VoiceMealEntry({
  onApply,
}: {
  onApply: (draft: AppliedBrowserVoiceMealDraft) => void;
}) {
  const recognitionRef = useRef<BrowserSpeechRecognition | undefined>(undefined);
  const transcriptRef = useRef("");
  const speechFailedRef = useRef(false);
  const [speechSupport, setSpeechSupport] = useState<BrowserSpeechSupport>({
    availability: "checking",
    message: "Checking this browser's local speech support.",
  });
  const [modelState, setModelState] = useState<LocalMealModelState>(
    browserMealLanguageProvider.getState(),
  );
  const [modelAccessMessage, setModelAccessMessage] = useState<string>();
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft>();

  useEffect(() => {
    let active = true;
    const unsubscribe = browserMealLanguageProvider.subscribe(setModelState);
    void Promise.all([
      getLocalSpeechSupport(),
      browserMealLanguageProvider.getAccessMessage(),
    ]).then(([speech, modelMessage]) => {
      if (!active) return;
      setSpeechSupport(speech);
      setModelAccessMessage(modelMessage);
    });
    return () => {
      active = false;
      unsubscribe();
      recognitionRef.current?.abort();
    };
  }, []);

  async function prepareModel() {
    setActionMessage("");
    try {
      await browserMealLanguageProvider.prepare();
      setActionMessage("LFM2.5 is ready in this browser.");
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "The local model could not be prepared.",
      );
    }
  }

  async function installSpeech() {
    setSpeechSupport({
      availability: "downloading",
      message: "Installing the browser's local English speech pack.",
    });
    setSpeechSupport(await installLocalSpeechPack());
  }

  function startRecording() {
    if (modelState.status !== "ready") {
      setActionMessage("Prepare LFM2.5 before recording a meal description.");
      return;
    }
    setActionMessage("");
    setVoiceDraft(undefined);
    setTranscript("");
    transcriptRef.current = "";
    speechFailedRef.current = false;

    try {
      const recognition = createLocalSpeechRecognition();
      recognitionRef.current = recognition;
      recognition.onresult = (event) => {
        const parts: string[] = [];
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result?.[0]?.transcript) parts.push(result[0].transcript);
        }
        const nextTranscript = parts.join(" ").trim();
        transcriptRef.current = nextTranscript;
        setTranscript(nextTranscript);
      };
      recognition.onerror = (event) => {
        speechFailedRef.current = true;
        setActionMessage(speechErrorMessage(event.error));
      };
      recognition.onend = () => {
        recognitionRef.current = undefined;
        setRecording(false);
        if (!speechFailedRef.current && transcriptRef.current.trim()) {
          void extractDraft(transcriptRef.current);
        } else if (!speechFailedRef.current) {
          setActionMessage("No speech was detected. Try again or type the meal description.");
        }
      };
      recognition.start();
      setRecording(true);
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Local speech recognition could not start.",
      );
    }
  }

  function stopRecording() {
    recognitionRef.current?.stop();
  }

  async function extractDraft(value = transcript) {
    const reviewedTranscript = value.trim();
    if (!reviewedTranscript) {
      setActionMessage("Speak or type a meal description first.");
      return;
    }
    setProcessing(true);
    setActionMessage("LFM2.5 is preparing an editable draft on this device.");
    try {
      const extraction = await browserMealLanguageProvider.extractMeal(reviewedTranscript);
      setVoiceDraft({
        transcript: reviewedTranscript,
        mealName: extraction.mealName ?? "",
        foodsText: extraction.foods.join(", "),
        generatedAt: new Date().toISOString(),
        edited: false,
      });
      setActionMessage("Review the local model's draft before applying it to the meal form.");
    } catch (error) {
      setVoiceDraft({
        transcript: reviewedTranscript,
        mealName: "",
        foodsText: "",
        generatedAt: new Date().toISOString(),
        edited: false,
      });
      setActionMessage(
        `The transcript is ready, but the local model did not produce grounded meal fields. Enter them manually. ${
          error instanceof Error ? error.message : ""
        }`.trim(),
      );
    } finally {
      setProcessing(false);
    }
  }

  function updateVoiceDraft(field: "mealName" | "foodsText", value: string) {
    setVoiceDraft((current) =>
      current ? { ...current, [field]: value, edited: true } : current,
    );
  }

  function applyVoiceDraft() {
    if (!voiceDraft) return;
    onApply({
      transcript: voiceDraft.transcript,
      mealName: voiceDraft.mealName.trim(),
      foods: voiceDraft.foodsText
        .split(",")
        .map((food) => food.trim())
        .filter(Boolean),
      providerId: WEB_LFM_PROVIDER_ID,
      model: WEB_LFM_MODEL_ID,
      generatedAt: voiceDraft.generatedAt,
      edited: voiceDraft.edited,
    });
    setVoiceDraft(undefined);
    setTranscript("");
    transcriptRef.current = "";
  }

  const modelReady = modelState.status === "ready";
  const speechReady = speechSupport.availability === "available";

  return (
    <section aria-labelledby="voice-meal-heading" className="grid gap-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f0edff] text-[#6049bc]">
          <Mic className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 id="voice-meal-heading" className="text-lg font-semibold text-[#0b1f33]">
            Voice meal entry
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#64768a]">
            Use local browser speech or type a description. LFM2.5 extracts only the meal
            name and foods you stated, then waits for your review.
          </p>
        </div>
      </div>

      <DemoCard className="grid gap-5 border-[#cfc4fa] bg-[#fbfaff] p-5 sm:p-6">
        <div className="flex items-start gap-3 rounded-lg border border-[#cfe6d8] bg-[#f1fbf5] p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#287a4b]" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-[#21643f]">Local processing only</p>
            <p className="mt-1 text-xs leading-5 text-[#526f60]">
              GlucoFinity does not upload the transcript or call an AI API. If the browser
              cannot guarantee local speech processing, voice recording stays disabled.
              Use only fictional meal descriptions in this public prototype.
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border border-[#ddd5fb] bg-white p-4">
          <div className="flex items-start gap-3">
            <Cpu className="mt-0.5 size-5 shrink-0 text-[#6049bc]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#0b1f33]">1. Prepare local LFM2.5</p>
              <p className="mt-1 text-xs leading-5 text-[#64768a]">
                The first use downloads the approximately 850 MB Q4 model and stores reusable
                files in this browser. WebGPU and an internet connection are required for setup.
              </p>
            </div>
          </div>
          {modelAccessMessage ? (
            <p className="rounded-lg bg-[#fff7e6] px-3 py-2 text-xs leading-5 text-[#7a5411]">
              {modelAccessMessage}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void prepareModel()}
              disabled={modelState.status === "preparing" || modelReady}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#cfc4fa] bg-[#f5f2ff] px-4 text-sm font-semibold text-[#6049bc] hover:bg-[#ede8ff] disabled:cursor-not-allowed disabled:opacity-65 sm:w-fit"
            >
              <Download className="size-4" aria-hidden="true" />
              {modelState.status === "preparing"
                ? `Preparing LFM2.5 (${modelState.progress}%)`
                : modelReady
                  ? "LFM2.5 ready"
                  : modelState.status === "error"
                    ? "Retry local model setup"
                    : "Prepare local model"}
            </button>
          )}
          {modelState.status === "preparing" ? (
            <div
              className="h-2 overflow-hidden rounded-full bg-[#e8e2fb]"
              role="progressbar"
              aria-label="Local model preparation"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={modelState.progress}
            >
              <span
                className="block h-full rounded-full bg-[#7257d9] transition-[width]"
                style={{ width: `${modelState.progress}%` }}
              />
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 rounded-lg border border-[#dce5ee] bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-[#0b1f33]">2. Speak or type the meal</p>
            <p className="mt-1 text-xs leading-5 text-[#64768a]">{speechSupport.message}</p>
          </div>
          {speechSupport.availability === "downloadable" ? (
            <button
              type="button"
              onClick={() => void installSpeech()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#b8d3f0] bg-[#edf5ff] px-4 text-sm font-semibold text-[#0e5ab7] hover:bg-[#e2effe] sm:w-fit"
            >
              <Download className="size-4" aria-hidden="true" /> Install local speech pack
            </button>
          ) : null}
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={!speechReady || !modelReady || processing}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit ${
              recording ? "bg-[#a43b3b] hover:bg-[#8c3030]" : "bg-[#1268e8] hover:bg-[#0f57c3]"
            }`}
          >
            {recording ? (
              <MicOff className="size-4" aria-hidden="true" />
            ) : (
              <Mic className="size-4" aria-hidden="true" />
            )}
            {recording ? "Stop and process" : "Record meal description"}
          </button>
          <label className="grid gap-1.5 text-sm font-semibold text-[#34495e]">
            Local transcript or typed description
            <textarea
              value={transcript}
              onChange={(event) => {
                setTranscript(event.target.value);
                transcriptRef.current = event.target.value;
              }}
              disabled={recording || processing}
              rows={3}
              maxLength={4_000}
              className="rounded-lg border border-[#cbd8e4] bg-white px-3 py-2.5 font-normal text-[#0b1f33] disabled:bg-[#f3f6f8]"
              placeholder="Example: For lunch I had brown rice, salmon, and roasted broccoli."
            />
          </label>
          <button
            type="button"
            onClick={() => void extractDraft()}
            disabled={!modelReady || !transcript.trim() || recording || processing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#6049bc] px-4 text-sm font-semibold text-white hover:bg-[#513da4] disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
          >
            <WandSparkles className="size-4" aria-hidden="true" />
            {processing ? "Preparing draft locally" : "Prepare editable draft"}
          </button>
          <p className="min-h-5 text-xs leading-5 text-[#64768a]" aria-live="polite">
            {actionMessage}
          </p>
        </div>
      </DemoCard>

      {voiceDraft ? (
        <DemoCard className="grid gap-4 border-[#bcaeef] p-5 sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7257d9]">
              Local model draft
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[#0b1f33]">3. Review before applying</h3>
            <p className="mt-1 text-sm leading-6 text-[#64768a]">
              Nothing is saved yet. Correct or complete the fields before applying them to
              the regular meal form.
            </p>
          </div>
          <div className="rounded-lg bg-[#f7fafc] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#718096]">
              Transcript
            </p>
            <p className="mt-2 text-sm leading-6 text-[#34495e]">{voiceDraft.transcript}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-[#34495e]">
              Suggested meal name
              <input
                value={voiceDraft.mealName}
                onChange={(event) => updateVoiceDraft("mealName", event.target.value)}
                maxLength={80}
                className="h-11 rounded-lg border border-[#cbd8e4] bg-white px-3 font-normal text-[#0b1f33]"
                placeholder="Enter a meal name"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#34495e]">
              Foods (comma separated)
              <input
                value={voiceDraft.foodsText}
                onChange={(event) => updateVoiceDraft("foodsText", event.target.value)}
                className="h-11 rounded-lg border border-[#cbd8e4] bg-white px-3 font-normal text-[#0b1f33]"
                placeholder="Review the foods you stated"
              />
            </label>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setVoiceDraft(undefined)}
              className="h-11 rounded-lg border border-[#cbd8e4] px-4 text-sm font-semibold text-[#34495e] hover:bg-[#f7fafc]"
            >
              Discard draft
            </button>
            <button
              type="button"
              onClick={applyVoiceDraft}
              className="h-11 rounded-lg bg-[#1268e8] px-4 text-sm font-semibold text-white hover:bg-[#0f57c3]"
            >
              Apply to meal form
            </button>
          </div>
          <p className="text-[11px] leading-5 text-[#718096]">
            Provenance: local {WEB_LFM_MODEL_ID}. The model does not estimate nutrition or
            glucose effects in this workflow.
          </p>
        </DemoCard>
      ) : null}
    </section>
  );
}
