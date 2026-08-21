# GlucoFinity AI/ML foundation

GlucoFinity keeps meal understanding, tabular prediction, time-series forecasting,
pattern discovery, and language generation as separate responsibilities. This is an
educational prototype architecture; it is not clinical validation or medical advice.

```text
Meal image -> MealVisionProvider -> reviewable structured nutrition
                                      |
Voice -> Apple on-device speech -> transcript -> local LFM2.5 text extraction
                                                   -> reviewable name + foods
                                      |
Normalized glucose + meal + optional observed context
                                      |
                     deterministic feature engine
                         |                         |
              training dataset export      inference contract
                         |                         |
            offline Python/XGBoost          versioned prediction

CGM sequence + events -> separate ContinuousGlucoseForecaster contract

Calculated observations -> deterministic pattern discovery -> evidence object
                                                        -> explanation-only language layer
```

## App-side boundaries

- `services/meal-vision-provider.ts` defines the provider-neutral meal-photo
  interface, validates provider responses, and supplies the current deterministic
  fixture provider. A future hosted or on-device provider must implement the same
  interface; no paid AI API is called today.
- `services/apple-speech-service.ts` and `modules/glucofinity-speech/` expose Apple
  on-device speech transcription. iOS 26 uses SpeechAnalyzer when supported; older
  supported iOS releases require `SFSpeechRecognizer` on-device capability and force
  on-device recognition without a server fallback.
- `services/local-meal-language-provider.ts` explicitly downloads/loads quantized
  LFM2.5-1.2B-Instruct through React Native ExecuTorch and uses it only to extract
  editable meal names and explicitly spoken foods.
- `services/meal-transcript-extraction.ts` constrains prompts and validates JSON model
  output against the transcript. It rejects hallucinated fields and never accepts
  nutrition, glucose, or treatment output.
- `types/ai.ts` defines food estimates, nutrition provenance, features, training
  examples, model metadata, predictions, and evidence-backed insights.
- `features/meal-prediction-features.ts` is the only meal-response feature generator.
  It is deterministic and independent from React Native UI code.
- `services/meal-training-dataset.ts` converts meals and observed response records
  into exportable examples and explicitly marks eligibility.
- `services/model-registry.ts`, `services/model-validation.ts`, and
  `services/meal-response-predictor.ts` form the traceable inference boundary.
- `types/forecasting.ts` deliberately separates continuous time-series forecasting
  from meal-response regression. No neural network is implemented without suitable
  longitudinal data.
- `services/pattern-discovery.ts` computes supported comparisons. The language
  provider in `services/insight-language-provider.ts` may explain those evidence
  objects but may not calculate or invent relationships.

The meal form labels persisted nutrition as `manual`, `ai-estimated`, or
`ai-corrected`. Generated food names and nutrition values remain editable before save.
Unknown nutrition and context values stay absent; they are not converted to zero.
Voice extraction adds no nutrition values. Its temporary recording is deleted after
transcription, and the transcript is persisted only if the user applies and saves the
draft.

## Feature schema

Feature version: `meal-prediction-features-v1`.

| Group | Fields |
| --- | --- |
| Nutrition | carbohydrate, protein, fat, fiber, calories, estimated meal grams |
| Current glucose | observed baseline, recent 30-minute mean, population variability, recent valid slope |
| Timing | minutes since previous meal, local fractional hour, local day of week (Sunday = 0) |
| Optional observed context | exercise minutes in the preceding 24 hours, latest sleep duration, historical similar-meal response |

Slope requires two nearby readings and is omitted across gaps longer than 20 minutes.
Optional exercise, sleep, and historical fields are included only when observed data or
an explicit caller-supplied value exists. Explicit zero remains zero.

## Training dataset

Dataset schema: `meal-training-dataset-v1`.

Each example contains its meal/time identifiers, feature version, sparse features,
observed labels, response data quality, training eligibility, exclusion reasons, and
glucose source provenance. Labels may include observed rise, peak, time to peak,
two-hour glucose, and incremental AUC. Only `good` response records with at least one
observed label are eligible; `limited` and `insufficient` examples remain reviewable in
the export but are excluded from training.

Exports must declare `dataOrigin` as `authorized-user-export` or
`synthetic-fixture`. The repository does not contain real personal health data.

## Offline XGBoost pipeline

The standalone `ml/` Python package trains one XGBoost regressor per available target.
The checked-in configuration fixes the random seed, feature version, hyperparameters,
minimum per-target sample count, and model version. Missing values reach XGBoost as
`NaN` rather than being imputed as zero.

Eligible examples are ordered by meal timestamp and divided into older training data,
more recent validation data, and newest test data using a 70/15/15 chronological split.
Validation and test partitions are never used to fit the model. Evaluation reports MAE,
RMSE, and R² separately per target where labels exist. A constant-label partition leaves
R² unavailable instead of inventing a value.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e ml
python ml/scripts/generate_synthetic_dataset.py --output synthetic-dataset.json
python -m glucofinity_ml.training --dataset synthetic-dataset.json --output model-output
```

The generated registry records the model ID/type/version, feature version, training
timestamp, training sample count, data origin, per-target artifact, and evaluation
metrics. The deterministic synthetic generator is only a pipeline fixture. Synthetic
metrics must never be described as user, real-world, or clinical performance.

No evaluation result is reported in this repository because no authorized,
representative real dataset is available. No trained artifact is bundled with the app.

## Inference and safety

`runMealResponsePrediction` validates sparse inputs, requires an exact registered
model ID/version and feature version, validates output fields, and rejects mismatched
prediction provenance. The runtime adapter that would load a reviewed model artifact
on-device or call a secured inference service is intentionally deferred. Therefore the
current app displays observed response metrics only and does not pretend that a model
prediction exists.

Future prediction UI must label values as **predicted** or **estimated**, keep them
visually separate from **observed** metrics, and include model provenance. Neither the
model nor the language layer may provide diagnoses, medication or insulin guidance,
treatment changes, or claims that a food is medically safe or unsafe.

## Verification

```powershell
npm test
npm run test:ml
npm run lint
npm run typecheck
npx expo install --check
npx expo-doctor
```

The next meaningful model milestone is a reviewed, consented export workflow and a
minimum-data policy. Only then should the team train/evaluate a personalized baseline,
select a secure inference runtime, and add an explicitly labeled prediction UI. Sequence
models should remain deferred until enough high-quality longitudinal data justifies them.
