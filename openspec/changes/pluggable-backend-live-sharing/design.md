# Design: Pluggable backend and live shared events

Reference architecture (directories, ports, variants, schema, API table, limits): [`docs/architecture/BACKEND.md`](../../../docs/architecture/BACKEND.md). This file records the decisions behind it. Motivation: see proposal.md, Why.

## Context

- The repo has no app code yet. `services/share/` is a working TypeScript service (Hono, D1, Static Assets, 179 tests) for snapshot links with manage tokens. Nothing is deployed.
- Priorities set by the project owner: performance and low running cost come before code sharing. The backend is split into one core with all functionality and one directory per provider variant.
- Hard platform limits that shape the design:
  - Cloudflare Workers Free: 10 ms CPU per request, 100,000 requests per day, D1 100,000 rows written per day, 3 MB compressed script.
  - Durable Objects Free: SQLite-backed objects only, 100,000 requests and 13,000 GB-s per day.
  - Vercel Functions: 4.5 MB request body. Hobby plan is for non-commercial use only.
  - Firebase Cloud Functions: need the Blaze (pay as you go) plan.
  - Spotify: since 15 May 2025, Web API extended access only goes to registered businesses with at least 250,000 monthly active users. Development mode allows a handful of allowlisted users (25, reportedly 5 since 2026). Starting a track on demand through the mobile SDKs needs Spotify Premium.

## Goals / Non-Goals

**Goals:**
- Low CPU per request and low cost at small scale; free on Cloudflare and self-host.
- One backend core with all behavior. Changing provider means choosing another variant directory, never changing the core or the app.
- One source of truth for rules shared by app and backend: `:core:model`.
- One table of premium features, used by the app, the backend and the docs.

**Non-Goals:**
- Running one deployment across several providers at once.
- Moving live data between providers (SQL-family variants can move with a SQLite dump; a Firestore export tool is built when someone needs it).
- Real-time co-editing of text.
- In-app Spotify playback through Spotify's SDKs or Web API (see D15).

## Decisions

### D1. Backend language is chosen by measurement; performance and cost win

Two candidates for `backend/core`:
- **Kotlin/JS**: compiles `:core:model` straight into the backend, so validation, merge rules, plan limits and the countdown engine are the same code as in the app.
- **TypeScript**: smaller bundles and faster start. The existing `services/share/` code is a head start. Rules come from `:core:model` as generated contract files (JSON Schema for the API types, the plan table as JSON, test vectors for validation, merge and countdown), checked in CI so the two sides cannot drift.

Task 1 builds the same two routes in both and deploys them to a Workers preview. Kotlin/JS is chosen only if all hold; otherwise TypeScript:
- warm CPU time per request at most 1.25 × the TypeScript build (CPU time is what Workers bill),
- Worker startup time at most 100 ms,
- gzip bundle at most 1 MB.

Every other decision in this file holds for either language.

Alternatives:
- Decide Kotlin now. Rejected: a report of 100 to 200 ms cold starts for Kotlin/JS on Workers, and cost matters more than sharing code.
- Ktor on the JVM. Rejected: no JVM on Workers or Vercel; Cloud Functions run Node or Python.
- Kotlin/Wasm. Not measured first: less proven on Workers. Can be added to the spike if Kotlin/JS narrowly fails.

### D2. One core directory, one directory per variant, three ports

```
backend/core/          all behavior: API, auth, sync, sharing, history, media checks, plans, audio, pages, purge
                       + migrations/, web/ (share page assets), audio/catalog.json, conformance/
backend/cloudflare/    variant: entry, D1, R2, Durable Object, cron, wrangler config
backend/selfhost/      variant: Node entry, SQLite file, disk storage, WebSocket hub, Dockerfile
backend/vercel/        variant: handler, Turso (libSQL), Vercel Blob, cron
backend/firebase/      variant: function entry, Firestore, Cloud Storage, Hosting config
```

The core depends only on its ports:
- `Store`: persistence at the level of use cases (create event, append revision, find link). One `SqlStore` over a tiny `SqlDriver` (query, batch) serves D1, `node:sqlite` and libSQL; `FirestoreStore` serves Firebase. Both pass one store conformance suite.
- `BlobStore`: put, get (stream), delete, public URL.
- `LiveHub`: publish a change notice; declares the mode `ws` or `poll`.
- `Clock`, `Random`, `Config` for tests and settings.

A variant contains only port implementations, its entry file and its deploy config. All SQL variants use the SQLite dialect, so there is one migration set.

Alternatives:
- Postgres for Vercel. Rejected: a second dialect and migration set.
- An ORM. Rejected: bundle size and CPU for about 40 statements.
- A port per table. Rejected: Firestore needs use-case level operations to keep transactions in one call.

### D3. The backend stores events and memos; sharing grants access to the stored event

An event lives on the backend as one document with a revision number. Sync, live links, people access and history work on that document. Memos live next to it (D6). A public link is a capability to read a projection of the event.

Alternatives: Firestore for sync plus snapshot copies for links. Rejected: two backends, provider lock-in, no live links.

### D4. Accounts: Google and Apple sign-in, no anonymous accounts

Everything on the backend needs an account: sync, public links, invites, accepting invites. Guests keep full local use. When a guest taps Sync, Share or Invite, and once after their first saved event, the app asks them to sign in or create an account. First sign-in creates the account ("create account" and "sign in" are the same step with Google or Apple), and local events and memos upload to it.

The core verifies Google and Apple ID tokens (JWKS, signature, `iss`, `aud`, `exp`, `nonce`) and issues opaque session tokens, stored hashed. The web uses the authorization code flow with PKCE. Apple requires Sign in with Apple when an iOS app offers Google sign-in (App Store Review Guideline 4.8).

Alternatives:
- Anonymous accounts for guest links (previous draft). Dropped: the owner wants an account for anything online, and it removes install secrets, merging and a class of lost-link cases.
- Firebase Auth on every provider. Rejected: ties all providers to Google.
- Email and password. Rejected: password hashing does not fit 10 ms CPU on Workers Free. Email one-time codes can come later behind a `Mailer` port.

### D5. Field-level last-write-wins plus a revision log

A write is `{baseRev, patch}` with new values for top-level fields. The server applies it in arrival order, appends a revision `{patch, inverse}`, and returns the fields where the write replaced a change made after `baseRev` by someone else. Nested objects (theme, recurrence, backdrop, audio) are replaced whole. Memos use the same patch rule without revisions.

Alternatives: reject stale writes (bad offline UX); CRDTs (overkill for about 12 small fields).

### D6. Sync: event manifest plus a per-event child sequence

- `GET /sync` returns `[{id, rev, role, childSeq}]` for every event the account can access, with an ETag. An idle sync is one `304`.
- Changed event documents are fetched in batches of 100. An event missing from the manifest was deleted or access was lost.
- Children (memos now, comments when that phase ships) carry `seq` from a counter on their event. `GET /events/{id}/children?after=seq` returns changed and deleted children. Tombstones are kept 30 days; a client further behind gets `reset: true` and refetches that event's children.
- Auto sync runs within 2 seconds of each saved edit, on app start and on foreground. The Sync button runs the same sync at once and reminds the user that edits sync automatically.

Alternatives: one cursor-based change feed per account. Rejected: needs removed-access records and clock-safe cursors on every store.

### D7. Live updates are change notices over WebSocket or conditional polling

Messages carry no data, only `{"type":"rev","rev":13}`, `{"type":"children","seq":40}` or `{"type":"access"}`. Clients refetch with `If-None-Match`, so authorization stays in the normal read path.

| Variant | Mode | How |
| :--- | :--- | :--- |
| cloudflare | `ws` | One Durable Object per event with the WebSocket Hibernation API; idle sockets cost no duration |
| selfhost | `ws` | In-process hub |
| vercel | `poll` | Functions cannot hold sockets across instances |
| firebase | `poll` | Same |

Alternatives: Server-Sent Events (keep the Durable Object awake, spending duration); a hosted realtime service for Vercel and Firebase (possible later as another `LiveHub`).

### D8. Share web is server-rendered HTML plus small plain ES modules

The core renders `/e/{token}`, `/i/{token}` and sign-in pages. Scripts are plain ES modules, no framework, no bundler: `countdown.js` (existing), `live.js`, `editor.js` (loaded only for editors). The web editor covers text, date, time, zone, recurrence, theme, still backdrops and dim. Animated photos and audio are chosen in the app, because browsers cannot read Live Photos and the audio picker needs the app's player.

Alternatives: Compose Multiplatform for Web (multi-megabyte, canvas hurts previews and screen readers); a SPA framework (one card, one form, one list).

### D9. Backdrops: still photos, and animated photos from Live Photos and Motion Photos

- Sources: any still photo; iPhone Live Photos; Motion Photos in Google's format (Pixel, Google Photos). Other vendor formats fall back to the still. No GIFs or plain videos.
- The device does all conversion. Still and key photo: resize and re-encode to JPEG or WebP (drops metadata). Motion: iOS takes the Live Photo's paired video, Android cuts the MP4 embedded at the end of the Motion Photo file; both transcode to H.264 MP4 at most 1280 px and 5 seconds, with the audio track removed (AVFoundation, Media3 Transformer). H.264 because browsers do not all play HEVC.
- Display: the animation plays once when the event opens and again on touch, then rests on the key photo, like the Photos apps. Reduced motion shows only the key photo. Lists, widgets and link previews use the key photo.
- The core checks types from magic bytes, reads dimensions and duration from headers, strips EXIF and XMP from JPEG and WebP, rejects MP4 with an audio track or location atom, and enforces limits. No server transcoding.
- Uploads go through `POST /events/{id}/media`. The 4 MB cap fits Vercel's 4.5 MB body limit, so one upload path works everywhere.
- Files are served from a media origin under unguessable ids with a 1 day cache.

Alternatives: presigned direct uploads (four mechanisms); server transcoding (CPU and cost); storing original HEIC and MOV (no browser support for HEVC in every browser, larger files).

### D10. Link tokens stored in clear; invites and sessions hashed

A link token is a read capability for data in the same database, so hashing it protects nothing after a leak, and storing it lets the owner copy links on any device. Invite and session tokens grant or prove identity, so they are stored as SHA-256 and returned once.

### D11. Invites: one-time URLs consumed when linked, not when opened

The owner (signed in) sends an invite URL through any messenger. Opening it consumes nothing. The receiver opens it in the app if installed, otherwise on the web, signs in or creates an account there if needed, and accepts. Accepting links their account to the event with the invite's role and consumes the invite. If the receiver already has access, or is the owner, the event opens and the invite stays unused. The owner can cancel unused invites; unused invites expire after 30 days as a safety net.

Alternatives: consume on open (breaks when the receiver is not signed in yet); invite by email (needs email delivery; Apple private relay addresses do not match).

### D12. Comments come later, on the same sync path

Planned, not built in this change: a `commenter` role; event settings `comments: off | people | anyone` and `commentVisibility: owner | participants`; anonymous comments visible only to the owner. Comments will be event children (D6), so they sync to every signed-in device like memos.

### D13. Retire the TypeScript share service

`services/share/` is frozen. If TypeScript wins D1, its code (validation, tokens, headers, page rendering, rate limits) is the starting point of `backend/core`. Either way its tests become the reference: API flows move to `backend/core/conformance/`, page tests to the core, and assets to `backend/core/web/`. When the Cloudflare variant passes conformance, `services/share/` and its workflow are deleted.

### D14. Plans and entitlements

- Plans: `free`, `premium`, `premium_plus` (reserved; no features assigned yet). One plan table in `:core:model` maps each plan to its limits; the app, the backend and [`docs/features/premium/SPEC.md`](../../../docs/features/premium/SPEC.md) follow it.
- Gating uses the **event owner's** plan, so an editor of a Premium owner's event can use Premium features there, and the same check works for every writer. Viewers see everything regardless of their plan.
- Free users can add and preview a Premium feature; saving shows the paywall with an upgrade option and, where there is one, a free alternative (for example "Use still photo").
- When Premium ends, existing Premium content keeps working; only new Premium content is blocked.
- Purchases: App Store and Google Play subscriptions through RevenueCat (free up to 2,500 USD monthly tracked revenue, then 1%). Guests can buy; the purchase attaches to the account at sign-in. The backend never trusts the app: after a purchase, and on launch when the cached plan has expired, the app calls `POST /me/plan/refresh` and the core asks RevenueCat's REST API. A daily job re-checks expired plans. No webhooks (they may need a paid RevenueCat plan).

Alternatives: verify App Store JWS and Google Play purchases directly (no fee, but certificate-chain checks, a Google service account and two notification channels; worth it once the 1% fee exceeds the upkeep); trust the app's own entitlement (anyone could patch the app).

### D15. Background audio: a built-in catalog and Spotify links

- Built-in tracks: listed in `backend/core/audio/catalog.json` (id, title, artist, duration, tier), files in the blob store, at most 4 MB each (AAC). A handful are free, the rest Premium. Files are served through `GET /audio/{trackId}`, which allows free tracks to anyone and Premium tracks to Premium accounts and to anyone who can view an event using that track. The app caches downloaded tracks.
- Spotify: the user shares or pastes a Spotify track, album or playlist link. The app reads its title and artist from Spotify's public oEmbed endpoint, which needs no Spotify sign-in. Playing opens the Spotify app (or Spotify on the web). Free accounts can have Spotify links on at most 3 owned events; Premium is unlimited.
- Picking your own audio files is removed: large uploads, and copyright risk on public pages.
- Audio is a shared field. People in the event and link visitors can play it; the web page never autoplays.

Alternatives: Spotify sign-in with in-app playback through the Spotify SDKs or Web API. Rejected for now: blocked by Spotify's access rules until 250,000 monthly users, and on-demand playback needs Spotify Premium. Revisit if the app qualifies.

## Risks / Trade-offs

- [Kotlin/JS is slower or larger than TypeScript] → D1 measures first; TypeScript is a full option, not a last resort.
- [Free tier caps on Cloudflare] → Budget in BACKEND.md; static assets and WebSocket notices instead of polling; Workers Paid past about 30,000 page views per day.
- [Vercel Hobby forbids commercial use; Firebase needs Blaze] → Cloudflare is the primary variant; plan requirements are documented.
- [Photos on public links raise abuse and illegal content risk] → Report link on every page, takedown runbook, Cloudflare CSAM Scanning Tool on the media domain before launch, people links never indexed or previewed.
- [A removed backdrop stays reachable through caches for up to 1 day] → Documented; signed URLs later if needed.
- [Last-write-wins can overwrite a collaborator's change to the same field] → History keeps the old value, restore is one tap, the writer is told what they replaced.
- [Motion Photo formats vary by vendor] → Google's format is supported; others fall back to the still photo without an error.
- [Spotify links depend on the user having Spotify] → The link opens Spotify on the web when the app is missing.
- [Premium audio URLs could be shared] → Files are served only through the access-checked route; the app caches them locally.
- [RevenueCat outage or API change] → The cached plan keeps working until its expiry; the daily re-check retries.
- [Sign-in required for any sharing reduces casual sharing] → Sign-in is one tap with Apple or Google; local use stays account-free.
- [Four variants multiply maintenance] → Ship Cloudflare and self-host first; Vercel and Firebase count as supported only when conformance passes in CI.

## Migration Plan

1. Nothing is deployed, so there is no data migration. Owner setup items from `docs/plans/SHARE_SERVICE_STATUS.md` still apply; R2, a Durable Object namespace, the media domain, store products and RevenueCat are added.
2. Build in the order of tasks.md. `services/share/` stays until task 5.5 removes it.
3. The app ships against Cloudflare first. Self-host is usable for local development and private installs once its conformance run passes.
4. Rollback per variant: `wrangler rollback`, previous Docker image tag, Vercel instant rollback, previous Cloud Functions revision. Migrations only add tables or columns, so the previous build keeps working.

## Open Questions

- Email sign-in with one-time codes for people without Google or Apple accounts (needs an email provider: Resend, SES or SMTP on self-host).
- Which features go to Premium Plus.
- Push notifications for collaborator edits and new comments.
- Paid plan thresholds and alerting per provider after the first month of real traffic.
