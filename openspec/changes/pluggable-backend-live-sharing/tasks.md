# Tasks

Order: groups 1 to 7 deliver the app on Cloudflare. Groups 8 to 10 add the other providers. Each group lands its own tests and doc updates. Paths and names refer to [`docs/architecture/BACKEND.md`](../../../docs/architecture/BACKEND.md).

## 1. Feasibility spike (go/no-go gate)

- [ ] 1.1 Build a Kotlin/JS (IR, ES modules) handler using kotlinx-serialization and kotlinx-datetime with time zone data, deploy it to a Workers Free preview, and record gzip bundle size, cold start and warm CPU time in BACKEND.md section 13. Go if bundle ≤ 1 MB gzip, cold start ≤ 150 ms wall time, warm request ≤ 3 ms CPU.
- [ ] 1.2 Run the same handler on Node 24 with `node:sqlite` and record start time and memory in BACKEND.md section 13; verify a query round trip in a script.
- [ ] 1.3 Record the decision (go, or fallback to Kotlin/Wasm or a TypeScript core) in design.md D1; on fallback, update design.md and this file before starting group 2.

## 2. Shared model `:core:model`

- [ ] 2.1 Create the Gradle module with targets android, iosArm64, iosSimulatorArm64, jvm and js, depending only on kotlinx-serialization and kotlinx-datetime; verify `./gradlew :core:model:allTests` runs on every target.
- [ ] 2.2 Add `EventDoc`, the shared and owner-only field sets, roles and the API DTOs from BACKEND.md section 7; verify JSON round-trip tests and that unknown fields are ignored on read.
- [ ] 2.3 Port validation from `services/share/src/lib/validate.ts` and extend it to notes and backdrop; verify with the hostile input table from the old tests (control characters, bidi overrides, bad zones, bad colours, lengths at and past each limit).
- [ ] 2.4 Implement patch apply, inverse patch and overwritten-field detection (design D5); verify with tests for different fields, same field, nested object replacement and null clearing.
- [ ] 2.5 Implement the role projections (owner, editor, viewer, public link); verify that no projection other than the owner's contains notes, pin state, category or account identifiers.
- [ ] 2.6 Implement the countdown engine per `docs/features/events/SPEC.md` and a JVM task that writes `server/web/test/countdown-vectors.json`; verify `countdown.js` passes every generated vector and CI fails when the committed file differs from a fresh generation.
- [ ] 2.7 Update `docs/features/events/SPEC.md` with any model change made while implementing; verify the doc's `Event` model matches `EventDoc`.

## 3. Server core `:server:core`

- [ ] 3.1 Add common HTTP types, router, error envelope, security headers, request id and JSON log lines; verify a test that logs contain no titles, tokens, cookies, `Authorization` values, IPs or install secrets.
- [ ] 3.2 Define the ports (`Store`, `SqlDriver`, `BlobStore`, `LiveHub`, `Clock`, `Random`, `Config`) and in-memory fakes; verify the core test suite runs on JVM against the fakes.
- [ ] 3.3 Implement `SqlStore` and migration `server/migrations/0001_init.sql`; verify the store conformance suite (3.4) passes on JVM with sqlite-jdbc.
- [ ] 3.4 Write the store conformance suite in common test code, runnable against any `Store`; verify it passes for `SqlStore` and fails when a deliberately broken store is plugged in.
- [ ] 3.5 Implement accounts: anonymous accounts, Google and Apple ID token verification with JWKS caching, sessions (bearer and cookie), the web code flow with PKCE, sign-out, `GET/PATCH/DELETE /me`, upgrade and merge; verify with tests that sign tokens with test keys, including wrong `aud`, expired and wrong `iss`.
- [ ] 3.6 Implement the events API (manifest, batch fetch, create, patch, delete) with role checks; verify the event-sync scenarios as core tests.
- [ ] 3.7 Implement history (list, restore, pruning past 200 revisions); verify the event-history scenarios as core tests.
- [ ] 3.8 Implement sharing (links, people link, invites, accept, roles, leave) and `access` notices on every access change; verify the event-sharing scenarios as core tests.
- [ ] 3.9 Implement link resolution with ETag and `304`, including identical not-found responses; verify with a byte-comparison test for unknown, malformed and purged tokens.
- [ ] 3.10 Implement media upload: type sniffing, dimension and duration parsing, EXIF and XMP removal for JPEG and WebP, MP4 audio and location checks, limits, quota and garbage collection; verify with fixture files including a JPEG with GPS data and an MP4 with an audio track.
- [ ] 3.11 Implement rate limits, quotas, maintenance mode and the purge job; verify each limit in BACKEND.md section 11 at and past its value.
- [ ] 3.12 Port page rendering from `services/share/src/page/` and add the `401`, `403` and invite pages; verify the state, header and XSS corpus tests ported from `services/share/test/page/`.
- [ ] 3.13 Update BACKEND.md where the implementation differs from it; verify by review in the PR.

## 4. HTTP conformance suite

- [ ] 4.1 Create `server/conformance/` (Node `node:test`, no other dependencies) parameterised by `BASE_URL`, porting the flows from `services/share/test/api/` to the new API; verify it runs against a stub server.
- [ ] 4.2 Add tests for every spec scenario that is observable over HTTP, and switch live tests on the mode from `GET /api/v1/health`; verify the suite lists each scenario name it covers.

## 5. Cloudflare adapter `:server:cloudflare`

- [ ] 5.1 Implement the D1 `SqlDriver`, the R2 `BlobStore`, the `EventRoom` Durable Object with the Hibernation API, the cron purge and the Worker entry; verify `wrangler deploy --dry-run` succeeds for preview and production.
- [ ] 5.2 Write `wrangler.jsonc` (Static Assets from `server/web/`, `run_worker_first` for `/e/*`, `/i/*`, `/auth/*`, `/api/*`, D1, R2, Durable Object with a SQLite class migration, cron, environments); verify the conformance suite passes against `wrangler dev`.
- [ ] 5.3 Add the backend CI workflow (model and core tests, conformance against `wrangler dev`, preview deploy and smoke test on `master`, production on tag `backend-v*.*.*` with approval); verify a PR run is green.
- [ ] 5.4 Re-check the free tier numbers in BACKEND.md section 12 against current Cloudflare docs; verify each number has a check date.
- [ ] 5.5 Delete `services/share/` and `.github/workflows/share-service.yml`, and update links to them; verify `grep -r services/share docs AGENTS.md` finds only historical notes.

## 6. Share web `server/web/`

- [ ] 6.1 Move static assets from `services/share/public/` and update the CSP for media, WebSocket and sign-in; verify the header test suite.
- [ ] 6.2 Write `live.js` (WebSocket or polling, pause when hidden, catch up when visible); verify with Node tests using fake timers and a fake socket.
- [ ] 6.3 Add sign-in buttons, sign-out and the invite accept page; verify the flow end to end against `wrangler dev` with a test identity provider stub.
- [ ] 6.4 Write `editor.js` (lazy-loaded form for shared fields, server field errors, history list, restore); verify with Node DOM tests and a manual run in Safari, Chrome and Firefox.
- [ ] 6.5 Add backdrop display (still, video, GIF, poster, dim, reduced motion, save-data) and still compression in the editor (canvas to WebP or JPEG); verify with a manual run per browser and a reduced-motion check.
- [ ] 6.6 Run Lighthouse on the active, editor and sign-in pages; verify an accessibility score of 95 or more, recorded in the PR.

## 7. App (Android and iOS)

- [ ] 7.1 Add the Ktor client for the API in `core/network` using `:core:model` DTOs and map errors to typed results; verify with tests against a mock engine.
- [ ] 7.2 Add sign-in: Credential Manager (Android), AuthenticationServices (iOS), Apple through a custom tab on Android, anonymous accounts, secure storage of the session and install secret; verify manual sign-in on both platforms against preview.
- [ ] 7.3 Change the Room schema and write the sync engine (manifest, batch fetch, pending patches, overwritten notice); verify DAO and sync tests with an in-memory database and a fake API.
- [ ] 7.4 Add live updates for open shared events (WebSocket or polling); verify a test with a fake transport and a manual two-device check.
- [ ] 7.5 Build the share screen (public links, people link, invites, people list, guest warning) and deep links for `/e/` and `/i/`; verify ViewModel tests and the deep link on real devices after production launch.
- [ ] 7.6 Build the history screen and restore; verify ViewModel tests.
- [ ] 7.7 Add the backdrop picker and compression (still, video, Live Photo, GIF pass-through, poster); verify that test files of 6 MB, 30 seconds and a Live Photo end up within the limits.
- [ ] 7.8 Remove the Firebase SDK and configuration from the app and CI; verify a clean build and that CI no longer needs `GOOGLE_SERVICES_JSON_BASE64`.
- [ ] 7.9 Update `docs/features/*` for anything the app work changed; verify by review in the PR.

## 8. Self-host adapter `:server:selfhost`

- [ ] 8.1 Implement the Node entry (HTTP server, static files, `/m/` media route), the `node:sqlite` driver with WAL, the filesystem `BlobStore`, the in-process WebSocket hub and the purge timer; verify the store conformance suite on JS.
- [ ] 8.2 Add `Dockerfile` and `compose.yaml` (one container, one volume for the database and media); verify the HTTP conformance suite passes against the running container.
- [ ] 8.3 Write operator docs (configuration, TLS through a reverse proxy, backup by copying the volume, upgrade); verify by following them on a clean machine.

## 9. Vercel adapter `:server:vercel`

- [ ] 9.1 Implement the Web handler entry, the libSQL driver over HTTP, the Vercel Blob `BlobStore`, `poll` mode, rewrites and the cron route protected by `CRON_SECRET`; verify the HTTP conformance suite locally with a libSQL file database.
- [ ] 9.2 Deploy a preview with Turso and Vercel Blob; verify the smoke test and the 4 MB upload against it.

## 10. Firebase adapter `:server:firebase`

- [ ] 10.1 Implement the Cloud Functions entry, `FirestoreStore`, the Cloud Storage `BlobStore`, the scheduled purge, Hosting rewrites and deny-all Firestore and Storage client rules; verify the store conformance suite against the Firestore emulator.
- [ ] 10.2 Run the HTTP conformance suite against the Firebase emulators in CI; verify the job is green.

## 11. Launch

- [ ] 11.1 Complete the owner inputs in BACKEND.md section 15 (domain, app ids, OAuth clients, Apple key, abuse contact); verify `npm run check:assets:strict` (moved to `server/web/`) passes.
- [ ] 11.2 Turn on the Cloudflare CSAM Scanning Tool for the media domain and update the privacy policy for accounts, photos and history; verify both are live before the first production deploy.
- [ ] 11.3 Verify App Links and Universal Links for `/e/` and `/i/` on a real Android and iOS device, and link previews in WhatsApp and iMessage.

## Workflow follow-up

- Archive the change with `openspec archive pluggable-backend-live-sharing` after review, so its specs move to `openspec/specs/`.
- Remove the superseded notes from the share service docs once they are deleted.
