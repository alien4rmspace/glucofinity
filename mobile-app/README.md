# GlucoFinity

GlucoFinity is an educational mobile healthcare technology prototype for reviewing
glucose readings alongside meals and daily context. It can use clearly labeled fictional
demo readings, read permitted Apple Health blood glucose and fitness records in a custom iOS build,
or read permitted Android Health Connect records in a custom Android build. It provides
descriptive patterns, not diagnosis, treatment, prescriptions, insulin guidance, or a
substitute for a qualified healthcare professional.

## Implemented MVP

- Five-tab Expo Router navigation: Dashboard, Logs, Trends, Insights, and Settings.
- Optional deterministic mock glucose readings at five-minute intervals with meal-shaped variation.
- Responsive glucose line chart with 3-, 6-, 12-, and 24-hour ranges and tap inspection.
- Calculated average, minimum, maximum, time in prototype range, standard deviation,
  largest observed rise, hourly summaries, and configurable meal-response analysis.
- A provider-independent glucose model that normalizes mg/dL and mmol/L inputs, preserves
  source metadata, generates stable IDs, rejects malformed values, and removes duplicates.
- Observed meal-response metrics for baseline, peak, rise, time to peak, nearby 60- and
  120-minute readings, incremental AUC, return near baseline, sample count, and data quality.
- A meal-centered glucose chart that marks the meal and baseline while leaving longer
  sampling gaps disconnected.
- Locally persisted meal create, edit, delete, photo-library, and camera workflows.
- On-device iOS voice meal entry using live Apple Speech plus a local quantized
  LFM2.5-1.2B-Instruct model, with automatic first-use model setup, punctuation-independent
  multi-food extraction, an on-disk SQLite reference covering 13,591 estimate-ready USDA
  generic foods, and editable review before direct save or continuation in the full form.
- On-device iOS voice medication entry using the same cached speech/model pipeline, with
  transcript correction, explicit completed-event validation, automatic population of the
  inline-editable medication form, non-inference of missing dose/route/time details, and the
  existing duplicate warning.
- Provider-neutral, validated meal-image estimates with editable foods/nutrition and
  persisted manual, AI-estimated, or user-corrected provenance.
- UPC/EAN product scanning with manual-number fallback, a hosted offline USDA branded-product
  catalog, available serving-level label nutrition, configurable deterministic Overall Food
  and Estimated Glucose Impact scores, processing analysis, explicit missing-data handling,
  serving adjustment, and local product-as-meal logging for future observed-response joins.
- Deterministic feature generation, ML-ready eligibility-aware dataset exports, model
  validation/registry contracts, and evidence-backed preliminary insights.
- A no-source first-run default, persisted unit and target-range settings, and explicitly
  opt-in fictional demo readings for testing.
- A read-only Apple Health adapter with explicit authorization, source selection, blood
  glucose queries, and today's step, active-energy, and workout context.
- A read-only Android Health Connect adapter with explicit permission and source selection.
- A dismissible dashboard prompt that identifies the device's health app and routes the
  user to the existing, explicit read-only connection controls without requesting health
  permission automatically.
- Local privacy explanation, safety language, and local-data reset.
- A separate reproducible Python/XGBoost training package with chronological dataset
  splitting and MAE/RMSE/R² evaluation infrastructure. No trained model is invoked.
- Pure-function unit tests for glucose calculations, normalization, meal response, feature
  records, and native-health record mapping.

## Technology

- Expo SDK 54 and React Native 0.81
- React 19 and strict TypeScript
- Expo Router
- AsyncStorage for meal and preference persistence
- Expo ImagePicker for photo-library and camera access
- Expo Camera for on-device UPC/EAN barcode recognition
- Expo Audio permissions and a local Expo/Swift module for live Apple on-device speech recognition
- Expo SQLite for indexed, on-device USDA food and portion lookup
- React Native ExecuTorch for local LFM2.5 meal and medication field extraction
- React Native HealthKit for iOS blood glucose, step, active-energy, and workout reads
- React Native Health Connect for Android blood glucose reads
- React Native SVG for accessible charts
- Lucide React Native icons
- Node test runner through `tsx`
- Python 3.11+, NumPy, scikit-learn, and XGBoost for the optional offline `ml/`
  environment

## Install and run

Requirements: Node.js 20.19 or newer and npm. Expo recommends an LTS Node release.

```bash
npm install
npx expo start --clear
```

Scan the QR code with the Expo Go app that supports SDK 54. On Windows systems that
block PowerShell script wrappers, use `npm.cmd` and `npx.cmd` in place of `npm` and
`npx`. Expo Go runs the fictional demo source; it does not include the custom native
Apple Health, Health Connect, Apple Speech, or ExecuTorch bridge.

To use Apple Health, create and install the iOS native build on macOS:

```bash
npx expo prebuild --clean --platform ios
npm run ios:native
```

Then open Settings in GlucoFinity and choose **Connect Apple Health**. See
`HEALTHKIT_SETUP.md` for signing, permission, device-test, and release requirements.
The same custom iOS build enables voice meal and medication entry. See `VOICE_ENTRY_SETUP.md` for its
privacy boundary, local model download, supported iOS versions, and device checklist.

To use Health Connect, create and install the Android native build instead:

```bash
npx expo prebuild --clean
npm run android:native
```

Then open Settings in GlucoFinity and choose **Connect Health Connect**. See
`HEALTH_CONNECT_SETUP.md` for device, permission, test, and release requirements.

Other available commands:

```bash
npm run android
npm run android:native
npm run start:dev-client
npm run ios
npm run ios:native
npm run web
npm run lint
npm run typecheck
npm test
npm run test:ml
npx expo install --check
npx expo-doctor
```

## Architecture

The UI reads glucose values through the `GlucoseRepository` interface. The registry
selects a mock, Apple Health, Health Connect, or empty repository from the persisted
data-source setting. All active providers pass records through the shared normalization
boundary before screens or analysis receive them. Native services request only
blood-glucose read access and load native code lazily so the fictional demo still opens
safely in Expo Go.

```text
Mock / Apple Health / Health Connect
                 ↓
       provider record mapper
                 ↓
 shared validation and normalization
                 ↓
        GlucoseRepository model
           ↙             ↘
 Dashboard / Trends   Meal response analyzer
                              ↓
                   Meal details / feature record
```

```text
app/             Expo Router screens and navigation
components/      Reusable interface and chart components
constants/       Design tokens and default settings
data/            Deterministic fictional fixtures
hooks/           Screen-facing data hooks
providers/       Shared persisted app state
repositories/    Glucose, meal, and settings data access
services/        Insight, response, feature, image, speech, and local-model interfaces
modules/         Local Expo/Swift Apple on-device speech bridge
features/        Deterministic, versioned ML feature generation
ml/              Separate offline Python/XGBoost training and evaluation package
tests/           Pure-function unit tests
types/           Shared domain models
utils/           Date and glucose calculations
```

## Data sources and persistence

New installs begin with no glucose source selected, no seeded example meals, medication
logs, or feeling check-ins. The
dashboard invites the user to open the explicit Apple Health or Health Connect controls;
it never requests health permission automatically. Fictional glucose readings remain an
off-by-default testing option. When a native health source is selected, legacy example
meals from older prototype builds are removed while user-created meals are preserved.

GlucoFinity does not write health records, run background sync, connect directly to a CGM
manufacturer, or upload imported records. Imported records are held in memory for display
and are not copied to AsyncStorage. User-created meal entries, medication logs, feeling
check-ins, and settings are stored on the device with AsyncStorage. Feeling check-ins are timestamped
self-reports designed for later observational comparison with available glucose records;
the current app does not use them to make medical conclusions.

Selected meal image URIs are stored with the meal entry for this prototype. Production
image storage would require a deliberate lifecycle, encryption, backup, and deletion
design.

## Meal-response calculations

The default analysis window begins 30 minutes before a saved meal and ends three hours
after it. Configuration is centralized in `services/meal-glucose-response.ts`.

- Baseline is the average of at least two readings in the pre-meal window, with a reading
  no more than 15 minutes before the meal.
- Peak and time to peak use valid post-meal readings only.
- One- and two-hour values select the nearest reading within 15 minutes; absent readings
  stay unavailable.
- Incremental AUC uses trapezoidal integration above the estimated baseline and skips
  intervals longer than 20 minutes rather than bridging missing CGM data.
- Return near baseline is the first post-peak reading within ±5 mg/dL of baseline, after
  at least 30 minutes.
- Quality is `good` only with a recent baseline, at least 12 post-meal samples, coverage
  through two hours, nearby one- and two-hour values, and no gap over 20 minutes. Other
  analyzable responses are `limited`; fewer than two post-meal readings are
  `insufficient`.

These outputs describe observed associations. They do not identify causation, judge a
meal, or provide treatment guidance.

## AI/ML foundation status

The provider, feature, dataset, registry, inference, forecasting, evidence, and language
boundaries are implemented without coupling the app to a paid API. The meal-image
provider remains a clearly labeled deterministic fixture. A quantized local
LFM2.5-1.2B-Instruct model is wired only for transcript-grounded meal and medication-field
extraction. Medication output is deterministically checked for a completed event and
explicit name, dose, unit, route, and time details. A separate deterministic SQLite catalog estimates reviewable nutrition;
the LLM does not calculate nutrition or predict glucose. No real training data,
evaluated response-prediction artifact, external LLM, or continuous forecasting model is
included. See `AI_ML_ARCHITECTURE.md`, `VOICE_ENTRY_SETUP.md`, and
`NUTRITION_CATALOG_SETUP.md` for the boundaries and remaining validation work.

## Apple Health status

The repositories, combined authorization flow, blood-glucose and daily-fitness queries,
mapping, purpose string, HealthKit entitlement, and source selection are implemented.
Fitness totals use HealthKit cumulative statistics; workouts retain source provenance;
and native records remain in memory. Standard Expo Go cannot load the HealthKit native
module, so a signed custom iOS build and physical-device validation are still required.
iOS does not disclose whether read access was granted; an empty result can mean no
records are available or the user chose not to share them.

## Android Health Connect status

The repository, permission flow, record mapping, manifest permission, config plugin, and
minimum Android SDK configuration are implemented. Physical-device validation is still
required before presenting the integration as production-ready. Android 14 includes
Health Connect in the system; Android 13 and lower require the separate Health Connect
provider app. Expo Go cannot use this native integration.

## Known limitations

- Health Connect behavior has not yet been validated on a physical Android device.
- Apple Health behavior has not yet been validated in a signed build on a physical iPhone.
- Apple on-device live transcription and local LFM2.5 latency, memory use, structured-output
  reliability, and interruption handling have not yet been validated on a physical
  iPhone. Voice entry requires an iOS 17+ custom build and does not run in Expo Go.
- Imported record availability depends on another app or device writing blood glucose
  records to the selected native health store and on the user's permission choice.
- Display trend arrows for imported records are prototype estimates derived from nearby
  adjacent values; they are not sensor-provided medical guidance.
- Meal-image analysis is a labeled deterministic local estimate, not production image
  recognition; all generated nutrition requires user review.
- The v2 branded USDA database required for UPC/GTIN product lookup is hosted and configured
  for future builds. Existing binaries compiled before the environment configuration remain
  unavailable, and the large initial download and scoring flow still require physical-device
  validation.
- No authorized representative training dataset, trained production response model,
  model-backed prediction UI, external LLM, or continuous time-series forecast is
  available yet. The local LFM model only extracts reviewable meal text.
- Meal-response calculations have not been clinically validated and depend on the
  completeness and timing of the selected data source.
- Exercise, sleep, and historical-similarity feature fields remain unavailable until
  explicit data integrations provide observed values; the app does not synthesize them.
- There is no authentication, backend, cloud synchronization, or clinician workflow.
- Settings currently support mg/dL only.
- The app has not undergone clinical, accessibility, privacy, security, or regulatory
  validation.
- As of 2026-08-12, `npm audit --omit=dev` reports 14 moderate and 13 high findings,
  primarily through the Expo SDK 54 and Metro dependency tree. npm's proposed remediations
  include incompatible Expo/React Native version changes. Review the advisories and move
  to a supported newer Expo SDK before production rather than force-changing managed
  package versions independently.

## Suggested next milestones

1. Validate Health Connect installation, permission denial/revocation, empty data, and
   record reads on Android 13 and Android 14+ physical devices.
2. Conduct usability and accessibility reviews on small and large physical devices.
3. Add focused component and navigation tests around meal workflows, response states,
   source switching, and settings.
4. Complete the Google Play Health Connect declaration plus privacy, security, data
   minimization, retention, deletion, and threat-model reviews before release.
5. Create a signed iOS development build and validate Apple Health plus the voice/model
   workflow, permissions, offline behavior, latency, memory, and deletion on physical
   iPhones.
