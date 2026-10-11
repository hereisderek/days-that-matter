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

---

## 4. Backend Pipeline (`backend.yml`, planned)

The backend in `backend/` (see [`BACKEND.md`](../architecture/BACKEND.md)) gets one workflow, added by task 5.3 of the OpenSpec change `pluggable-backend-live-sharing`:

- **Pull request** touching `core/model/**`, `backend/**` or the workflow: `:core:model` and `backend/core` tests (plus the contract drift check with a TypeScript core), store conformance, then the HTTP conformance suite against each variant (Cloudflare via `wrangler dev`, the self-host container, the Vercel handler on Node, the Firebase emulators), `wrangler deploy --dry-run`.
- **Push to `master`:** the same, then D1 migrations and deploy to the Cloudflare preview, then the smoke test.
- **Tag `backend-v*.*.*`:** production deploy to Cloudflare with environment approval. Other providers deploy manually until they are used in production.
- Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` as below. OAuth client secrets, the Apple keys, the Google Play service account, the email provider key, `RATE_SALT`, `EMAIL_CODE_KEY` and `INVITE_KEY` are set per environment with `wrangler secret put`, never in CI.

Until task 5.5 removes it, the old share service workflow below stays in place.

### 4.0 Legacy: Share Service Pipeline (`share-service.yml`)
The share service in `services/share/` (Cloudflare Worker + D1, see [`docs/architecture/SHARE_SERVICE.md`](../architecture/SHARE_SERVICE.md)) has its own workflow. It is independent from the app pipelines and only runs for changes under `services/share/**` and the workflow file.

| Secret Name | Description |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | Token scoped to Workers and D1 edit |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id |

Required GitHub repository secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Never commit their values. The Worker secrets `RATE_SALT` and `ADMIN_KEY` are not CI secrets: they are set once per environment with `wrangler secret put`.

| Repository variable | Description |
| :--- | :--- |
| `SHARE_PREVIEW_URL` | Preview `workers.dev` URL used by the smoke test |
| `SHARE_PRODUCTION_URL` | Optional, defaults to `https://daysthatmatter.app` |

GitHub environments `preview` and `production` must exist. `production` needs required reviewers (the approval gate). One-time setup steps are in [`services/share/README.md`](../../services/share/README.md).

### 4.1 Pull Request Verification
- **Trigger:** pull request touching `services/share/**`.
- **Steps:** `npm ci`, typecheck, lint, `vitest` (Workers pool with local D1), `npm run check:assets` (placeholder check, design token drift check, JSON validity of the association files), `npm audit --omit=dev --audit-level=high` (production dependencies; the dev toolchain does not ship in the Worker), `wrangler deploy --dry-run` for both environments. The same checks also run on push to `master` and on tags.

### 4.2 Preview Deploy
- **Trigger:** push to `master` touching `services/share/**`.
- **Steps:** refuse the placeholder D1 database id, apply D1 migrations to the preview database, then `wrangler deploy --env preview`, then the smoke test (`npm run smoke`: health, create/read/revoke, well-known files with `redirect: manual`).

### 4.3 Production Deploy
- **Trigger:** tag `share-v*.*.*`, with a required environment approval.
- **Steps:** same checks, the placeholder check in strict mode (fails while association files contain placeholders), apply D1 migrations to production, `wrangler deploy --env production`, smoke test.
- **Order rule:** migrations always run before the Worker deploy and must be backward compatible with the previous Worker version.
- **Rollback:** `wrangler rollback` for the Worker. D1 changes roll forward only.
