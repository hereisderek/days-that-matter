# Design: Pluggable backend and live shared events

Reference architecture (modules, ports, adapters, schema, API table, limits): [`docs/architecture/BACKEND.md`](../../../docs/architecture/BACKEND.md). This file records the decisions behind it. Motivation: see proposal.md, Why.

## Context

- The repo has no app code yet. Docs plan Room for local data, Firestore for sync and Firebase Auth for accounts.
- `services/share/` is a working TypeScript service (Hono, D1, Static Assets, 179 tests) for snapshot links with manage tokens. Nothing is deployed and no Cloudflare account exists yet.
- Hard platform limits that shape the design:
  - Cloudflare Workers Free: 10 ms CPU per request, 100,000 requests per day, D1 100,000 rows written per day.
  - Durable Objects Free: SQLite-backed objects only, 100,000 requests and 13,000 GB-s per day.
  - Vercel Functions: 4.5 MB request body. Hobby plan is for non-commercial use only.
  - Firebase Cloud Functions: need the Blaze (pay as you go) plan.

## Goals / Non-Goals

**Goals:**
- One Kotlin codebase for the backend, sharing `:core:model` with the app.
- Swapping provider changes deploy config and one adapter module, never the core or the app.
- Light at runtime: no framework on the server, small per-request CPU, no server-side media processing.
- Free or near-free at small scale on Cloudflare and self-host.

**Non-Goals:**
- Running one deployment across several providers at once.
- Moving live data between providers (SQL-family adapters can move with a SQLite dump; a Firestore export tool is built when someone needs it).
- Real-time co-editing of text (characters merging as people type).

## Decisions

### D1. Backend in Kotlin, compiled to JS, on all four providers

The server core and `:core:model` are Kotlin Multiplatform. The deployable is Kotlin/JS (IR, ES modules). All four targets run JavaScript: Workers, Node (self-host), Vercel Functions (Node) and Cloud Functions (Node). The core also compiles to JVM for fast tests.

Alternatives:
- Keep the TypeScript service and share only a JSON Schema plus test vectors. Rejected: validation, merge and countdown rules would live twice and drift. The user asked for a data layer shared with the backend.
- Ktor on the JVM everywhere. Rejected: no JVM on Workers or Vercel, and Cloud Functions run Node or Python.
- Kotlin/Wasm. Not chosen now: Kotlin/JS is the more proven path on Workers. It is the first fallback if the spike in tasks group 1 fails.

Constraint: Kotlin/JS cold start on Workers is a known risk (see Risks). Task 1.1 measures it before any other work, with a go/no-go threshold.

### D2. Ports and adapters, with one SQL dialect

The core depends on three ports plus test seams:
- `Store`: all persistence, at the level of use cases (create event, append revision, find link). Implemented once as `SqlStore` over a tiny `SqlDriver` (query, batch), and once as `FirestoreStore`.
- `BlobStore`: put, delete and public URL for backdrop files.
- `LiveHub`: publish a change notice; declares the mode `ws` or `poll`.
- `Clock`, `Random`, `Config`: injected for tests and per-provider settings.

All SQL adapters use SQLite: D1 (Cloudflare), `node:sqlite` (self-host), libSQL on Turso (Vercel). One schema and one migration set.

Each adapter is a Kotlin/JS module (port implementations with small `external` declarations for the vendor SDK) plus a short TypeScript entry file for what Kotlin cannot export well (the Worker default export, the Durable Object class, the Cloud Functions export).

Alternatives:
- Postgres for Vercel (Neon). Rejected: a second SQL dialect and migration set for one adapter.
- An ORM or query builder. Rejected: weight and bundle size; about 30 statements do not need it.
- A port per table (repository per entity). Rejected: Firestore needs use-case level operations to keep transactions inside one call.
- Adapters fully in TypeScript implementing exported Kotlin interfaces. Rejected: the store logic would be written twice (Kotlin `SqlStore`, TypeScript `FirestoreStore`) and the store conformance tests could not be shared.

### D3. The backend stores events; sharing grants access to the stored event

An event shared or synced lives on the backend as one document with a revision number. Sync, live links, people access and history all work on that one document. A public link is a capability to read a projection of the document.

Alternatives:
- Keep Firestore for sync and copy snapshots to the share service. Rejected: two backends, provider lock-in, no live links.
- Live links without server-side events (the owner's app pushes snapshots on every edit). Rejected: editing by other people needs a server copy anyway.

### D4. Own accounts and sessions; Google and Apple ID tokens; anonymous accounts replace manage tokens

The core verifies Google and Apple ID tokens itself (JWKS, signature, `iss`, `aud`, `exp`) and issues opaque session tokens, stored hashed. The app gets ID tokens from Credential Manager (Android), AuthenticationServices (iOS) and an in-app browser tab for Apple on Android. The web uses the authorization code flow with PKCE, handled by the core. A guest's first public link creates an anonymous account bound to a 256-bit install secret.

Alternatives:
- Firebase Auth on every provider. Rejected: ties all providers to Google and puts the Firebase SDK back in the app.
- Keep manage tokens. Rejected: no multi-device management, no people access, lost-token problem.
- Email and password. Rejected: password hashing does not fit 10 ms CPU on Workers Free, and resets need email delivery. Email one-time codes come later behind a `Mailer` port.

Apple requires Sign in with Apple when an iOS app offers Google sign-in (App Store Review Guideline 4.8). Both are in from the start.

### D5. Field-level last-write-wins plus a revision log

A write is `{baseRev, patch}`. The patch holds new values for top-level fields. The server applies it to the current document in arrival order, appends a revision `{patch, inverse}` and returns the fields where the write replaced a change made after `baseRev` by someone else. Nested objects (theme, recurrence, backdrop) are replaced whole.

Alternatives:
- Reject stale writes (`412`). Rejected: bad for offline-first; the app would need a conflict screen.
- CRDT or operational transforms. Rejected: about 10 small fields do not need them.

### D6. Sync by manifest, not by change feed

`GET /events` returns `[{id, rev, role}]` for all events the account can access (at most about 550 entries: 500 owned plus shared). The app compares with local revisions and fetches changed documents in batches of 100. An event missing from the manifest was deleted or access was lost. The manifest has an ETag, so an idle sync is one `304`.

Alternatives:
- A cursor-based change feed. Rejected: needs tombstones, removed-access records and clock-safe cursors on every store.

### D7. Live updates are change notices over WebSocket or conditional polling

Messages carry no event data, only `{"type":"rev","rev":13}` or `{"type":"access"}`. Clients refetch with `If-None-Match`, so authorization stays in the normal read path.

| Adapter | Mode | How |
| :--- | :--- | :--- |
| cloudflare | `ws` | One Durable Object per event, WebSocket Hibernation API, so idle sockets cost no duration |
| selfhost | `ws` | In-process hub in the Node process (`ws` package) |
| vercel | `poll` | Functions cannot hold sockets across instances |
| firebase | `poll` | Same; Firestore listeners would need the Firebase SDK in clients |

Alternatives:
- Server-Sent Events. Rejected for Cloudflare: an SSE stream keeps the Durable Object awake and spends duration; hibernation works only with WebSockets.
- A hosted realtime service (Ably, Pusher) for Vercel and Firebase. Possible later as another `LiveHub` implementation; not needed for the 30 second target.

### D8. Share web is server-rendered HTML plus small plain ES modules

The core renders `/e/{token}`, `/i/{token}` and the sign-in pages (ported from `services/share/src/page/`). Scripts are plain ES modules with no framework and no bundler, typechecked with `tsc --checkJs`: `countdown.js` (existing), `live.js` (WebSocket or polling), `editor.js` (loaded only for editors: form, backdrop upload, history). The browser does not load Kotlin code; the server is the authority on validation and returns field paths.

Alternatives:
- Compose Multiplatform for Web (Wasm). Rejected for the share page: multi-megabyte download, canvas rendering hurts link previews and screen readers.
- A SPA framework. Rejected: the page has one card, one form and one list.
- Shipping `:core:model` as Kotlin/JS to the browser for client-side validation. Rejected for now: about 150 KB or more for hints the server already gives.

### D9. Media: compress on the client, check and strip on the server, upload through the API

- The app and the web editor resize and re-encode (re-encoding also drops metadata). Android: `Bitmap` to WebP or JPEG, Media3 Transformer for video. iOS: ImageIO to JPEG, AVFoundation for video and Live Photos. Web editor: canvas to WebP or JPEG; GIF and animated WebP pass through when at most 4 MB.
- The core sniffs the type from magic bytes, reads dimensions and duration from headers without decoding, removes EXIF and XMP segments from JPEG and WebP, rejects MP4 files with an audio track or location atom, and enforces limits. No transcoding: Workers CPU and serverless costs rule it out.
- Uploads go through `POST /events/{id}/media`. A 4 MB cap fits the 4.5 MB Vercel body limit, so one upload path works everywhere.
- Files are served from a media origin under unguessable 128-bit ids: R2 custom domain (`media.<domain>`), Vercel Blob, Cloud Storage, or `/m/` on self-host with `Content-Security-Policy: sandbox`. Cache lifetime is 1 day, which bounds how long a removed file stays reachable.

Alternatives:
- Presigned direct uploads. Rejected: four different mechanisms (R2 S3 presign, Vercel client tokens, GCS signed URLs, none on self-host).
- Server-side transcoding (Cloudflare Images, sharp, ffmpeg). Rejected: paid or CPU-heavy, and different per provider.
- Media through an access-checked route. Rejected: a Worker request and a D1 read per image view, and no CDN cache for people links. Signed short-lived URLs are a later hardening.

### D10. Link tokens stored in clear; invites, sessions and install secrets hashed

A link token is a read capability for data that sits in the same database, so hashing it protects nothing after a database leak, and storing it lets the owner copy links on any device. Invite tokens grant roles and session tokens and install secrets authenticate, so they are stored as SHA-256 and returned only once.

Alternative: hash link tokens as in `services/share/`. Rejected: owners could not see their links on a second device.

### D11. People access through single-use invites, not email lists

The owner sends the invite URL through any messenger. The first signed-in account that accepts it gets the role. The owner sees who accepted.

Alternative: share by email address. Rejected: needs email delivery, and Apple's private relay addresses do not match the address the owner knows.

### D12. Comments are left for a later change, with room in the model

Planned shape, not built now: a `commenter` role; per event settings `comments: off | people | anyone` and `commentVisibility: owner | participants`; a `comments` table (`id, event_id, author_account_id` nullable for anonymous, `author_name, body, created_at, hidden_at`). Anonymous comments would need their own rate limits and a report flow. Nothing in this change blocks that.

### D13. Retire the TypeScript service after parity

`services/share/` is frozen. Its tests are the behavior reference: API flows move to `server/conformance/`, page tests (states, headers, XSS corpus) to `:server:core`, and `countdown.js`, fonts, CSS and association files to `server/web/`. Once the Cloudflare adapter passes the conformance suite, `services/share/` and `share-service.yml` are deleted.

## Risks / Trade-offs

- [Kotlin/JS cold start on Workers; one report measured 100 to 200 ms, blamed on loading coroutines and the stdlib] → Task 1.1 measures bundle size and cold start first. The server avoids `kotlinx-coroutines` (it uses stdlib `suspendCoroutine` to await promises). Fallbacks in order: Kotlin/Wasm, then a TypeScript core with `:core:model` generating the JSON Schema and test vectors.
- [Time zone data for `kotlinx-datetime` on JS adds bundle weight] → Used only on the server for the initial render and preview text. The page keeps `countdown.js` with `Intl`, checked against vectors generated by the Kotlin engine.
- [Free tier caps on Cloudflare] → Budget in BACKEND.md; static assets and WebSocket notices instead of polling; upgrade to Workers Paid past about 30,000 page views per day.
- [Vercel Hobby forbids commercial use; Firebase needs Blaze] → Cloudflare is the primary target; the provider table states plan requirements.
- [Photos on public links raise abuse and illegal content risk] → Report link on every page, takedown runbook deletes media, Cloudflare CSAM Scanning Tool on the media domain before launch, people links never indexed or previewed.
- [A removed backdrop stays reachable through caches for up to 1 day] → Documented. Signed URLs later if needed.
- [Last-write-wins can overwrite a collaborator's change to the same field] → History keeps the old value, restore is one tap, and the writer is told what they replaced.
- [A guest who loses the device cannot manage their links] → One-time warning, upgrade by signing in, optional expiry on links.
- [Firestore behaves differently from SQL (transaction limits, query shapes)] → `FirestoreStore` must pass the same store conformance tests as `SqlStore`.
- [Web sessions use cookies, so CSRF becomes possible] → `SameSite=Lax`, and unsafe methods with a cookie require a matching `Origin` and the header `X-DTM-CSRF: 1`. No CORS headers anywhere.
- [Four adapters multiply maintenance] → Ship Cloudflare and self-host first. Vercel and Firebase follow and count as supported only when conformance passes in CI.

## Migration Plan

1. Nothing is deployed, so there is no data migration. Owner setup items from `docs/plans/SHARE_SERVICE_STATUS.md` (Cloudflare account, D1, domain, app ids) still apply; R2, a Durable Object namespace and the media domain are added.
2. Build in the order of tasks.md. `services/share/` stays untouched until task 5.5 removes it.
3. The app ships against Cloudflare first. Self-host is usable for local development and private installs as soon as its conformance run passes.
4. Rollback per adapter: `wrangler rollback`, previous Docker image tag, Vercel instant rollback, previous Cloud Functions revision. Migrations only add tables or columns, so the previous build keeps working.
5. Switching provider later: SQL-family adapters move with a SQLite dump and a copy of the media files. Moving to or from Firestore needs an export tool, built when first needed.

## Open Questions

- Which email provider to use when one-time code sign-in is added (Resend, SES or SMTP on self-host).
- Whether collaborator edits trigger push notifications (FCM, APNs), and through which port.
- Paid plan thresholds and alerting per provider after the first month of real traffic.
