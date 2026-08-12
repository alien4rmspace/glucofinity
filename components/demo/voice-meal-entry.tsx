"use client";

import {
  Calculator,
  Cpu,
  Download,
  Mic,
  MicOff,
  Pencil,
  ShieldCheck,
  WandSparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  MealTimeSelect,
  nearestLocalMealTime,
} from "@/components/demo/meal-time-select";
import {
  browserMealLanguageProvider,
  WEB_LFM_MODEL_ID,
  WEB_LFM_PROVIDER_ID,
} from "@/services/browser-meal-language-provider";
import {
  browserWhisperSpeechProvider,
  WEB_WHISPER_MODEL_ID,
} from "@/services/browser-whisper-speech-provider";
import {
  estimateLocalNutrition,
  findLocalNutritionSuggestions,
  splitFoodDescriptions,
} from "@/services/local-nutrition-estimator";
import { deriveMealNameFromFoods } from "@/services/meal-transcript-extraction";
import type { LocalNutritionEstimate, MacroNutrients } from "@/types/nutrition";
import type { LocalMealModelState } from "@/types/voice-entry";
import { DemoCard } from "@/components/demo/demo-ui";

type VoiceDraft = {
  transcript: string;
  mealName: string;
  time: string;
  foodsText: string;
  generatedAt: string;
  edited: boolean;
  mealNameEdited: boolean;
  foodsEdited: boolean;
  nutritionEdited: boolean;
  nutritionEstimate: LocalNutritionEstimate;
};

export type AppliedBrowserVoiceMealDraft = {
  transcript: string;
  mealName: string;
  time: string;
  foods: string[];
  providerId: string;
  model: string;
  generatedAt: string;
  edited: boolean;
  foodsEdited: boolean;
  nutritionEdited: boolean;
  nutritionEstimate: LocalNutritionEstimate;
};

export function VoiceMealEntry({
  onApply,
  onAdd,
}: {
  onApply: (draft: AppliedBrowserVoiceMealDraft) => void;
  onAdd: (draft: AppliedBrowserVoiceMealDraft) => void;
}) {
  const transcriptRef = useRef("");
  const [speechModelState, setSpeechModelState] = useState<LocalMealModelState>(
    browserWhisperSpeechProvider.getState(),
  );
  const [lfmModelState, setLfmModelState] = useState<LocalMealModelState>(
    browserMealLanguageProvider.getState(),
  );
  const [speechAccessMessage, setSpeechAccessMessage] = useState<string>();
  const [lfmAccessMessage, setLfmAccessMessage] = useState<string>();
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft>();
  const [nutritionEditing, setNutritionEditing] = useState(false);
  const [editingFoodIndex, setEditingFoodIndex] = useState<number>();
  const [foodEditValue, setFoodEditValue] = useState("");

  useEffect(() => {
    let active = true;
    const unsubscribeSpeech = browserWhisperSpeechProvider.subscribe(setSpeechModelState);
    const unsubscribeLfm = browserMealLanguageProvider.subscribe(setLfmModelState);
    void Promise.all([
      browserWhisperSpeechProvider.getAccessMessage(),
      browserMealLanguageProvider.getAccessMessage(),
    ]).then(([speechMessage, lfmMessage]) => {
      if (!active) return;
      setSpeechAccessMessage(speechMessage);
      setLfmAccessMessage(lfmMessage);
    });
    return () => {
      active = false;
      unsubscribeSpeech();
      unsubscribeLfm();
      browserWhisperSpeechProvider.cancelRecording();
    };
  }, []);

  async function prepareModels() {
    setActionMessage("");
    const errors: string[] = [];
    if (!speechAccessMessage && speechModelState.status !== "ready") {
      try {
        await browserWhisperSpeechProvider.prepare();
        setActionMessage("Distil-Whisper is ready. Preparing LFM2.5 locally.");
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Distil-Whisper could not load.");
      }
    }
    if (!lfmAccessMessage && lfmModelState.status !== "ready") {
      try {
        await browserMealLanguageProvider.prepare();
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "LFM2.5 could not load.");
      }
    }
    if (errors.length > 0) {
      setActionMessage(errors.join(" "));
    } else if (speechAccessMessage) {
      setActionMessage("LFM2.5 is ready for typed meal descriptions; voice is unavailable here.");
    } else {
      setActionMessage("Distil-Whisper and LFM2.5 are ready in this browser.");
    }
  }

  async function startRecording() {
    if (speechModelState.status !== "ready" || lfmModelState.status !== "ready") {
      setActionMessage("Prepare Distil-Whisper and LFM2.5 before recording.");
      return;
    }
    setVoiceDraft(undefined);
    setEditingFoodIndex(undefined);
    setFoodEditValue("");
    setTranscript("");
    transcriptRef.current = "";

    try {
      await browserWhisperSpeechProvider.startRecording();
      setRecording(true);
      setActionMessage(
        "Recording locally. Speak naturally, then press Stop recording when finished.",
      );
    } catch (error) {
      setRecording(false);
      setActionMessage(
        error instanceof Error ? error.message : "Local audio recording could not start.",
      );
    }
  }

  async function stopRecording() {
    setRecording(false);
    setProcessing(true);
    setActionMessage("Distil-Whisper is transcribing the complete recording locally.");
    try {
      const reviewedTranscript = (
        await browserWhisperSpeechProvider.stopRecordingAndTranscribe()
      ).trim();
      transcriptRef.current = reviewedTranscript;
      setTranscript(reviewedTranscript);
      await extractDraft(reviewedTranscript);
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "The local recording could not be transcribed.",
      );
    } finally {
      setProcessing(false);
    }
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
      const nutritionEstimate = estimateLocalNutrition(extraction.foods);
      setVoiceDraft({
        transcript: reviewedTranscript,
        mealName: extraction.mealName ?? "",
        time: nearestLocalMealTime(),
        foodsText: extraction.foods.join(", "),
        generatedAt: new Date().toISOString(),
        edited: false,
        mealNameEdited: false,
        foodsEdited: false,
        nutritionEdited: false,
        nutritionEstimate,
      });
      setNutritionEditing(false);
      setEditingFoodIndex(undefined);
      setFoodEditValue("");
      setActionMessage("Review the local model's draft before adding it to this session.");
    } catch (error) {
      setVoiceDraft({
        transcript: reviewedTranscript,
        mealName: "",
        time: nearestLocalMealTime(),
        foodsText: "",
        generatedAt: new Date().toISOString(),
        edited: false,
        mealNameEdited: false,
        foodsEdited: false,
        nutritionEdited: false,
        nutritionEstimate: estimateLocalNutrition([]),
      });
      setNutritionEditing(false);
      setEditingFoodIndex(undefined);
      setFoodEditValue("");
      setActionMessage(
        `The transcript is ready, but the local model did not produce grounded meal fields. Enter them manually. ${
          error instanceof Error ? error.message : ""
        }`.trim(),
      );
    } finally {
      setProcessing(false);
    }
  }

  function updateVoiceDraft(field: "mealName" | "time" | "foodsText", value: string) {
    if (field === "foodsText") {
      setEditingFoodIndex(undefined);
      setFoodEditValue("");
    }
    setVoiceDraft((current) => {
      if (!current) return current;
      if (field === "mealName") {
        return { ...current, mealName: value, mealNameEdited: true, edited: true };
      }
      if (field === "time") {
        return { ...current, time: value, edited: true };
      }
      const foods = splitFoodDescriptions(value);
      return {
        ...current,
        foodsText: value,
        mealName: current.mealNameEdited
          ? current.mealName
          : (deriveMealNameFromFoods(foods) ?? ""),
        edited: true,
        foodsEdited: true,
        nutritionEdited: false,
        nutritionEstimate: estimateLocalNutrition(foods),
      };
    });
  }

  function startEditingFood(index: number, value: string) {
    setEditingFoodIndex(index);
    setFoodEditValue(value);
  }

  function replaceFoodAtIndex(index: number, value: string) {
    const reviewedValue = value.trim();
    if (!voiceDraft || !reviewedValue) return;
    const foods = splitFoodDescriptions(voiceDraft.foodsText);
    if (!foods[index]) return;
    foods[index] = reviewedValue;
    updateVoiceDraft("foodsText", foods.join(", "));
  }

  function updateNutritionTotal(field: keyof MacroNutrients, value: string) {
    const parsed = value.trim() ? Number(value) : 0;
    if (!Number.isFinite(parsed)) return;
    setVoiceDraft((current) =>
      current
        ? {
            ...current,
            edited: true,
            nutritionEdited: true,
            nutritionEstimate: {
              ...current.nutritionEstimate,
              totals: {
                ...current.nutritionEstimate.totals,
                [field]: Math.max(0, parsed),
              },
            },
          }
        : current,
    );
  }

  function reviewedVoiceDraft(): AppliedBrowserVoiceMealDraft | undefined {
    if (!voiceDraft) return;
    return {
      transcript: voiceDraft.transcript,
      mealName: voiceDraft.mealName.trim(),
      time: voiceDraft.time,
      foods: splitFoodDescriptions(voiceDraft.foodsText),
      providerId: WEB_LFM_PROVIDER_ID,
      model: WEB_LFM_MODEL_ID,
      generatedAt: voiceDraft.generatedAt,
      edited: voiceDraft.edited,
      foodsEdited: voiceDraft.foodsEdited,
      nutritionEdited: voiceDraft.nutritionEdited,
      nutritionEstimate: voiceDraft.nutritionEstimate,
    };
  }

  function clearVoiceDraft() {
    setVoiceDraft(undefined);
    setNutritionEditing(false);
    setEditingFoodIndex(undefined);
    setFoodEditValue("");
    setTranscript("");
    transcriptRef.current = "";
  }

  function applyVoiceDraft() {
    const reviewedDraft = reviewedVoiceDraft();
    if (!reviewedDraft) return;
    onApply(reviewedDraft);
    clearVoiceDraft();
  }

  function addVoiceDraft() {
    const reviewedDraft = reviewedVoiceDraft();
    if (!reviewedDraft) return;
    onAdd(reviewedDraft);
    clearVoiceDraft();
    setActionMessage("The reviewed meal was added directly to this browser session.");
  }

  const speechModelReady = speechModelState.status === "ready";
  const lfmModelReady = lfmModelState.status === "ready";
  const modelsReady = speechModelReady && lfmModelReady;
  const modelsPreparing =
    speechModelState.status === "preparing" || lfmModelState.status === "preparing";
  const availableModelsReady =
    lfmModelReady && (speechModelReady || Boolean(speechAccessMessage));
  const draftHasMeal = Boolean(
    voiceDraft?.mealName.trim() || splitFoodDescriptions(voiceDraft?.foodsText ?? "").length,
  );

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
            Distil-Whisper transcribes a complete local recording or you can type a
            description. LFM2.5 extracts the meal name, foods, and stated portions; a compact
            local reference then prepares reviewable nutrition estimates.
          </p>
        </div>
      </div>

      <DemoCard className="grid gap-5 border-[#cfc4fa] bg-[#fbfaff] p-5 sm:p-6">
        <div className="flex items-start gap-3 rounded-lg border border-[#cfe6d8] bg-[#f1fbf5] p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#287a4b]" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-[#21643f]">Local processing only</p>
            <p className="mt-1 text-xs leading-5 text-[#526f60]">
              GlucoFinity does not upload the audio or transcript and does not call an AI API.
              Model files are downloaded on first use and reused locally. If this browser
              cannot run the models on-device, voice recording stays disabled. Use only
              fictional meal descriptions in this public prototype.
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border border-[#ddd5fb] bg-white p-4">
          <div className="flex items-start gap-3">
            <Cpu className="mt-0.5 size-5 shrink-0 text-[#6049bc]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#0b1f33]">
                1. Prepare local Distil-Whisper and LFM2.5
              </p>
              <p className="mt-1 text-xs leading-5 text-[#64768a]">
                The first use downloads the English Distil-Whisper speech model plus the
                approximately 850 MB Q4 language model and stores reusable files in this
                browser. WebGPU and an internet connection are required for setup.
              </p>
            </div>
          </div>
          {lfmAccessMessage ? (
            <p className="rounded-lg bg-[#fff7e6] px-3 py-2 text-xs leading-5 text-[#7a5411]">
              {lfmAccessMessage}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void prepareModels()}
              disabled={modelsPreparing || availableModelsReady}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#cfc4fa] bg-[#f5f2ff] px-4 text-sm font-semibold text-[#6049bc] hover:bg-[#ede8ff] disabled:cursor-not-allowed disabled:opacity-65 sm:w-fit"
            >
              <Download className="size-4" aria-hidden="true" />
              {speechModelState.status === "preparing"
                ? `Preparing Distil-Whisper (${speechModelState.progress}%)`
                : lfmModelState.status === "preparing"
                  ? `Preparing LFM2.5 (${lfmModelState.progress}%)`
                  : availableModelsReady
                    ? speechModelReady
                      ? "Local models ready"
                      : "LFM2.5 ready for typed entry"
                    : speechModelState.status === "error" || lfmModelState.status === "error"
                      ? "Retry local model setup"
                      : "Prepare local models"}
            </button>
          )}
          {speechAccessMessage ? (
            <p className="rounded-lg bg-[#fff7e6] px-3 py-2 text-xs leading-5 text-[#7a5411]">
              {speechAccessMessage} Typed meal entry remains available after preparing LFM2.5.
            </p>
          ) : null}
          {speechModelState.status === "preparing" ? (
            <ModelProgress label="Distil-Whisper preparation" value={speechModelState.progress} />
          ) : null}
          {lfmModelState.status === "preparing" ? (
            <ModelProgress label="LFM2.5 preparation" value={lfmModelState.progress} />
          ) : null}
        </div>

        <div className="grid gap-3 rounded-lg border border-[#dce5ee] bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-[#0b1f33]">2. Speak or type the meal</p>
            <p className="mt-1 text-xs leading-5 text-[#64768a]">
              {speechModelReady
                ? "Distil-Whisper is ready to transcribe a complete recording locally."
                : "Prepare the local models before recording. Typed meal entry remains available once LFM2.5 is ready."}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#64768a]">
              Press once to start recording. Pauses will not submit the meal; press the same
              button again when you are finished. You can name several foods and portions in
              one recording. The transcript appears after Distil-Whisper processes the clip.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void (recording ? stopRecording() : startRecording())}
            disabled={!modelsReady || processing}
            aria-pressed={recording}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit ${
              recording ? "bg-[#a43b3b] hover:bg-[#8c3030]" : "bg-[#1268e8] hover:bg-[#0f57c3]"
            }`}
          >
            {recording ? (
              <MicOff className="size-4" aria-hidden="true" />
            ) : (
              <Mic className="size-4" aria-hidden="true" />
            )}
            {recording ? "Stop recording and process" : "Start recording"}
          </button>
          <label className="grid gap-1.5 text-sm font-semibold text-[#34495e]">
            Distil-Whisper transcript or typed description
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
            disabled={!lfmModelReady || !transcript.trim() || recording || processing}
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
              Nothing is saved yet. Review the meal, time, and estimated nutrition, then add
              it directly or continue in the full form to include notes.
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
              Meal name (from foods)
              <input
                value={voiceDraft.mealName}
                onChange={(event) => updateVoiceDraft("mealName", event.target.value)}
                maxLength={80}
                className="h-11 rounded-lg border border-[#cbd8e4] bg-white px-3 font-normal text-[#0b1f33]"
                placeholder="Food name or food combination"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#34495e]">
              Meal time (local)
              <MealTimeSelect
                value={voiceDraft.time}
                onChange={(value) => updateVoiceDraft("time", value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#34495e] sm:col-span-2">
              Foods and portions (one per line or comma separated)
              <textarea
                value={voiceDraft.foodsText}
                onChange={(event) => updateVoiceDraft("foodsText", event.target.value)}
                rows={3}
                className="rounded-lg border border-[#cbd8e4] bg-white px-3 py-2.5 font-normal text-[#0b1f33]"
                placeholder="Example: 1 cup brown rice, 4 oz salmon"
              />
            </label>
          </div>
          <div className="grid gap-4 rounded-lg border border-[#cfe0f2] bg-[#f7fbff] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <Calculator className="mt-0.5 size-5 shrink-0 text-[#1268e8]" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-[#0b1f33]">Estimated nutrition</p>
                  <p className="mt-1 text-xs leading-5 text-[#64768a]" aria-live="polite">
                    {voiceDraft.nutritionEdited
                      ? "These values include your edits and still require review."
                      : `${voiceDraft.nutritionEstimate.matchedFoodCount} of ${voiceDraft.nutritionEstimate.totalFoodCount} foods matched the local reference. Unmatched foods are excluded from the totals.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNutritionEditing((current) => !current)}
                aria-expanded={nutritionEditing}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#b8d3f0] bg-white px-3 text-xs font-semibold text-[#0e5ab7] hover:bg-[#edf5ff] sm:shrink-0"
              >
                <Pencil className="size-4" aria-hidden="true" />
                {nutritionEditing
                  ? "Done editing"
                  : voiceDraft.nutritionEstimate.matchedFoodCount > 0
                    ? "Edit nutrition"
                    : "Enter nutrition"}
              </button>
            </div>

            {nutritionEditing ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <NutritionInput
                  label="Calories"
                  value={voiceDraft.nutritionEstimate.totals.calories}
                  onChange={(value) => updateNutritionTotal("calories", value)}
                />
                <NutritionInput
                  label="Carbs (g)"
                  value={voiceDraft.nutritionEstimate.totals.carbohydratesGrams}
                  onChange={(value) => updateNutritionTotal("carbohydratesGrams", value)}
                />
                <NutritionInput
                  label="Protein (g)"
                  value={voiceDraft.nutritionEstimate.totals.proteinGrams}
                  onChange={(value) => updateNutritionTotal("proteinGrams", value)}
                />
                <NutritionInput
                  label="Fat (g)"
                  value={voiceDraft.nutritionEstimate.totals.fatGrams}
                  onChange={(value) => updateNutritionTotal("fatGrams", value)}
                />
                <NutritionInput
                  label="Fiber (g)"
                  value={voiceDraft.nutritionEstimate.totals.fiberGrams}
                  onChange={(value) => updateNutritionTotal("fiberGrams", value)}
                />
              </div>
            ) : voiceDraft.nutritionEstimate.matchedFoodCount > 0 || voiceDraft.nutritionEdited ? (
              <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
                <NutritionMetric label="Calories" value={voiceDraft.nutritionEstimate.totals.calories} />
                <NutritionMetric label="Carbs" value={voiceDraft.nutritionEstimate.totals.carbohydratesGrams} unit="g" />
                <NutritionMetric label="Protein" value={voiceDraft.nutritionEstimate.totals.proteinGrams} unit="g" />
                <NutritionMetric label="Fat" value={voiceDraft.nutritionEstimate.totals.fatGrams} unit="g" />
                <NutritionMetric label="Fiber" value={voiceDraft.nutritionEstimate.totals.fiberGrams} unit="g" />
              </dl>
            ) : null}

            <ul className="grid gap-2" aria-label="Per-food nutrition matches">
              {voiceDraft.nutritionEstimate.foods.map((food, index) => {
                const suggestions = food.nutrients
                  ? []
                  : findLocalNutritionSuggestions(food.input);
                const editingThisFood = editingFoodIndex === index;
                const suggestionHeading = suggestions.some(
                  ({ matchBasis }) => matchBasis === "text",
                )
                  ? "Closest foods in the local reference"
                  : suggestions.some(({ matchBasis }) => matchBasis === "food-family")
                    ? "Closest food-family options in the local reference"
                    : "Closest available options in the local reference";
                return (
                  <li
                    key={`${food.input}-${index}`}
                    className="rounded-lg border border-[#dce5ee] bg-white p-3"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#0b1f33]">{food.input}</p>
                        <p className="mt-1 text-xs leading-5 text-[#64768a]">
                          {food.matchedName
                            ? `${food.matchedName} · ${food.portionLabel}`
                            : food.unresolvedReason}
                        </p>
                      </div>
                      {food.nutrients ? (
                        <p className="shrink-0 text-xs font-semibold text-[#34495e]">
                          {food.nutrients.carbohydratesGrams}g carbs · {food.nutrients.proteinGrams}g protein ·{" "}
                          {food.nutrients.fatGrams}g fat · {food.nutrients.fiberGrams}g fiber
                        </p>
                      ) : null}
                    </div>

                    {!food.nutrients ? (
                      <div className="mt-3 grid gap-3 border-t border-[#e4ebf2] pt-3">
                        {editingThisFood ? (
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                            <label className="grid gap-1.5 text-xs font-semibold text-[#526477]">
                              Edit ingredient and portion
                              <input
                                value={foodEditValue}
                                onChange={(event) => setFoodEditValue(event.target.value)}
                                maxLength={120}
                                className="h-10 min-w-0 rounded-lg border border-[#b8d3f0] bg-white px-3 text-sm font-normal text-[#0b1f33]"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFoodIndex(undefined);
                                setFoodEditValue("");
                              }}
                              className="h-10 rounded-lg border border-[#cbd8e4] px-3 text-xs font-semibold text-[#526477] hover:bg-[#f7fafc]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => replaceFoodAtIndex(index, foodEditValue)}
                              disabled={!foodEditValue.trim()}
                              className="h-10 rounded-lg bg-[#1268e8] px-3 text-xs font-semibold text-white hover:bg-[#0f57c3] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Update ingredient
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditingFood(index, food.input)}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#b8d3f0] bg-white px-3 text-xs font-semibold text-[#0e5ab7] hover:bg-[#edf5ff] sm:w-fit"
                          >
                            <Pencil className="size-4" aria-hidden="true" /> Edit ingredient
                          </button>
                        )}

                        {suggestions.length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold text-[#34495e]">
                              {suggestionHeading}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {suggestions.map((suggestion) => (
                                <button
                                  key={suggestion.fdcId}
                                  type="button"
                                  onClick={() =>
                                    replaceFoodAtIndex(index, suggestion.suggestedInput)
                                  }
                                  className="rounded-lg border border-[#cfc4fa] bg-[#f8f6ff] px-3 py-2 text-left text-xs text-[#34495e] hover:bg-[#f0edff]"
                                >
                                  <span className="block font-semibold text-[#6049bc]">
                                    Use {suggestion.name}
                                  </span>
                                  <span className="mt-0.5 block text-[11px] text-[#64768a]">
                                    {suggestion.matchBasis === "text"
                                      ? "Close text match"
                                      : suggestion.matchBasis === "food-family"
                                        ? "Related food family"
                                        : "Broader local option"}
                                    {" · "}
                                    {suggestion.suggestedInput}
                                  </span>
                                </button>
                              ))}
                            </div>
                            <p className="mt-2 text-[11px] leading-5 text-[#718096]">
                              Suggestions are ranked local choices, not equivalents or automatic
                              substitutions. Broader options may differ significantly; choose one
                              only if it matches what you ate.
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {voiceDraft.nutritionEstimate.defaultPortionCount > 0 ? (
              <p className="rounded-lg bg-[#fff7e6] px-3 py-2 text-xs leading-5 text-[#7a5411]">
                {voiceDraft.nutritionEstimate.defaultPortionCount} matched{" "}
                {voiceDraft.nutritionEstimate.defaultPortionCount === 1 ? "food uses" : "foods use"} an
                assumed reference portion. Add a quantity and unit above for a more specific estimate.
              </p>
            ) : null}

            <p className="text-[11px] leading-5 text-[#718096]">
              Local prototype subset adapted from{" "}
              <a
                href={voiceDraft.nutritionEstimate.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#0e5ab7] underline underline-offset-2"
              >
                USDA FoodData Central SR Legacy
              </a>
              . This is not a live USDA integration. Values are estimates and require review.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setVoiceDraft(undefined);
                setNutritionEditing(false);
                setEditingFoodIndex(undefined);
                setFoodEditValue("");
              }}
              className="h-11 rounded-lg border border-[#cbd8e4] px-4 text-sm font-semibold text-[#34495e] hover:bg-[#f7fafc]"
            >
              Discard draft
            </button>
            <button
              type="button"
              onClick={applyVoiceDraft}
              disabled={!draftHasMeal}
              className="h-11 rounded-lg border border-[#b8d3f0] bg-white px-4 text-sm font-semibold text-[#0e5ab7] hover:bg-[#edf5ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue in full form
            </button>
            <button
              type="button"
              onClick={addVoiceDraft}
              disabled={!draftHasMeal}
              className="h-11 rounded-lg bg-[#1268e8] px-4 text-sm font-semibold text-white hover:bg-[#0f57c3] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add to session
            </button>
          </div>
          <p className="text-[11px] leading-5 text-[#718096]">
            Provenance: local {WEB_WHISPER_MODEL_ID} transcribes recorded audio; local{" "}
            {WEB_LFM_MODEL_ID} extracts transcript-grounded foods; local{" "}
            {voiceDraft.nutritionEstimate.sourceId} calculates nutrition. None predicts glucose
            effects or provides medical guidance.
          </p>
        </DemoCard>
      ) : null}
    </section>
  );
}

function NutritionMetric({
  label,
  value,
  unit = "",
}: {
  label: string;
  value: number;
  unit?: string;
}) {
  return (
    <div className="rounded-lg bg-white p-2">
      <dt className="text-[11px] text-[#718096]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-[#0b1f33]">
        {value}
        {unit ? ` ${unit}` : ""}
      </dd>
    </div>
  );
}

function ModelProgress({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-[#e8e2fb]"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <span
        className="block h-full rounded-full bg-[#7257d9] transition-[width]"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function NutritionInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-[#526477]">
      {label}
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        max="10000"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 min-w-0 rounded-lg border border-[#b8d3f0] bg-white px-3 text-sm font-normal text-[#0b1f33]"
      />
    </label>
  );
}
