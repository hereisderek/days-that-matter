# CI/CD Workflow & Pipeline Specification

## 1. Overview
The continuous integration and continuous delivery (CI/CD) infrastructure automates validation, testing, artifact assembly, signing, and releases across targets.

---

## 2. Secrets Management
Sensitive signing certificates and Firebase configurations are never committed directly. They are injected at CI runtime via Base64-encoded GitHub Repository Secrets:

| Secret Name | Description | Target Destination |
| :--- | :--- | :--- |
| `GOOGLE_SERVICES_JSON_BASE64` | Android Firebase configuration | `composeApp/google-services.json` |
| `PROD_KEYSTORE_BASE64` | Android production signing keystore | `docs/keystore/prod.keystore` |
| `KEYSTORE_PASSWORD` | Password for `prod.keystore` | Environment Variable |
| `KEY_ALIAS` | Key alias in `prod.keystore` | Environment Variable |
| `KEY_PASSWORD` | Private key password | Environment Variable |
| `PLAY_STORE_JSON_KEY_BASE64` | Google Play Developer Service Account JSON | Deployment step |

---

## 3. Pipeline Architectures

### 3.1 Pull Request Verification (`pr-check.yml`)
- **Trigger:** Pull request opened or synchronized targeting `master` or `main`.
- **Steps:**
  1. Checkout repository code.
  2. Setup JDK 21 (Temurin) and Android SDK.
  3. Setup Gradle with build cache support.
  4. Inject mock secrets (`google-services.json.mock` &rarr; `google-services.json`).
  5. Run multiplatform checks: `./gradlew allTests` (or `testDebugUnitTest`).
  6. Run static lint: `./gradlew lintDebug`.
  7. Build debug snapshot APK: `./gradlew :composeApp:assembleDebug`.
  8. Upload debug snapshot artifact with commit hash and run date.

### 3.2 Production Release Pipeline (`release.yml`)
- **Trigger:** Push to `release` branch or tag `v*.*.*`.
- **Steps:**
  1. Full pre-flight test verification.
  2. Decode production signing keystore and production Firebase credentials.
  3. Inject dynamic `versionCode` derived from GitHub Run Number.
  4. Build signed Android App Bundle (`./gradlew :composeApp:bundleRelease`).
  5. Create GitHub Release with release notes, attaching `.aab`, `.apk`, and R8 mapping file.
  6. Deploy `.aab` to Google Play Store internal test track.

### 3.3 Self-Hosted Runner Compatibility
- Automatic check and installation for `unzip` on Linux environments.
- Remote caching automatically toggled off for self-hosted instances to avoid network throttling and take advantage of persistent local disks.
