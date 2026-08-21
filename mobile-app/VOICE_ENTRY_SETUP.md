# On-device voice entry

GlucoFinity can turn a spoken meal description or medication event into an editable
draft without uploading microphone audio or the transcript to a GlucoFinity server.
This is an educational workflow, not diagnosis, treatment, nutrition advice, glucose
prediction, prescribing, medication verification, or dosing guidance.

## Implemented flow

```text
User presses and holds the record control
        |
Apple on-device live speech recognition
        |
partial transcript shown while the user speaks
        |
user releases; final transcript is collected
        |
conservative local grammar and punctuation refinement
        |
local quantized LFM2.5-1.2B-Instruct extraction
        |
transcript-grounded validation
        |
meal: deterministic repair + local nutrition reference
medication: explicit name/status/dose/unit/route/time only
        |
user reviews editable fields before saving
```

- Live voice entry uses `SFSpeechRecognizer` only when
  `supportsOnDeviceRecognition` is true and sets
  `requiresOnDeviceRecognition = true`; there is no network fallback.
- The user controls recording duration by pressing and holding to start, then releasing to stop.
  Partial results update the visible transcript while the microphone is active.
- Before extraction, deterministic local rules turn common rough speech output into a readable
  sentence by adding limited grammar, capitalization, punctuation, and food-list separators.
  They preserve recognized food names and quantities. If refinement changes the text, the
  original Apple transcript remains visible beside the editable refined sentence.
- Microphone buffers are streamed to Apple's on-device recognizer and are not written
  to an app-managed recording file. The module retains its local-file transcription
  method for compatibility, including `SpeechAnalyzer` on supported iOS 26 devices.
- App startup asynchronously prefetches the model, tokenizer, and tokenizer configuration
  through Expo's background-capable resource fetcher without loading the LFM runtime into
  memory. The runtime is loaded from that cache only after recording stops, then released
  after extraction. This avoids keeping the large model and live audio engine resident at
  the same time.
- Live AVAudioEngine setup and teardown are isolated to the main actor, validate an active
  hardware input, keep the device-selected tap format, and remove only a tap installed by
  this module.
- `react-native-executorch` 0.9 runs the quantized
  `lfm2.5-1.2b-instruct-8da4w-rne-v0.9.0` model locally. On a compatible iPhone build,
  the root app provider begins downloading its files as soon as the app opens. Opening the
  voice-entry screens read the same shared progress state; recording stays disabled until
  the files are cached, and manual retry appears only after an automatic failure.
- The model receives a constrained JSON prompt. A deterministic grounded fallback repairs
  omitted punctuation, repeated quantity boundaries, leading phrases such as "Today I
  had," standalone connectors such as "then," and the common "grand"/"grams" speech error.
- The meal name is derived from the reviewed foods rather than breakfast, lunch, dinner,
  or snack labels.
- A generated SQLite catalog of 13,591 estimate-ready USDA FoodData Central generic foods
  (Foundation, SR Legacy, and FNDDS) keeps only
  identity, searchable names, household portions, calories, carbohydrates, protein, fat,
  and fiber. Native searches query the 7.4 MB database on disk instead of expanding the
  complete catalog into JavaScript. The selected generic records omit fiber
  for 744 foods, so those records remain searchable but unresolved rather than treating
  missing fiber as zero. Unmatched and incomplete foods are excluded from totals and receive
  review guidance; suggestions are never applied automatically.
- The review supports transcript correction and explicit reprocessing, recording again,
  15-minute local-time selection, decimal nutrition edits, per-ingredient correction or
  deletion, direct local save, and continuation in the full meal form. Applying remains
  disabled after a transcript edit until the corrected text has refreshed the extracted
  foods and nutrition estimate. Nothing is saved until the user chooses an apply action.
- Medication voice entry accepts only an event described as already having happened, such
  as taken, skipped, or missed. Instructions, schedules, and future plans do not become
  completed events. A dose, unit, route, or exact time remains blank unless deterministic
  validation finds it in the transcript. The model cannot correct a medication name,
  verify a prescription, check interactions, or provide medication advice.
- A successful medication extraction immediately fills the existing editable medication
  form without a separate apply step. The user can change every field before choosing Add
  to session; correcting and reprocessing the transcript refreshes those fields. The existing same-name,
  15-minute possible-duplicate review remains active, and successful additions leave the
  screen open for another event.

Reviewed meal transcripts and values use the same local AsyncStorage-backed store as other
meal entries. Medication voice transcripts are discarded after their structured fields are
copied into the form; only the user-confirmed medication event is stored. The app has no
authentication, cloud sync, or backend upload.

### Regenerating the nutrition reference

The checked-in compact reference was generated from USDA's April 2018 SR Legacy CSV archive
with SHA-256 `b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0`.
After downloading and extracting that archive, regenerate the deterministic asset with:

```bash
npx tsx scripts/generate-sr-legacy-reference.ts <extracted-csv-directory>
npm run generate:nutrition-core -- <extracted-full-csv-directory> assets/data/nutrition-core.db 2026-04
```

The first generator preserves the deterministic compact source; the second creates and
validates the bundled SQLite database. Missing fiber remains `null` for the app's explicit
unresolved-data boundary. See `NUTRITION_CATALOG_SETUP.md` for the optional background
branded-catalog pipeline.

## Native requirements

This feature cannot run in Expo Go. It requires:

- an iPhone running iOS 17 or later;
- an arm64 device build for the ExecuTorch model runtime;
- a custom development, preview, or production build containing the local Expo module;
- microphone permission; and
- speech-recognition permission.

The app config includes `NSMicrophoneUsageDescription`,
`NSSpeechRecognitionUsageDescription`, an iOS 17 deployment target, and the native
ExecuTorch dependencies. Both ImagePicker and Expo Audio receive the same microphone
purpose string so native config generation cannot remove the required iOS key; Android
recording permission remains explicitly blocked while this workflow is iOS-only.

## Build

After installing dependencies, make an iOS development build through EAS or macOS/Xcode:

```bash
npm install
eas build --platform ios --profile development
```

Install that build on an iPhone, then run Metro for the development client:

```bash
npm run start:dev-client
```

For TestFlight, use a production build and submit profile. An active Apple Developer
membership and App Store Connect configuration are required. Any build created before
these native speech changes must be rebuilt.

## Physical-device test checklist

1. Launch a fresh compatible build and verify model-file download begins without opening
   Add meal or requesting microphone/speech permission. Keep the app open for this test.
2. Open the meal and medication voice-entry screens and verify they reflect the shared startup-download progress,
   failure retry, and later cached readiness without starting a second download.
3. Press and hold the record control, speak for longer than the old browser pause limit,
   and verify the live transcript updates until the control is released.
4. Test microphone and speech permission allow/deny paths and airplane mode; confirm no
   network fallback occurs.
5. Speak multiple foods with and without punctuation or "and," including repeated amounts
   such as "nine grams rice ten grams salmon."
6. Say "today i 9 g of rice and 20 g of salmon" and verify the editable sentence becomes
   "Today I ate 9 g of rice and 20 g of salmon." Confirm the original Apple transcript
   remains visible and the parser still returns both quantities unchanged.
7. Correct a deliberately misrecognized transcript, verify applying is disabled until
   Reprocess corrected transcript finishes, and confirm the foods and nutrition refresh.
8. Use Record again, verify it returns to the recorder, then hold to create a replacement
   draft.
9. Verify food-derived naming, local time selection, gram/ounce/cup scaling, decimal macro
   edits, unmatched-food suggestions, ingredient correction, and deletion.
10. Test Continue in full form. Then test Add to session: verify the meal saves without
   closing the entry screen, the confirmation appears, and another voice meal can be
   recorded. Close the screen, reopen each saved meal, and verify the corrected transcript,
   reviewed values, and provenance.
11. While holding Record, move the finger within and outside the visible button; recording
   must continue until the finger is released. Pause naturally between foods and verify the
   live and final transcripts retain everything spoken before the pause.
12. Exercise silence, interruption, wired/Bluetooth route changes, repeated holds,
    malformed model output, low storage, and model-memory pressure. Release during the
    first permission dialog and during speech-session startup; recording must not remain
    active after either release.
13. In medication entry, test “I took 500 milligrams of metformin by mouth at 8 this
    morning,” “I forgot metformin,” and “I am supposed to take metformin tonight.” Verify
    the first two immediately fill the editable taken/missed form, the missed event has no
    invented dose, and the instruction is not treated as a completed event. Correct and
    reprocess a medication transcript, confirm the fields refresh, add it, test the possible-duplicate review, and confirm the
    screen stays open afterward.
14. Review VoiceOver focus order, Dynamic Type, compact iPhone layouts, and long localized
   strings.

Physical-device behavior, Swift compilation, transcription accuracy, and model latency
have not yet been validated in this Windows workspace.

## Model and runtime notices

- Upstream model: Liquid AI `LFM2.5-1.2B-Instruct`, licensed under the LFM Open License
  1.0. Preserve its current license and attribution requirements before distribution.
- Mobile conversion/runtime: Software Mansion React Native ExecuTorch, MIT licensed.
- Apple Speech and AVFoundation are Apple platform frameworks governed by Apple SDK and
  developer terms.

The model weights are downloaded at runtime from the model resources registered by React
Native ExecuTorch. Production review must pin and audit the resource, integrity, license
notices, retention controls, and deletion UI.
