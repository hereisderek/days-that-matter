# Backend Architecture & API Contract

Status: design, not implemented. Behavior requirements: OpenSpec change [`pluggable-backend-live-sharing`](../../openspec/changes/pluggable-backend-live-sharing/) (specs in its `specs/` folder). Decisions and alternatives: its [`design.md`](../../openspec/changes/pluggable-backend-live-sharing/design.md). Work order: its [`tasks.md`](../../openspec/changes/pluggable-backend-live-sharing/tasks.md).

This document replaces [`SHARE_SERVICE.md`](SHARE_SERVICE.md), which describes the frozen TypeScript service in `services/share/`.

---

## 1. Summary

- One backend for accounts, event sync, sharing, history and backdrops.
- Written in Kotlin. Shares `:core:model` with the app. Compiled to JS.
- Runs on four providers through adapters: **cloudflare** (primary), **selfhost**, **vercel**, **firebase**.
- No web framework, no ORM, no server-side media processing.

---

## 2. Architecture

```
  Android / iOS app (KMP)             Browser (share pages)
  Ktor client, :core:model            HTML + countdown.js, live.js, editor.js
        |  /api/v1/*  (Bearer)               |  /e, /i, /auth, /api/v1 (cookie)
        v                                    v
 +-------------------------------------------------------------------+
 | Adapter entry (TypeScript, ~50 lines): Worker / Node / Vercel / CF |
 |   converts the platform request, wires ports, cron, WebSocket      |
 +-------------------------------------------------------------------+
 | :server:core (Kotlin, common code)                                 |
 |   router, auth, events, history, sharing, media checks, pages,     |
 |   rate limits, purge                       uses :core:model        |
 |                                                                    |
 |   ports:  Store        BlobStore        LiveHub      Clock/Random  |
 +-----------|---------------|----------------|-----------------------+
             v               v                v
   SqlStore + SqlDriver   R2 / fs /       Durable Object / in-process
   (D1, node:sqlite,      Vercel Blob /   hub (ws) or no-op (poll)
    libSQL) or            Cloud Storage
   FirestoreStore
```

Rules:
- The core never imports a vendor SDK. Vendor code lives only in adapter modules.
- The core speaks its own `CoreRequest` and `CoreResponse` types (method, path, query, headers, body bytes, client IP). Each adapter converts to and from its platform types. A `LiveUpgrade(eventId, subscriber)` response tells the adapter to open a WebSocket.
- `:server:core` compiles to JVM (tests) and JS (deploy). It does not use `kotlinx-coroutines`; promises are awaited with stdlib `suspendCoroutine`.

---

## 3. Modules and repository layout

```
core/model/              KMP: android, iosArm64, iosSimulatorArm64, jvm, js
                         EventDoc, field sets, roles, validation, patch/merge, projections,
                         countdown engine, API DTOs, error codes. Deps: kotlinx-serialization, kotlinx-datetime.
core/network/            app only: Ktor client for /api/v1, live client (ws or poll)
core/database/           app only: Room
server/
  core/                  KMP: jvm, js. Router, handlers, ports, SqlStore, page rendering
  migrations/            SQLite SQL, shared by D1, self-host and libSQL
  web/                   static assets: share.css, countdown.js, live.js, editor.js, fonts,
                         og/default.png, .well-known/*, test vectors
  conformance/           black-box HTTP tests (node:test), run against every adapter
  cloudflare/            Kotlin/JS ports + worker.ts, event-room.ts, wrangler.jsonc
  selfhost/              Kotlin/JS ports + main.ts, Dockerfile, compose.yaml
  vercel/                Kotlin/JS ports + api/index.ts, vercel.json
  firebase/              Kotlin/JS ports + index.ts, firebase.json, firestore.rules, storage.rules
```

Gradle paths: `:core:model`, `:server:core`, `:server:cloudflare`, `:server:selfhost`, `:server:vercel`, `:server:firebase`. Each adapter module builds its own JS bundle with only its own vendor code.

---

## 4. Ports

```kotlin
interface Store {                       // use-case level; one call = one transaction
    suspend fun createAnonymousAccount(installSecretHash: String, now: Long): Account
    suspend fun applyPatch(eventId: String, author: String, baseRev: Int, patch: JsonObject, now: Long): PatchResult
    suspend fun manifest(accountId: String): List<ManifestEntry>
    // ... about 30 operations: accounts, identities, sessions, events, revisions,
    //     links, grants, invites, media, rate counters, purge
}

interface SqlDriver {                   // the only thing SQL adapters implement for persistence
    suspend fun query(sql: String, args: List<Any?>): List<Map<String, Any?>>
    suspend fun batch(statements: List<Statement>): List<Int>   // atomic
}

interface BlobStore {
    suspend fun put(key: String, bytes: ByteArray, contentType: String)
    suspend fun delete(keys: List<String>)
    fun publicUrl(key: String): String
}

interface LiveHub {
    val mode: LiveMode                  // Ws or Poll
    suspend fun publish(eventId: String, message: LiveMessage)   // no-op in Poll mode
}
```

`Clock`, `Random` and `Config` (origin, media origin, OAuth client ids and secrets, maintenance flag) are injected. Tests use in-memory fakes. Every `Store` implementation must pass the store conformance suite (common test code).

---

## 5. Provider adapters

| | cloudflare | selfhost | vercel | firebase |
| :--- | :--- | :--- | :--- | :--- |
| Runtime | Workers | Node 24 LTS or newer, Docker | Vercel Functions (Node) | Cloud Functions 2nd gen (Node) |
| Store | D1 via `SqlStore` | SQLite file via `node:sqlite` (WAL) | Turso (libSQL over HTTP) via `SqlStore` | Firestore via `FirestoreStore` |
| Blobs | R2, public on `media.<domain>` | directory on the volume, served at `/m/` | Vercel Blob (public) | Cloud Storage bucket |
| Live mode | `ws`: Durable Object `EventRoom` per event, Hibernation API | `ws`: in-process hub (`ws` package) | `poll` | `poll` |
| Purge | Cron Trigger `0 3 * * *` | timer in the process | Vercel Cron calling `/api/v1/internal/purge` with `CRON_SECRET` | `onSchedule` |
| Static files | Static Assets, `run_worker_first: ["/e/*","/i/*","/auth/*","/api/*"]` | served by the Node entry | `public/` + rewrites | Firebase Hosting + rewrites to the function |
| Plan needed | Workers Free | your server | Hobby is non-commercial only; Pro for a commercial app | Blaze (pay as you go) |
| Platform body limit | 100 MB | none | 4.5 MB | 32 MB |

Notes:
- Cloudflare Durable Objects on the Free plan must be SQLite-backed, so `EventRoom` is declared with a `new_sqlite_classes` migration even though it stores nothing.
- Self-host can put media on a separate host through its reverse proxy (`MEDIA_ORIGIN`). On the same origin, `/m/` responses carry `Content-Security-Policy: sandbox` and `X-Content-Type-Options: nosniff`.
- Firebase rules deny all client access to Firestore and Storage. Only the function (Admin SDK) reads and writes.
- Moving between SQL-family adapters: SQLite dump and import plus a copy of the media files. Moving to or from Firestore needs an export tool, built when first needed.

---

## 6. Data model

### 6.1 SQL (SQLite dialect), `server/migrations/0001_init.sql`

Times are unix seconds UTC. No foreign key constraints; the core keeps references consistent.

```sql
CREATE TABLE accounts (
  id           TEXT PRIMARY KEY,                -- uuid
  kind         TEXT NOT NULL CHECK (kind IN ('anonymous','full')),
  display_name TEXT NOT NULL,
  media_bytes  INTEGER NOT NULL DEFAULT 0,      -- backdrop storage used, for the quota
  created_at   INTEGER NOT NULL
);
CREATE TABLE identities (
  provider   TEXT NOT NULL CHECK (provider IN ('install','google','apple')),
  subject    TEXT NOT NULL,                     -- OIDC 'sub'; SHA-256 hex of the install secret for 'install'
  account_id TEXT NOT NULL,
  email      TEXT,                              -- verified email from the provider, shown to the account owner only
  created_at INTEGER NOT NULL,
  PRIMARY KEY (provider, subject)
) WITHOUT ROWID;
CREATE INDEX idx_identities_account ON identities(account_id);

CREATE TABLE sessions (
  token_hash   TEXT PRIMARY KEY,                -- SHA-256 hex of the session token
  account_id   TEXT NOT NULL,
  client       TEXT NOT NULL CHECK (client IN ('app','web')),
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL                 -- written at most once per day per session
) WITHOUT ROWID;
CREATE INDEX idx_sessions_account ON sessions(account_id);

CREATE TABLE events (
  id         TEXT PRIMARY KEY,                  -- uuid generated by the client
  owner_id   TEXT NOT NULL,
  rev        INTEGER NOT NULL,
  doc        TEXT NOT NULL,                     -- JSON, shared + owner-only fields, <= 16384 bytes
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER                            -- tombstone: links answer 410 until purge
);
CREATE INDEX idx_events_owner ON events(owner_id) WHERE deleted_at IS NULL;

CREATE TABLE revisions (
  event_id      TEXT NOT NULL,
  rev           INTEGER NOT NULL,
  author_id     TEXT,                           -- NULL once the author deleted their account
  created_at    INTEGER NOT NULL,
  patch         TEXT NOT NULL,                  -- new values of the changed top-level fields
  inverse       TEXT NOT NULL,                  -- old values of the same fields
  overwrote     TEXT,                           -- JSON array: fields that replaced a newer change by someone else
  restored_from INTEGER,
  PRIMARY KEY (event_id, rev)
) WITHOUT ROWID;

CREATE TABLE links (
  id         TEXT PRIMARY KEY,
  token      TEXT NOT NULL UNIQUE,              -- 22 chars base64url, stored in clear (design D10)
  event_id   TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('public','people')),
  label      TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  revoked_at INTEGER
);
CREATE INDEX idx_links_event ON links(event_id);
CREATE UNIQUE INDEX idx_links_one_people ON links(event_id) WHERE kind = 'people' AND revoked_at IS NULL;

CREATE TABLE grants (
  event_id   TEXT NOT NULL,
  account_id TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('viewer','editor')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, account_id)
) WITHOUT ROWID;
CREATE INDEX idx_grants_account ON grants(account_id);

CREATE TABLE invites (
  id          TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,             -- SHA-256 hex of the invite token
  event_id    TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('viewer','editor')),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,                 -- created_at + 7 days
  accepted_by TEXT,
  accepted_at INTEGER,
  revoked_at  INTEGER
);
CREATE INDEX idx_invites_event ON invites(event_id);

CREATE TABLE media (
  id           TEXT PRIMARY KEY,                -- 22 chars base64url; blob key m/{id}.{ext}
  owner_id     TEXT NOT NULL,                   -- the event owner, charged for storage
  event_id     TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('still','animated','poster')),
  content_type TEXT NOT NULL,
  bytes        INTEGER NOT NULL,
  width        INTEGER NOT NULL,
  height       INTEGER NOT NULL,
  duration_ms  INTEGER,
  created_at   INTEGER NOT NULL,
  unused_since INTEGER                          -- set when no event references it; purged 24 h later
);
CREATE INDEX idx_media_unused ON media(unused_since) WHERE unused_since IS NOT NULL;

CREATE TABLE rate_counters (
  key          TEXT NOT NULL,                   -- e.g. 'anon:ip:<hash>', 'write:acct:<id>'
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
) WITHOUT ROWID;
```

### 6.2 Firestore mapping (`FirestoreStore`)

| SQL table | Firestore |
| :--- | :--- |
| `accounts` | `accounts/{id}` |
| `identities` | `identities/{provider}:{subject}` |
| `sessions` | `sessions/{tokenHash}` |
| `events` | `events/{id}` with `ownerId`, `rev`, `doc`, `deletedAt` |
| `revisions` | `events/{id}/revisions/{rev zero-padded to 10 digits}` |
| `links` | `links/{token}` with `eventId`, `kind` (query by `eventId`) |
| `grants` | `grants/{eventId}_{accountId}` (query by `accountId` or `eventId`) |
| `invites` | `invites/{tokenHash}` |
| `media` | `media/{id}` |
| `rate_counters` | `counters/{key}_{windowStart}` with `FieldValue.increment` |

Patch, accept invite and quota checks run in Firestore transactions.

---

## 7. API contract

### 7.1 Conventions

- Base URL `https://<domain>/api/v1`. JSON, UTF-8. Timestamps are ISO-8601 UTC strings (`2026-10-12T15:04:05Z`).
- Requests are validated strictly: unknown fields give `400 invalid_payload`. Clients ignore unknown fields in responses.
- JSON bodies at most 64 KB. Media uploads at most 4,194,304 bytes.
- App auth: `Authorization: Bearer st_<43 chars>`. Web auth: cookie `__Host-dtm_session`. Unsafe methods with the cookie also need `Origin: https://<domain>` and `X-DTM-CSRF: 1`.
- No CORS headers on any route. Every response has `X-Request-Id`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
- Error body: `{"error": {"code": "invalid_payload", "message": "title: too long", "details": {"field": "title"}}}`.

### 7.2 Event document

```json
{
  "id": "0b8f3c1e-6d0a-4a51-9f61-2f1b3f6d9a10",
  "rev": 9,
  "role": "owner",
  "title": "Our wedding",
  "emoji": "💍",
  "targetDate": "2027-06-12",
  "targetTime": "16:30:00",
  "timeZone": "Europe/Paris",
  "unitMode": "auto",
  "recurrence": {"type": "yearly", "originalYear": 2027, "days": null},
  "theme": {"paletteId": "violet", "cardStyle": "glass", "typography": "modern", "gradient": ["#8B5CF6", "#3B82F6"]},
  "backdrop": {
    "kind": "animated", "mediaId": "Hq3...", "posterId": "Pz8...", "dim": 0.3,
    "url": "https://media.<domain>/m/Hq3....mp4", "posterUrl": "https://media.<domain>/m/Pz8....jpg"
  },
  "notes": "Book the photographer",
  "pinned": true,
  "categoryId": "anniversaries",
  "updatedAt": "2026-10-12T15:04:05Z"
}
```

- Shared fields: `title`, `emoji`, `targetDate`, `targetTime`, `timeZone`, `unitMode`, `recurrence`, `theme`, `backdrop`.
- Owner-only fields: `notes`, `pinned`, `categoryId`. Present only in the owner's projection.
- Field rules (title 1 to 100 characters, emoji one grapheme, dates 1900 to 2200, IANA zone or null for floating time, colours `#RRGGBB`, ids `^[a-z0-9_-]{1,32}$`) come from `:core:model` and match the old share payload v1 rules, plus `notes` at most 4,000 characters and `backdrop.dim` 0 to 0.8.
- `backdrop.url` and `posterUrl` are set by the server and ignored in writes.
- `theme` and `backdrop` together carry the app's `EventCustomization` ([customization spec](../features/customization/SPEC.md)). Customization fields the web page cannot render yet (preset wallpapers, text colour override, gradient angle) are added to `theme` as optional fields when the page supports them; additive fields do not change the API version.

### 7.3 Endpoints

| Method | Path | Who | Purpose |
| :--- | :--- | :--- | :--- |
| GET | `/health` | anyone | `{"status":"ok","version":"…","live":"ws"}` |
| POST | `/auth/anonymous` | anyone (rate limited) | `{installSecret}`: create or resume an anonymous account, returns a session |
| POST | `/auth/token` | anyone | `{provider, idToken, nonce}`: exchange a Google or Apple ID token for a session. With a current anonymous session, upgrades or merges it |
| POST | `/auth/signout` | session | ends this session |
| GET, PATCH, DELETE | `/me` | session | account; change display name; delete account (full accounts) |
| GET | `/events` | session | manifest `[{id, rev, role}]`, ETag |
| POST | `/events/fetch` | session | `{ids}` (at most 100): documents projected by role |
| GET | `/events/{id}` | any role | one document, ETag |
| PUT | `/events/{id}` | session | create; repeating with the same owner returns the current document |
| PATCH | `/events/{id}` | owner, editor | `{baseRev, patch}` → `{event, overwritten}` |
| DELETE | `/events/{id}` | owner | delete the event, its links, invites, grants and media |
| GET | `/events/{id}/revisions?before=&limit=` | owner, editor | history page, newest first, at most 50 |
| POST | `/events/{id}/restore` | owner, editor | `{rev}`: new revision with that revision's shared fields |
| GET | `/events/{id}/sharing` | owner | links, people, pending invites |
| POST | `/events/{id}/links` | owner | `{kind, label, expiresInDays}` → link with `url` |
| PATCH, DELETE | `/links/{linkId}` | owner | change label or expiry; revoke |
| POST | `/events/{id}/invites` | owner (full account) | `{role}` → `{inviteId, url}`; the URL is returned only here |
| DELETE | `/invites/{inviteId}` | owner | cancel an unused invite |
| POST | `/invites/{token}/accept` | session (full account) | grants the role, returns `{eventId, url}` of the people link |
| PUT | `/events/{id}/people/{accountId}` | owner | `{role}` |
| DELETE | `/events/{id}/people/{accountId}` | owner, or the person (`me`) | remove or leave |
| GET | `/links/{token}` | anyone (public), session with access (people) | link view, ETag |
| POST | `/events/{id}/media` | owner, editor | raw body, `Content-Type`, `X-Media-Kind: still|animated|poster` → `{mediaId, url}` |
| GET | `/live?event={id}` or `/live?link={token}` | as for reads | WebSocket upgrade, `ws` mode only |
| POST | `/internal/purge` | `CRON_SECRET` (vercel only) | runs the purge job |

Page routes (HTML): `GET /e/{token}`, `GET /i/{token}`, `GET /auth/{google|apple}/start?return=`, `GET|POST /auth/{google|apple}/callback`, `POST /auth/signout`. Self-host only: `GET /m/{file}`.

### 7.4 Selected bodies

Patch:
```json
{"baseRev": 9, "patch": {"title": "Our wedding day", "backdrop": null}}
```
```json
{"event": {"...": "document at rev 10"}, "overwritten": ["targetTime"]}
```

Link view (`GET /links/{token}`):
```json
{
  "kind": "people",
  "role": "editor",
  "event": {"id": "0b8f…", "rev": 10, "title": "…", "...": "shared fields only"},
  "people": [{"name": "Derek", "role": "owner"}, {"name": "Mum", "role": "editor"}],
  "serverTime": "2026-10-12T15:09:00Z",
  "live": {"mode": "ws", "url": "wss://<domain>/api/v1/live?link=…"}
}
```
Public links omit `event.id` and `people`.

Revision:
```json
{"rev": 10, "author": {"name": "Mum"}, "at": "2026-10-12T15:04:05Z",
 "changes": [{"field": "title", "from": "Our wedding", "to": "Our wedding day"}],
 "overwrote": [], "restoredFrom": null}
```

### 7.5 Error codes

| HTTP | `code` | Meaning |
| :--- | :--- | :--- |
| 400 | `invalid_payload` | Validation failed. `details.field` names the field |
| 401 | `unauthorized` | No session, expired session or bad ID token |
| 401 | `sign_in_required` | People link or invite without a session |
| 403 | `forbidden` | Role too low, or no access to the event |
| 403 | `field_not_allowed` | Non-owner wrote an owner-only field |
| 404 | `not_found` | Unknown, malformed or purged id or token. Identical for all of these |
| 409 | `conflict` | Event id already used by another account |
| 410 | `revoked`, `expired`, `deleted` | Link revoked or expired, event deleted |
| 410 | `invite_used`, `invite_expired` | Invite already accepted or past 7 days |
| 413 | `payload_too_large` | Body or file over its limit |
| 415 | `unsupported_media_type` | Wrong content type, or file content does not match |
| 429 | `rate_limited` | Too many requests, `Retry-After` set |
| 429 | `quota_exceeded` | Count or storage quota reached |
| 500 | `internal_error` | `details.requestId` set |
| 503 | `service_unavailable` | Maintenance mode or provider limit reached |

---

## 8. Accounts and sessions

- **Install secret** (anonymous): 32 random bytes generated by the app, base64url, kept in Keychain or EncryptedSharedPreferences. Stored as SHA-256. Losing it means losing the anonymous account.
- **ID token sign-in** (app): Google via Credential Manager (Android) and Google Sign-In (iOS); Apple via AuthenticationServices (iOS) and an in-app browser tab (Android). The app sends the ID token and its nonce. The core checks signature (JWKS cached per instance), `iss`, `aud` (configured client ids), `exp` and `nonce`.
- **Web sign-in**: `/auth/{provider}/start` sets a 10 minute `__Host-dtm_oauth` cookie (state, PKCE verifier, nonce, return path; `SameSite=None` because Apple returns with a cross-site form POST) and redirects. The callback exchanges the code server to server (Apple's client secret is an ES256 JWT signed by the core), creates the session, sets `__Host-dtm_session` (`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=7776000`) and redirects to the return path (must start with `/e/` or `/i/`).
- **Sessions**: `st_` + 43 chars base64url (256 bits), stored as SHA-256. Valid until 90 days after last use.
- **Upgrade**: `POST /auth/token` with an anonymous session attaches the identity to that account and sets `kind = 'full'`. If the identity already belongs to an account, the anonymous account's events, links, invites and media move to it in one transaction and the anonymous account is deleted.
- **Deletion**: deletes owned events (with revisions, links, invites, grants, media), the account's grants, identities and sessions. Revisions they authored on other events keep `author_id = NULL`.

---

## 9. Live updates

- Messages: `{"type":"rev","rev":13}` after an accepted write or restore; `{"type":"access"}` after a link is revoked or changed, a grant changes, or the event is deleted. Clients react by refetching (`GET /links/{token}` or `GET /events/{id}`) with `If-None-Match`.
- `ws` mode: the client opens `wss://<domain>/api/v1/live?link=…` (or `?event=…` with a session). The core authorizes like a read, then returns `LiveUpgrade`. Cloudflare forwards the request to `EventRoom` (`idFromName(eventId)`), which accepts the socket with the Hibernation API and broadcasts published messages. Self-host keeps a map of event id to sockets. The client reconnects with backoff (1, 2, 5, 10, 30 seconds) and refetches after each reconnect.
- `poll` mode: conditional GET every 20 seconds while the page or screen is visible; every 60 seconds after 10 minutes without changes; none while hidden; one immediate GET on becoming visible.

---

## 10. Backdrop media

| Kind | Types accepted | Limits |
| :--- | :--- | :--- |
| still | JPEG, WebP | 1.5 MB, long edge 2560 px (clients target 2048 px) |
| animated | MP4 (H.264, no audio track), GIF, animated WebP | 4 MB, 10 s, long edge 1280 px |
| poster | JPEG, WebP | 300 KB, long edge 1280 px |

Client side:
- Android: decode with `ImageDecoder`, scale, encode WebP (quality 80, lower in steps until under the limit). Video and GIF-to-poster through Media3 Transformer and `ImageDecoder`.
- iOS: ImageIO thumbnail to 2048 px, JPEG quality 0.82, lower in steps. Video and Live Photo motion through `AVAssetExportSession` (1280 px preset, audio removed, trimmed to the chosen 10 seconds).
- Web editor: canvas, `toBlob('image/webp')` with JPEG fallback. GIF and animated WebP pass through when at most 4 MB; the poster is the first frame drawn on a canvas.

Server side (core, no decoding):
1. Check size against the kind's limit before reading the whole body when `Content-Length` is present.
2. Identify the type from magic bytes and compare with `Content-Type`.
3. Read dimensions (JPEG SOF, WebP VP8/VP8L/VP8X, GIF screen descriptor, MP4 `tkhd`) and duration (`mvhd`). Reject MP4 with a sound track or a `©xyz` location atom.
4. Remove JPEG APP1 to APP15 segments except ICC, and WebP `EXIF` and `XMP ` chunks.
5. `BlobStore.put("m/{id}.{ext}")`, add bytes to the owner's `media_bytes`, insert the `media` row with `unused_since = now` until an event references it.

Serving: `Cache-Control: public, max-age=86400`, `X-Content-Type-Options: nosniff`. The purge deletes files with `unused_since` older than 24 hours. Display: `<video autoplay muted loop playsinline poster>` for MP4, `<img>` for the rest, poster only under `prefers-reduced-motion` or `Save-Data`.

---

## 11. Limits and quotas

Defaults, the same on every provider (overridable only for tests).

| Limit | Value |
| :--- | :--- |
| Title | 1 to 100 characters |
| Notes | 4,000 characters |
| Event document | 16 KB |
| Events owned per account | 500 |
| Active public links per event | 10 |
| People link per event | 1 |
| People with access per event | 50 |
| Pending invites per event | 20 |
| Invite lifetime | 7 days |
| Session lifetime | 90 days after last use |
| Revisions kept | latest 200 per event |
| Backdrop files | section 10 |
| Backdrop storage | 100 MB per owner account |
| Uploads | 20 per hour per account |
| Writes (PATCH, PUT, restore) | 60 per minute per account |
| Anonymous accounts | 10 per hour per IP |
| Sign-in attempts | 30 per hour per IP |
| Live polling | 20 s visible, 60 s after 10 min idle, none hidden |

Per-IP counters use `SHA-256(ip + ":" + yyyymmdd + ":" + RATE_SALT)`. Raw IPs are never stored or logged. The core refuses to start without `RATE_SALT`.

---

## 12. Free tier budget and plan requirements

Cloudflare Workers Free (numbers from Cloudflare docs, to re-check in task 5.4):

| Resource | Limit | Use |
| :--- | :--- | :--- |
| Worker requests | 100,000 per day | Page view: 1 page + 1 WebSocket upgrade + 1 refetch per change. Static assets are not Worker requests. |
| Worker CPU | 10 ms per request | Hashing, JSON, validation, templating, byte scanning of uploads. No image decoding. |
| D1 rows written | 100,000 per day | A patch writes about 5 rows (event, revision, counters). |
| D1 storage | 500 MB per database | Event documents at most 16 KB; revisions store only changed fields. |
| Durable Objects | 100,000 requests and 13,000 GB-s per day, SQLite-backed only | Publishes and WebSocket messages count as requests. Hibernation keeps idle sockets free of duration. |
| R2 | 10 GB storage, 1 million writes and 10 million reads per month, no egress fee | Backdrops. Reads are cached at the edge for 1 day. |

Planning ceiling: about 30,000 page views per day. Past that, Workers Paid (5 USD per month).

Other providers: self-host costs the server only. Vercel Hobby forbids commercial use. Firebase Functions need Blaze.

---

## 13. Spike results

To be filled by tasks 1.1 and 1.2: bundle size (gzip), cold start wall time, warm request CPU on Workers; start time and memory on Node; the go or fallback decision.

---

## 14. Security, testing and operations

Security:
- Tokens: link `[A-Za-z0-9_-]{22}` (128 bits, clear text, design D10); invite same format, stored hashed; session `st_` + 43 chars, stored hashed; install secret 43 chars, stored hashed. Token format is checked before any store access.
- Page headers: `Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: https://media.<domain>; media-src https://media.<domain>; font-src 'self'; connect-src 'self' wss://<domain>; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests`, plus `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Strict-Transport-Security: max-age=31536000`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- HTML escaping and the JSON data blob rules are unchanged from `services/share/` (`SHARE_SERVICE.md` section 7.1).
- Logs: one JSON line per request with `ts`, `route`, `status`, `reqId`, `rateLimited`. Never bodies, titles, tokens, cookies, `Authorization`, IPs or install secrets.

Testing (details in [`TESTING_STRATEGY.md`](../standards/TESTING_STRATEGY.md)):
- `:core:model` and `:server:core` unit tests on JVM.
- Store conformance suite against each `Store` (SQLite on JVM and JS, Firestore emulator).
- HTTP conformance suite in `server/conformance/` against each adapter: `wrangler dev`, the self-host container, the Vercel handler on Node with a libSQL file, the Firebase emulators.
- Countdown vectors generated from `:core:model`; `countdown.js` must pass them.

Operations:
- Maintenance: `MAINTENANCE=1` makes writes return `503`; reads keep working.
- Takedown: revoke the reported link and delete the event's media files with the provider's own tools (an SQL statement for D1, SQLite and Turso; the console for Firestore and the blob store). The runbook in each adapter's README holds the exact commands. An admin API is not planned.
- Purge (daily): media unused for 24 hours; links revoked or expired more than 30 days ago; event tombstones older than 30 days with their revisions; sessions unused for 90 days; invites expired more than 30 days ago; rate counters older than 2 days. Bounded batches of 500 rows.
- Backups: D1 Time Travel (7 days on Free); self-host copies the volume; Turso and Firestore use their own point-in-time recovery.
- CI: one workflow `backend.yml` (see [`WORKFLOW_PIPELINE.md`](../ci-cd/WORKFLOW_PIPELINE.md) section 4).

---

## 15. Owner inputs

Needed before production:
- Domain on a Cloudflare zone, plus `media.<domain>` for R2.
- Apple: Team ID, bundle id, App Store id, a Services ID for web sign-in, a Sign in with Apple private key.
- Google: OAuth client ids for Android, iOS and web, and the web client secret.
- Android package name and signing key fingerprints for `assetlinks.json`.
- Abuse contact address, privacy policy owner and jurisdiction.
- For other providers when used: Turso database and Vercel Blob store; a Firebase project on Blaze.
