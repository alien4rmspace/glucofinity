import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const exportedPage = new URL("../out/index.html", import.meta.url);
const exportedDemoPage = new URL("../out/demo/index.html", import.meta.url);

async function readExport() {
  return readFile(exportedPage, "utf8");
}

test("exports the complete GlucoFinity prototype", async () => {
  const html = await readExport();

  assert.match(
    html,
    /<title>GlucoFinity \| Understand Your Glucose Patterns<\/title>/i,
  );
  assert.match(html, /Discover the possibilities within your glucose data\./);
  assert.match(html, /Fictional demonstration data/);
  assert.match(html, /id="features"/);
  assert.match(html, /id="how-it-works"/);
  assert.match(html, /id="insights"/);
  assert.match(html, /id="safety"/);
  assert.match(html, /https:\/\/damiansaelee\.com\/glucofinity/);
  assert.match(html, /\/glucofinity\/_next\/static\//);
  assert.match(html, /\/glucofinity\/favicon\.svg/);
  assert.match(html, /glucofinity-lockup-transparent\.[a-z0-9_]+\.png/);
  assert.match(html, /glucofinity-mark-transparent\.[a-z0-9_]+\.png/);
  assert.match(html, /educational and informational prototype/i);
  assert.doesNotMatch(
    html,
    /codex-preview|Your site is taking shape|react-loading-skeleton/i,
  );
});

test("keeps the AI foundation evidence-first and reviewable", async () => {
  const [demoMeals, demoInsights, mealAnalysis, aiPanel, aiService, visionProvider, voiceEntry, mealTimeSelect, whisperProvider, whisperWorker, localModelProvider, localModel, nutritionEstimator, nutritionReference] = await Promise.all([
    readFile(new URL("../components/demo/demo-meals.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/demo/demo-insights.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/sections/meal-analysis.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/demo/ai-foundation-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../services/ai-foundation.ts", import.meta.url), "utf8"),
    readFile(new URL("../services/meal-vision-provider.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/demo/voice-meal-entry.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/demo/meal-time-select.tsx", import.meta.url), "utf8"),
    readFile(new URL("../services/browser-whisper-speech-provider.ts", import.meta.url), "utf8"),
    readFile(new URL("../workers/whisper-meal.worker.ts", import.meta.url), "utf8"),
    readFile(new URL("../services/browser-meal-language-provider.ts", import.meta.url), "utf8"),
    readFile(new URL("../services/meal-transcript-extraction.ts", import.meta.url), "utf8"),
    readFile(new URL("../services/local-nutrition-estimator.ts", import.meta.url), "utf8"),
    readFile(new URL("../data/local-nutrition-reference.ts", import.meta.url), "utf8"),
  ]);

  assert.match(demoMeals, /ai-estimated/);
  assert.match(demoMeals, /ai-corrected/);
  assert.match(demoMeals, /User-corrected AI estimate/);
  assert.equal(demoMeals.match(/step="any"/g)?.length, 5);
  assert.equal(demoMeals.match(/inputMode="decimal"/g)?.length, 5);
  assert.match(mealAnalysis, /step="any"/);
  assert.match(mealAnalysis, /inputMode="decimal"/);
  assert.match(demoInsights, /Evidence: n =/);
  assert.match(aiPanel, /Observed remains separate from predicted/);
  assert.match(aiPanel, /No evaluated model/);
  assert.match(aiPanel, /remain missing rather than being changed to zero/);
  assert.match(aiService, /meal-prediction-features-v1/);
  assert.match(aiService, /response\.dataQuality === "good"/);
  assert.match(visionProvider, /interface MealVisionProvider/);
  assert.match(voiceEntry, /Local processing only/);
  assert.match(voiceEntry, /Nothing is saved yet/);
  assert.match(voiceEntry, /Estimated nutrition/);
  assert.match(voiceEntry, /Edit nutrition/);
  assert.match(voiceEntry, /Edit ingredient/);
  assert.match(voiceEntry, /Closest foods in the local reference/);
  assert.match(voiceEntry, /Closest food-family options/);
  assert.match(voiceEntry, /Closest available options/);
  assert.match(voiceEntry, /Related food family/);
  assert.match(voiceEntry, /Broader local option/);
  assert.match(voiceEntry, /Update ingredient/);
  assert.match(voiceEntry, /not equivalents or automatic/);
  assert.match(voiceEntry, /Continue in full form/);
  assert.match(voiceEntry, /Add to session/);
  assert.match(voiceEntry, /Press once to start recording/);
  assert.match(voiceEntry, /stopRecordingAndTranscribe/);
  assert.match(voiceEntry, /Live provisional Distil-Whisper transcript/);
  assert.match(voiceEntry, /provisional transcript refreshes every few/);
  assert.match(voiceEntry, /Distil-Whisper transcript or typed description/);
  assert.match(whisperProvider, /new MediaRecorder/);
  assert.match(whisperProvider, /LIVE_PREVIEW_INTERVAL_MS = 4_000/);
  assert.match(whisperProvider, /startLivePreview/);
  assert.match(whisperProvider, /liveTranscriptListener/);
  assert.match(whisperProvider, /OfflineAudioContext/);
  assert.match(whisperProvider, /TARGET_SAMPLE_RATE = 16_000/);
  assert.match(whisperProvider, /audio\.buffer/);
  assert.match(whisperWorker, /onnx-community\/distil-small\.en/);
  assert.match(whisperWorker, /automatic-speech-recognition/);
  assert.match(whisperWorker, /encoder_model: "fp32"/);
  assert.match(whisperWorker, /decoder_model_merged: "q4"/);
  assert.match(whisperWorker, /chunk_length_s: 30/);
  assert.match(localModelProvider, /groundedFallback/);
  assert.match(localModel, /one foods array item for every explicitly stated food/);
  assert.match(localModel, /may omit all punctuation and connector words/);
  assert.equal(voiceEntry.match(/step="any"/g)?.length, 1);
  assert.equal(voiceEntry.match(/inputMode="decimal"/g)?.length, 1);
  assert.match(demoMeals, /MealTimeSelect/);
  assert.match(mealTimeSelect, /<select/);
  assert.match(mealTimeSelect, /MINUTES_PER_OPTION = 15/);
  assert.match(mealTimeSelect, /nearestLocalMealTime/);
  assert.match(voiceEntry, /USDA FoodData Central SR Legacy/);
  assert.match(localModel, /parseMealTranscriptExtraction/);
  assert.match(localModelProvider, /new Worker/);
  assert.match(nutritionEstimator, /estimateLocalNutrition/);
  assert.match(nutritionEstimator, /findLocalNutritionSuggestions/);
  assert.match(nutritionEstimator, /usedDefaultPortion/);
  assert.match(demoMeals, /voiceDraft\.foodsEdited/);
  assert.match(nutritionReference, /usda-fdc-sr-legacy-local-v1/);
  assert.match(nutritionReference, /fdcId: 172187/);
  assert.doesNotMatch(aiPanel, /insulin dose|medication dose|treatment recommendation/i);
});

test("exports the required medical-safety language", async () => {
  const html = await readExport();

  assert.match(
    html,
    /not a substitute for a licensed healthcare professional/i,
  );
  assert.match(
    html,
    /Medication or insulin decisions should not be changed/i,
  );
  assert.match(
    html,
    /Nutrition values and glucose predictions are estimates/i,
  );
  assert.match(
    html,
    /rigorous validation, privacy protections, security controls, and regulatory review/i,
  );
  assert.match(
    html,
    /does not imply university endorsement, clinical evidence/i,
  );
});

test("exports the dedicated interactive demo route", async () => {
  const [homeHtml, demoHtml] = await Promise.all([
    readExport(),
    readFile(exportedDemoPage, "utf8"),
  ]);

  assert.match(homeHtml, /href="\/glucofinity\/demo\/"/);
  assert.match(demoHtml, /<title>Interactive Demo \| GlucoFinity<\/title>/i);
  assert.match(demoHtml, /Interactive educational prototype/);
  assert.match(demoHtml, /Your fictional day at a glance/);
  assert.match(demoHtml, /normalized fictional examples with source provenance/i);
  assert.match(demoHtml, /Review meal response metrics/i);
  assert.match(demoHtml, /All readings, meals, calculations, and observations are fictional/i);
  assert.match(demoHtml, /Not for diagnosis, treatment, medication, or insulin decisions/i);
  assert.doesNotMatch(demoHtml, /connected to a real sensor/i);
});
