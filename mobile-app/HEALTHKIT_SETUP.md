# Apple HealthKit Setup

GlucoFinity implements read-only Apple Health access for blood glucose and daily
fitness context on iOS through `@kingstinct/react-native-healthkit`. The integration
is optional, user initiated, and available only in a custom iOS build. Standard Expo
Go does not include the HealthKit native module or the app-specific entitlement.

## Implemented behavior

- Checks that HealthKit is available before presenting an active connection flow.
- Requests read access only for `HKQuantityTypeIdentifierBloodGlucose`,
  `HKQuantityTypeIdentifierStepCount`,
  `HKQuantityTypeIdentifierActiveEnergyBurned`, and `HKWorkoutTypeIdentifier`.
- Does not request write access or background delivery.
- Queries blood glucose only for the selected on-screen time range and requests values
  in `mg/dL`.
- Queries today's local-calendar step and active-energy totals with HealthKit cumulative
  statistics so overlapping iPhone and Apple Watch samples are not naively summed.
- Queries today's workouts, validates and deduplicates native UUIDs, preserves source
  provenance, and maps HealthKit activity types to readable labels.
- Maps samples into the shared `GlucoseReading` model with `source: 'healthkit'`.
- Uses the shared provider-independent normalization boundary to convert units, canonicalize
  timestamps, preserve the source record ID and source app metadata, sort, validate, and
  deduplicate samples before they reach screens or meal-response analysis.
- Maps fitness results into the shared `DailyFitnessSummary` and `ExerciseEntry` models.
  Missing or unshared values remain unavailable rather than being represented as zero.
- Displays fitness as observed context that may be associated with glucose patterns; it
  does not claim fitness caused a glucose change.
- Does not copy Apple Health samples into AsyncStorage, upload them, or derive treatment
  recommendations from them.
- Falls back safely in Expo Go and on non-iOS platforms.

Apple intentionally does not reveal whether a user granted or denied read access to a
specific HealthKit type. GlucoFinity therefore describes Apple Health as "selected"
rather than claiming that read permission is granted. If access is denied or no source
has written the requested samples, the app shows an unavailable or empty state. The same
privacy behavior applies to fitness records.

## Native configuration

`app.json` configures:

- iOS bundle identifier `com.glucofinity.app`.
- The HealthKit entitlement through the library's Expo config plugin.
- Scope-specific `NSHealthShareUsageDescription` and
  `NSHealthUpdateUsageDescription` strings. Apple validates both keys when the linked
  HealthKit SDK or entitlement can reference sensitive APIs, even though GlucoFinity
  requests read access only. Both strings name blood glucose, step count, active energy,
  and workout records and state that the app does not add or change Apple Health data.
- Background HealthKit delivery disabled.

Register the bundle identifier in the Apple Developer account and ensure the App ID has
the HealthKit capability enabled before signing a build.

## Build and test on iPhone

An iOS native build requires macOS, Xcode, an Apple Developer signing identity, and a
physical iPhone for meaningful HealthKit validation.

```bash
npm install
npx expo prebuild --clean --platform ios
npm run ios:native
```

After installing the custom build:

1. Open **Settings** in GlucoFinity.
2. Choose **Connect Apple Health**.
3. Decide whether to share blood-glucose, step-count, active-energy, and workout records
   in Apple's authorization sheet.
4. Confirm permitted blood-glucose samples appear on Dashboard and Trends.
5. Confirm the Dashboard fitness section shows today's permitted totals and workouts,
   leaves unshared values unavailable, and refreshes when the screen is pulled down.
6. Test no-record, partial-access, denied-access, revoked-access, locked-device, and
   unavailable states.
7. Change access from the Health app's Apps and Services controls and re-test.

Use synthetic test samples only. Do not use personal health data in screenshots,
fixtures, automated tests, or demonstrations.

## Release requirements

- Complete Apple privacy-manifest, App Store privacy-label, and HealthKit capability
  reviews for the final product scope.
- Document data minimization, retention, deletion, encryption, access control, backup,
  and incident-response policies before adding authentication or a backend.
- Validate the integration on supported physical iPhone and iPad devices.
- Keep all medical language observational and preserve the visible prototype disclaimer.

HealthKit is not a direct real-time Dexcom, CGM-manufacturer, Apple Watch, or fitness-app
integration. Available records depend on other apps or devices writing the requested
samples to Apple Health.
