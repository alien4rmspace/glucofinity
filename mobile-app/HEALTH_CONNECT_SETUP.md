# Android Health Connect Setup

GlucoFinity has a read-only Android adapter for blood glucose records available through
Health Connect. The integration is optional, requires explicit user permission, and is
not a direct connection to a CGM manufacturer. It does not write health records, run a
background sync, recommend treatment changes, or upload records to a backend.

The code and native configuration are implemented, but the integration still requires
validation on physical Android devices before it should be described as production-ready.

## Requirements

- Android 8.0 (API 26) or newer.
- On Android 14 and newer, Health Connect is part of Android. On Android 13 and lower,
  install or update the Health Connect provider from Google Play.
- A GlucoFinity Android development or production build. Standard Expo Go cannot load
  the `react-native-health-connect` native module.
- Another authorized app or device must have written blood glucose records into Health
  Connect; Health Connect does not create CGM data by itself.

## Build and connect

From the `GlucoFinity/` directory:

```bash
npm install
npx expo prebuild --clean
npm run android:native
```

The clean prebuild regenerates the native Android project from `app.json`. Rebuild after
changing native dependencies or native app configuration.

On the installed Android app:

1. Open **Settings**.
2. Select **Connect Health Connect**.
3. Grant only the requested blood glucose read permission.
4. Return to the Dashboard and refresh if needed.

Permission can be denied or revoked at any time. GlucoFinity reports the denied or
unavailable state and does not silently replace it with personal-looking data. Fictional
demo data remains a separate, labeled source.

## Implemented configuration

- Android application id: `com.glucofinity.app`
- Manifest permission: `android.permission.health.READ_BLOOD_GLUCOSE`
- Config plugin: `react-native-health-connect`
- Minimum Android SDK: 26 through `expo-build-properties`
- Repository: `repositories/health-connect-glucose-repository.ts`
- Permission and native bridge: `services/health-connect-service.ts`
- Deterministic mapping and display-only adjacent-value trends:
  `utils/health-connect.ts`
- Shared provider-independent unit, timestamp, provenance, validation, sorting, and duplicate
  handling: `utils/glucose-normalization.ts`

Queries are limited to the time range requested by the visible screen (currently up to
24 hours). Imported records stay in app memory for display and are not persisted to
AsyncStorage. Meal entries and preferences remain locally persisted separately.

## Physical-device validation checklist

- Android 13 with the Health Connect provider installed.
- Android 14 or newer with the system Health Connect service.
- Permission granted, denied, and later revoked in system settings.
- No blood glucose records, one record, irregular samples, duplicate records, and more
  than one results page.
- Source switching between fictional demo data and Health Connect.
- App relaunch, pull-to-refresh, screen reader labels, small screens, and no horizontal
  overflow.
- Confirm no glucose values or permission details are written to logs, screenshots,
  fixtures, analytics, or network traffic.

Use synthetic test records only for development evidence. Do not put real personal
health information in screenshots, fixtures, issue reports, or automated tests.

## Google Play release work

Before publishing, declare the exact Health Connect data access in Play Console and make
the in-app privacy rationale and public privacy policy match the implemented behavior.
Complete privacy, security, clinical-safety, accessibility, and regulatory reviews. Play
approval and device testing are release work; the presence of this adapter does not imply
approval, validation, endorsement, or medical-device status.
