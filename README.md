# TeriProjekt

Flutter project bootstrap prepared on Linux for Android, Web and later iOS builds in Codemagic.

## Current state

- Flutter project created in this directory
- Platforms enabled: `android`, `ios`, `web`
- iOS bundle identifier: `com.teriprojekt.teriprojekt`
- Basic Codemagic configuration added in `codemagic.yaml`

## Local development

```bash
flutter pub get
flutter analyze
flutter test
flutter run -d chrome
flutter run -d android
```

## Codemagic

The repository contains two workflows:

- `validate`: Linux workflow for `pub get`, `analyze`, `test`
- `ios_testflight`: macOS workflow for signed iOS IPA build

Before the iOS workflow can work, you still need to connect Apple credentials in Codemagic:

1. Create or use an Apple Developer account membership.
2. Create an App Store Connect API key.
3. Add that key in Codemagic under Developer Portal integrations with the name `codemagic`, or rename the value in `codemagic.yaml`.
4. Set up code signing assets for bundle id `com.teriprojekt.teriprojekt`.

## Next step

Define what the app should do and then replace the default Flutter counter template with the real MVP.
