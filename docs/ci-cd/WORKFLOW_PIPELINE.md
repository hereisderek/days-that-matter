# CI/CD Workflow & Pipeline Specification

## 1. Overview
The continuous integration and continuous delivery (CI/CD) infrastructure automates validation, testing, artifact assembly, signing, and releases across targets.

---

## 2. Secrets Management
Sensitive signing certificates and Firebase configurations are never committed directly. They are injected at CI runtime via Base64-encoded GitHub Repository Secrets:

| Secret Name | Description | Target Destination |
| :--- | :--- | :--- |
| `GOOGLE_SERVICES_JSON_BASE64` | Android Firebase configuration. To be removed: the app no longer uses Firebase (task 7.8 of the OpenSpec change `pluggable-backend-live-sharing`) | `composeApp/google-services.json` |
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
  4. Run multiplatform checks: `./gradlew allTests` (or `testDebugUnitTest`). No Firebase configuration or mock secrets are needed.
  5. Run static lint: `./gradlew lintDebug`.
  6. Build debug snapshot APK: `./gradlew :androidApp:assembleDebug`.
  7. Upload debug snapshot artifact with commit hash and run date.

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

---

## 4. Backend Pipeline (`backend.yml`, planned)

The backend in `backend/` (see [`BACKEND.md`](../architecture/BACKEND.md)) gets one workflow, added by task 5.3 of the OpenSpec change `pluggable-backend-live-sharing`:

- **Pull request** touching `core/model/**`, `backend/**` or the workflow: `:core:model` and `backend/core` tests (plus the contract drift check with a TypeScript core), store conformance, then the HTTP conformance suite against each variant (Cloudflare via `wrangler dev`, the self-host container, the Vercel handler on Node, the Firebase emulators), `wrangler deploy --dry-run`.
- **Push to `master`:** the same, then D1 migrations and deploy to the Cloudflare preview, then the smoke test.
- **Tag `backend-v*.*.*`:** production deploy to Cloudflare with environment approval. Other providers deploy manually until they are used in production.
- Secrets: GitHub repository secrets `CLOUDFLARE_API_TOKEN` (scoped to Workers, D1 and R2 edit) and `CLOUDFLARE_ACCOUNT_ID`; GitHub environments `preview` and `production` (`production` with required reviewers). OAuth client secrets, the Apple keys, the Google Play service account, the email provider key, `RATE_SALT`, `EMAIL_CODE_KEY` and `INVITE_KEY` are set per environment with `wrangler secret put`, never in CI.

### 4.1 Legacy: Share Service Checks (`share-service.yml`)
The frozen TypeScript service in `services/share/` keeps a checks-only workflow so the behavior reference stays green: on pull requests and pushes touching `services/share/**`, it runs `npm ci`, typecheck, lint, `vitest`, `npm run check:assets`, `npm audit --omit=dev --audit-level=high` and `wrangler deploy --dry-run`. Its preview and production deploy jobs and the `share-v*.*.*` tag trigger were removed on 2026-10-12: the service is never deployed. Task 5.5 of the OpenSpec change deletes the workflow together with the service.

---

## 5. OpenSpec Validation (`openspec.yml`)
- **Trigger:** pull request or push to `master` touching `openspec/**` or the workflow file; manual run.
- **Step:** `npx --yes @fission-ai/openspec@1.14.1 validate --all --strict --no-interactive`. Fails on any invalid change or spec (format, missing scenarios, requirement text over 500 characters, missing purpose).
- **Telemetry:** off (`DO_NOT_TRACK=1`, `OPENSPEC_TELEMETRY=0`).
- **Version:** pinned. When upgrading the local CLI (`brew upgrade openspec`), bump the version in the workflow in the same PR and run `openspec update` if the release notes ask for it.
