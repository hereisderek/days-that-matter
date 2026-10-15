# Tasks

Order: groups 1 to 7 deliver the app on Cloudflare (global region). Groups 8 to 10 add the other provider variants. Each group lands its own tests and doc updates. Paths and names refer to [`docs/architecture/BACKEND.md`](../../../docs/architecture/BACKEND.md). China is a separate change ([`CHINA.md`](../../../docs/architecture/CHINA.md)).

## 1. Language decision (design D1)

- [x] 1.1 Record the owner's decision (TypeScript for `backend/core`, Kotlin/JS kept open with revisit triggers) in design.md D1 and BACKEND.md section 13; verify that task 2.8 and group 3 name TypeScript.

## 2. Shared model `:core:model`

- [x] 2.1 Create the Gradle module with targets android, iosArm64, iosSimulatorArm64, jvm and js, depending only on kotlinx-serialization and kotlinx-datetime; verify `./gradlew :core:model:allTests` runs on every target.
- [x] 2.2 Add `EventDoc`, `Memo`, the shared and owner-only field sets, roles, backdrop and audio types, invite and link settings, and the API types from BACKEND.md section 7; verify JSON round-trip tests and that unknown fields are ignored on read.
  - Note: bodies BACKEND.md section 7 does not show yet (sign-in response, `GET /me`, the `POST /events/fetch` and revisions page wrappers, the memo PATCH wrapper) get their types with group 3.
- [x] 2.3 Port validation from `services/share/src/lib/validate.ts` and extend it to notes, memos, backdrop, audio, Spotify URLs, link expiry and invite use counts; verify with the hostile input table from the old tests and limits at and past each value.
  - Note: titles are trimmed but not NFC-normalized: common Kotlin has no Unicode normalization and the domain may not use platform APIs, so the app platform layer or the backend core adds it (KDoc on `TextRules`). Link labels and memo milestone tags use the title rule (1 to 100 characters).
- [x] 2.4 Implement patch apply, inverse patch and overwritten-field detection (design D5); verify tests for different fields, same field, nested object replacement and null clearing.
- [x] 2.5 Implement the role projections (owner, editor, viewer, public link); verify that no projection other than the owner's contains notes, pin state, category, memos or account identifiers, and that public links omit custom audio.
- [x] 2.6 Implement the plan table (`Plan`, `Feature`, limits for free, premium and premium_plus) and the gate check for a change given the writer's plan and the writer's counts; verify tests for each row of `docs/features/premium/SPEC.md`, including lapsed plans and counts above the limit keeping existing content.
- [x] 2.7 Implement the countdown engine per `docs/features/events/SPEC.md` and a JVM task that writes `backend/core/web/test/countdown-vectors.json`; verify `countdown.js` passes every generated vector and CI fails when the committed file differs from a fresh generation.
  - Note: engine tests pass on JVM, JS and Android host with 100% line and branch coverage (`koverVerify`), and the vector file is deterministic; the `countdown.js` check is pending until the backend core exists. `:core:model:checkCountdownVectors` is ready for the CI step.
  - Note (wave 1 backend): `backend/core/web/countdown.js` passes all 59 vectors (units and workdays included, 9 with a sub-second `nowInstant` from `SubSecondCountdownVectors` in jvmTest); `pr-check.yml` runs `checkCountdownVectors`, verified locally to fail on a changed file.
- [x] 2.8 Generate `backend/core/contract/` from `:core:model` (JSON Schema of the API types, plan table JSON, validation and merge vectors); verify a CI step regenerates it and fails on any difference.
  - Note: `./gradlew :core:model:generateContract` writes `api.schema.json`, `errors.json`, `plans.json`, `limits.json`, `validation-vectors.json` and `merge-vectors.json`; `checkContract` runs in `pr-check.yml` (verified locally: two generations give no diff, a changed or extra file fails). `src/contract/api.ts` is generated from the schema and a test fails when stale. Merge vectors are consumed by `src/rules/merge.ts`; validation vectors wait for the TypeScript validation (task 3.6).
- [x] 2.9 Update `docs/features/events/SPEC.md` and `docs/features/premium/SPEC.md` with any change made while implementing; verify they match the code.
  - Note: events SPEC gained the calculation rules (section 2.5) and the shared types; the premium SPEC already matched the plan table, so it is unchanged.

## 3. Backend core `backend/core/`

- [x] 3.1 Add HTTP types, router, error envelope, security headers, request id and JSON log lines; verify a test that logs contain no titles, memo text, emails, codes, tokens, cookies, `Authorization` values, IPs or Spotify URLs.
- [x] 3.2 Define the ports (`Store`, `SqlDriver`, `BlobStore`, `LiveHub`, `Mailer`, `Clock`, `Random`, `Config`) and in-memory fakes; verify the core test suite runs against the fakes.
  - Note: `Store` holds the foundation operations (accounts, events, patches with revisions, tombstones, history pages); later tasks add theirs.
- [x] 3.3 Implement `SqlStore` and migration `backend/core/migrations/0001_init.sql`; verify the store conformance suite (3.4) passes on local SQLite.
  - Note: `0001_init.sql` holds accounts, events, revisions, memos, links, members, media, grants, exports and devices; identities, email_codes, sessions (3.5), invites (3.8), purchases (3.11) and rate_counters (3.13) come with their tasks.
- [x] 3.4 Write the store conformance suite, runnable against any `Store`; verify it passes for `SqlStore` and fails with a deliberately broken store.
- [ ] 3.5 Implement accounts: identity provider plug-ins for Google, Apple and email codes (with the HTTP `Mailer`), identity linking by verified email, bearer sessions, `POST /auth/apple/callback` handing Sign in with Apple results to the Android app (no cookie, design D17), sign-out, `GET/PATCH/DELETE /me`, and `GET /config`; verify the accounts scenarios as core tests, including wrong `aud`, expired token, wrong `iss`, code expiry and the 5-attempt limit.
- [ ] 3.6 Implement sync: manifest with `childSeq`, batch fetch, create (with the owned-event limit), patch, delete, memo children with tombstones and `reset`; verify the event-sync scenarios as core tests.
- [ ] 3.7 Implement history (list, restore, pruning past 200 revisions); verify the event-history scenarios as core tests.
- [ ] 3.8 Implement sharing: public links with expiry, invite links with role, use count and expiry, join, members, role changes, removal with rejoin block, leave, and `access` notices; verify the event-sharing scenarios as core tests.
- [ ] 3.9 Implement link resolution with ETag and `304`, and identical not-found responses; verify with a byte-comparison test for unknown, malformed and purged tokens.
- [ ] 3.10 Implement media upload for backdrops (`POST /events/{id}/media`) and custom audio (`POST /me/library`): type sniffing, dimension and duration parsing, EXIF and XMP removal for JPEG and WebP, MP4 codec, audio track and location checks, M4A checks, size limits, upload rate, plan gates and counts by uploader, the `accounts.media_bytes` and `media_files` counters, and garbage collection (audio only when out of the library and unused); verify with fixture files including a JPEG with GPS data, an HEVC MP4, an MP4 with sound and an MP3 renamed to `.m4a`, and a test that the counters match a full count after uploads and deletions.
- [ ] 3.11 Implement purchases: Apple signed transaction verification (certificate chain to Apple Root CA G3, bundle id, expiry), App Store Server Notifications V2, App Store Server API status check, Google Play `purchases.subscriptionsv2.get` with a service account and acknowledgement, the daily and on-demand re-check, and plan derivation; verify with recorded sandbox payloads and a fake Google API.
- [ ] 3.12 Implement audio: `GET /audio/catalog` from `audio/catalog.json`, `GET /audio/{id}` for built-in and custom files with their access rules, the custom audio library (`GET /me/library`, `DELETE /me/library/{mediaId}`, uses per file, counting in the library or in use), the audio upload block flag, Spotify link validation and the free 3-event limit by setter; verify the event-audio scenarios as core tests.
- [ ] 3.13 Implement rate limits, maintenance mode and the purge job; verify each limit in BACKEND.md section 11 at and past its value.
- [ ] 3.14 Port page rendering from `services/share/src/page/` for the public link page, and add the generic invite and member landing pages (design D17); verify the state, header and XSS corpus tests ported from `services/share/test/page/`, and that landing page responses for valid, used-up, revoked and unknown tokens are byte-identical apart from the request id.
- [ ] 3.15 Update BACKEND.md where the implementation differs from it; verify by review in the PR.
- [ ] 3.16 Implement promotional grants (`grants` table, plan = highest of active purchases and active grants, end of a grant like a lapsed plan); verify core tests for a grant starting, ending with content above the free limits kept, and overlapping a store purchase, plus a conformance suite run on the variants touched.
- [ ] 3.17 Implement data export: `POST /me/export` (1 per day), the `exports` table, `/export/{token}` with `data.json` streamed from the store and one link per uploaded file, expiry, and the email; verify core tests for contents (no other account's notes, memos or identifiers), the daily limit, expiry and a hashed token, plus a conformance suite run on the variants touched.
- [ ] 3.18 Implement inactive accounts: `last_active_at` (at most one write per day), the daily job steps and both emails from BACKEND.md section 17, exemption for subscribers and grant holders, the `INACTIVE_JOB` pause flag, and deletion through the account deletion path; verify core tests with a fake clock covering notice 1, notice 2, deletion, a sign-in between notices and an exempt account.
- [ ] 3.19 Implement the operator storage report (`GET /admin/storage` with `ADMIN_TOKEN`, orders, paging, rate limit) and the `/admin/storage` page; verify core tests for each order, `401` without or with a wrong token, the rate limit, and a conformance suite run on the variants touched.

## 4. HTTP conformance suite `backend/core/conformance/`

- [ ] 4.1 Create the suite (Node `node:test`, no other dependencies) parameterised by `BASE_URL`, porting the flows from `services/share/test/api/` to the new API; verify it runs against a stub server.
- [ ] 4.2 Add tests for every spec scenario that is observable over HTTP, reading the live mode and enabled features from `GET /api/v1/config`; verify the suite lists each scenario name it covers.

## 5. Cloudflare variant `backend/cloudflare/`

- [ ] 5.1 Implement the D1 `SqlDriver`, the R2 `BlobStore`, the `EventRoom` Durable Object with the Hibernation API, the cron job and the Worker entry; verify `wrangler deploy --dry-run` succeeds for preview and production.
- [ ] 5.2 Write `wrangler.jsonc` (Static Assets from `backend/core/web/`, `run_worker_first` for `/e/*`, `/i/*`, `/s/*`, `/auth/*`, `/export/*`, `/admin/*`, `/api/*`, D1, R2, Durable Object with a SQLite class migration, cron, environments); verify the conformance suite passes against `wrangler dev`.
- [ ] 5.3 Add the backend CI workflow (model and core tests, conformance against `wrangler dev`, preview deploy and smoke test on `master`, production on tag `backend-v*.*.*` with approval); verify a PR run is green.
- [ ] 5.4 Re-check the free tier numbers in BACKEND.md section 12 against current Cloudflare docs; verify each number has a check date.
- [ ] 5.5 Delete `services/share/` and `.github/workflows/share-service.yml`, and update links to them; verify `grep -r services/share docs AGENTS.md` finds only historical notes.

## 6. Share web `backend/core/web/`

- [ ] 6.1 Move static assets from `services/share/public/` and update the CSP for media, audio and WebSocket, with no sign-in and no forms (design D17); verify the header test suite and that no page sets a cookie.
- [ ] 6.2 Write `live.js` (WebSocket or polling, pause when hidden, catch up when visible); verify with Node tests using fake timers and a fake socket.
- [ ] 6.3 Add the generic invite and member landing pages ("You're invited to a day in Days That Matter. Open it in the app to join.", "Open in the app", store links of the region, generic preview tags); verify against `wrangler dev` that they show no event details for valid and unknown tokens, and that the open-in-app link opens the app on a real Android and iOS device.
- [ ] 6.4 Removed by design D17: no `editor.js`, no editing or history on the web; verify that `backend/core/web/` contains no `editor.js`.
- [ ] 6.5 Add backdrop display (still, animated play-once then key photo, dim, blur scaled with the card width, reduced motion) and audio (play button for built-in tracks, no custom audio on any page, "Listen on Spotify" link); verify with a manual run per browser, a reduced-motion check and a blur 8 backdrop compared with the app at two card widths.
- [ ] 6.6 Run Lighthouse on the public link page and the invite and member landing pages; verify an accessibility score of 95 or more, recorded in the PR.

## 7. App (Android and iOS)

- [ ] 7.1 Add the Ktor client for the API in `core/network` using `:core:model` types, the region setting (chosen once per install) and `GET /config`; verify with tests against a mock engine.
- [ ] 7.2 Add sign-in: Google (Credential Manager, Google Sign-In on iOS), Apple (AuthenticationServices, custom tab on Android), email code screens, terms and privacy links with consent on sign-up and re-consent on terms changes, add-a-method in settings, secure session storage, and the sign-in prompt on Sync, Share, Invite and the first saved event, and Settings › Account › "Download my data"; verify ViewModel tests and a manual sign-in with each method on both platforms against preview.
- [ ] 7.3 Change the Room schema and write the sync engine (manifest, batch fetch, pending patches, memo children, first sign-in upload, overwritten notice) and the Sync button with its message; verify DAO and sync tests with an in-memory database and a fake API.
  - Note (wave 1 events): Room schema part done: `events` and `memos` tables (schema 2) with `server_rev`, `child_seq`, `pending_patch`, `is_deleted`, `EventDao.getPending`/`MemoDao.getPending`, and local edits that add changed fields to `pending_patch` for synced rows; DAO tests with an in-memory database. The sync engine, the Sync button and the sync tests are not started.
  - Note (wave 2 editor): the event editor writes through the same local path: a new day is stored with role owner and no `server_rev` (sent whole later), an edit applies only the changed writable fields (`PatchMerge.applyToEvent`) and, for a synced row, adds them to `pending_patch` (`RoomUpsertTest` in `:feature:eventeditor`, in-memory Room). Nothing is sent yet.
- [ ] 7.4 Add live updates for open shared events (WebSocket or polling); verify a test with a fake transport and a manual two-device check.
- [ ] 7.5 Build the share screen (public links with label and expiry presets, invite links with role, use count and expiry, member list with role change, remove and allow again) and the invite join flow, with deep links for `/e/`, `/i/` and `/s/`; verify ViewModel tests and the deep links on real devices after production launch.
- [ ] 7.6 Build the history screen and restore; verify ViewModel tests.
- [ ] 7.7 Add the backdrop picker: still compression, Live Photo paired video (iOS) and Motion Photo embedded video (Android) extraction, H.264 transcode without sound, key photo, animated preview, paywall on save with "Use still photo", photo limit checks, dim and blur sliders (blur 0 to 16; a pre-blurred downscaled bitmap below Android 12); verify that sample Live Photos and Pixel Motion Photos end up within the limits and that a Samsung motion photo falls back to a still.
- [ ] 7.8 Add purchases: StoreKit 2 through a Swift bridge with `appAccountToken`, Play Billing Library, paywall, restore, sending signed transactions and purchase tokens to the backend, guest purchases attached at sign-in, plan table checks before save; verify with sandbox purchases, renewal, refund and restore on both platforms.
- [ ] 7.9 Add audio: catalog picker with previews and Premium badges, the "My library" tab (pick a file with conversion to AAC and section trimming; the account's files newest first with title, duration, "used on N days", preview, use and remove; the counting note), a Report button on custom audio, download cache, player, Spotify share target (Android share intent, iOS share extension), oEmbed lookup, in-app Spotify preview where Spotify allows it, open in Spotify, free 3-event paywall, hidden when the region disables Spotify. Before building the preview, check whether a supported way to play Spotify previews in the app exists (`preview_url` is gone for new apps since November 2024; test the embed player without a Spotify login) and record the result in design D15; verify ViewModel tests, a 7 minute MP3 conversion, a removed library file still playing on its days, and a manual share from the Spotify app.
- [ ] 7.10 Remove the Firebase SDK and configuration from the app and CI; verify a clean build and that CI no longer needs `GOOGLE_SERVICES_JSON_BASE64`.
- [ ] 7.11 Update `docs/features/*` for anything the app work changed; verify by review in the PR.

## 8. Self-host variant `backend/selfhost/`

- [ ] 8.1 Implement the Node entry (HTTP server, static files, `/m/` media route), the `node:sqlite` driver with WAL, the disk `BlobStore`, the in-process WebSocket hub, an SMTP `Mailer` and the cron timer; verify the store conformance suite against it.
- [ ] 8.2 Add `Dockerfile` and `compose.yaml` (one container, one volume for the database and files); verify the HTTP conformance suite passes against the running container.
- [ ] 8.3 Write operator docs (configuration, TLS through a reverse proxy, mail, store keys, backup by copying the volume, upgrade, loading the audio catalog files); verify by following them on a clean machine.

## 9. Vercel variant `backend/vercel/`

- [ ] 9.1 Implement the handler entry, the libSQL driver over HTTP, the Vercel Blob `BlobStore`, `poll` mode, rewrites and the cron route protected by `CRON_SECRET`; verify the HTTP conformance suite locally with a libSQL file database.
- [ ] 9.2 Deploy a preview with Turso and Vercel Blob; verify the smoke test and a 4 MB upload against it.

## 10. Firebase variant `backend/firebase/`

- [ ] 10.1 Implement the Cloud Functions entry, `FirestoreStore`, the Cloud Storage `BlobStore`, the scheduled job, Hosting rewrites and deny-all Firestore and Storage client rules; verify the store conformance suite against the Firestore emulator.
- [ ] 10.2 Run the HTTP conformance suite against the Firebase emulators in CI; verify the job is green.

## 11. Launch (global region)

- [ ] 11.1 Complete the owner inputs in BACKEND.md section 15 (domain, app ids, OAuth clients, Apple keys, store products, App Store Server API key, Google Play service account, email provider and sender domain, abuse contact); verify the strict asset check in `backend/core/web/` passes.
- [ ] 11.2 Upload the built-in audio catalog (public domain recordings) and record the free and Premium split in `docs/features/premium/SPEC.md`; verify every catalog entry plays from the production backend.
- [ ] 11.3 Turn on the Cloudflare CSAM Scanning Tool for the media domain and update the privacy policy for accounts, emails, photos, audio, the audio library, history, purchases, promotions, Spotify links and previews, data export and inactive account deletion; verify both are live before the first production deploy.
- [ ] 11.4 Publish the terms of service, privacy policy and disclaimer from `docs/legal/` (rights to uploaded photos and audio, repeat-infringer policy) at `/terms` and `/privacy`, register a DMCA designated agent with the US Copyright Office, and add the takedown and upload-block commands to each variant's runbook; verify with a legal review, the coverage checklist in `docs/legal/README.md` and a takedown drill on preview.
- [ ] 11.5 Verify App Links and Universal Links for `/e/`, `/i/` and `/s/` on a real Android and iOS device, and link previews in WhatsApp and iMessage.

## Workflow follow-up

- Archive the change with `openspec archive pluggable-backend-live-sharing` after review, so its specs move to `openspec/specs/`.
- Remove the superseded notes from the share service docs once they are deleted.
- Start a separate change for the China region when the open points in `docs/architecture/CHINA.md` are answered.
- When a Kotlin/JS revisit trigger in design D1 fires, build the two-route measurement (link read, event patch) on a Workers Free preview, record it in BACKEND.md section 13, and decide in a new change.
