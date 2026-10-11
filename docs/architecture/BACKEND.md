# Backend Architecture & API Contract

Status: design, not implemented. Behavior requirements: OpenSpec change [`pluggable-backend-live-sharing`](../../openspec/changes/pluggable-backend-live-sharing/) (specs in its `specs/` folder). Decisions and alternatives: its [`design.md`](../../openspec/changes/pluggable-backend-live-sharing/design.md). Work order: its [`tasks.md`](../../openspec/changes/pluggable-backend-live-sharing/tasks.md).

This document replaces [`SHARE_SERVICE.md`](SHARE_SERVICE.md), which describes the frozen TypeScript service in `services/share/`.

---

## 1. Summary

- One backend for accounts, sync (events, memos, later comments), sharing, history, backdrops, audio and plans.
- `backend/core/` holds all behavior. Each provider is a variant in its own directory: **cloudflare** (primary), **selfhost**, **vercel**, **firebase**.
- Core language: Kotlin/JS or TypeScript, whichever wins the spike on CPU time, startup and bundle size (design D1, results in section 13). Either way the rules come from `:core:model`, the Kotlin module the app uses.
- No web framework beyond a tiny router, no ORM, no server-side media processing.

---

## 2. Architecture

```
  Android / iOS app (KMP)              Browser (share pages)
  Ktor client, :core:model             HTML + countdown.js, live.js, editor.js
        |  /api/v1/*  (Bearer)                |  /e, /i, /auth, /api/v1 (cookie)
        v                                     v
 +---------------------------------------------------------------------+
 | Variant entry (backend/<provider>/): converts the platform request,  |
 | wires ports, cron and WebSockets                                     |
 +---------------------------------------------------------------------+
 | backend/core: router, auth, sync, sharing, history, media checks,    |
 | plans, audio, pages, rate limits, purge         rules from :core:model|
 |                                                                      |
 |   ports:  Store        BlobStore        LiveHub      Clock/Random    |
 +-----------|---------------|----------------|-------------------------+
             v               v                v
   SqlStore + SqlDriver   R2 / disk /     Durable Object / in-process
   (D1, node:sqlite,      Vercel Blob /   hub (ws) or no-op (poll)
    libSQL) or            Cloud Storage
   FirestoreStore
```

Rules:
- The core never imports a vendor SDK. A variant directory contains only port implementations, an entry file and deploy config. Any behavior belongs in the core.
- The core speaks its own request and response types (method, path, query, headers, body, client IP). A `LiveUpgrade(eventId, subscriber)` response tells the variant to open a WebSocket.
- Outbound calls from the core (Google and Apple keys, RevenueCat) use the platform `fetch`, available on every variant.

---

## 3. Directories

```
core/model/                 Kotlin Multiplatform (android, iosArm64, iosSimulatorArm64, jvm, js): EventDoc, Memo,
                            field sets, roles, validation, patch/merge, projections, plan table, countdown engine, API types
backend/
  core/                     all backend behavior
    src/                    router, handlers, ports, SqlStore, page rendering, plans, audio
    migrations/             SQLite migrations, shared by D1, self-host and Turso
    web/                    share page assets: share.css, countdown.js, live.js, editor.js, fonts, og/, .well-known/, test vectors
    audio/catalog.json      built-in track list
    contract/               generated from :core:model; only when the core is TypeScript (task 2.8)
    conformance/            black-box HTTP suite every variant must pass
  cloudflare/               Worker entry, D1 driver, R2 store, EventRoom Durable Object, wrangler.jsonc
  selfhost/                 Node entry, node:sqlite driver, disk store, WebSocket hub, Dockerfile, compose.yaml
  vercel/                   handler entry, libSQL driver, Vercel Blob store, vercel.json
  firebase/                 function entry, FirestoreStore, Cloud Storage store, firebase.json, firestore.rules, storage.rules
```

With Kotlin, `backend/*` are Gradle modules (`:backend:core`, `:backend:cloudflare`, ...) built to JS, each variant bundling only its own vendor code. With TypeScript, they are npm workspaces.

---

## 4. Ports

Shown in Kotlin; the TypeScript version has the same shape.

```kotlin
interface Store {                       // use-case level; one call = one transaction
    suspend fun applyPatch(eventId: String, author: String, baseRev: Int, patch: JsonObject, now: Long): PatchResult
    suspend fun manifest(accountId: String): List<ManifestEntry>
    suspend fun acceptInvite(tokenHash: String, accountId: String, now: Long): AcceptResult
    // ... about 40 operations: accounts, identities, sessions, events, revisions, memos,
    //     links, grants, invites, media, plans, rate counters, purge
}

interface SqlDriver {                   // the only persistence code SQL variants write
    suspend fun query(sql: String, args: List<Any?>): List<Map<String, Any?>>
    suspend fun batch(statements: List<Statement>): List<Int>   // atomic
}

interface BlobStore {
    suspend fun put(key: String, bytes: ByteArray, contentType: String)
    suspend fun get(key: String): BlobStream?                    // for access-checked audio
    suspend fun delete(keys: List<String>)
    fun publicUrl(key: String): String
}

interface LiveHub {
    val mode: LiveMode                  // Ws or Poll
    suspend fun publish(eventId: String, message: LiveMessage)   // no-op in Poll mode
}
```

`Clock`, `Random` and `Config` (origin, media origin, OAuth client ids and secrets, RevenueCat key, maintenance flag) are injected. Every `Store` must pass the store conformance suite.

---

## 5. Provider variants

| | cloudflare | selfhost | vercel | firebase |
| :--- | :--- | :--- | :--- | :--- |
| Runtime | Workers | Node 24 LTS or newer, Docker | Vercel Functions (Node) | Cloud Functions 2nd gen (Node) |
| Store | D1 via `SqlStore` | SQLite file via `node:sqlite` (WAL) | Turso (libSQL over HTTP) via `SqlStore` | Firestore via `FirestoreStore` |
| Blobs | R2, public on `media.<domain>` | directory on the volume, served at `/m/` | Vercel Blob (public) | Cloud Storage bucket |
| Live mode | `ws`: Durable Object `EventRoom` per event, Hibernation API | `ws`: in-process hub | `poll` | `poll` |
| Purge and plan re-check | Cron Trigger `0 3 * * *` | timer in the process | Vercel Cron calling `/api/v1/internal/purge` with `CRON_SECRET` | `onSchedule` |
| Static files | Static Assets, `run_worker_first: ["/e/*","/i/*","/auth/*","/api/*"]` | served by the Node entry | `public/` + rewrites | Firebase Hosting + rewrites to the function |
| Plan needed | Workers Free | your server | Hobby is non-commercial only; Pro for a commercial app | Blaze (pay as you go) |
| Platform body limit | 100 MB | none | 4.5 MB | 32 MB |

Notes:
- Durable Objects on the Free plan must be SQLite-backed, so `EventRoom` is declared with a `new_sqlite_classes` migration even though it stores nothing.
- Self-host can put media on a separate host through its reverse proxy (`MEDIA_ORIGIN`). On the same origin, `/m/` responses carry `Content-Security-Policy: sandbox` and `X-Content-Type-Options: nosniff`.
- Firebase rules deny all client access to Firestore and Storage. Only the function reads and writes.
- Moving between SQL-family variants: SQLite dump and import plus a copy of the blob files. Moving to or from Firestore needs an export tool, built when first needed.

---

## 6. Data model

### 6.1 SQL (SQLite dialect), `backend/core/migrations/0001_init.sql`

Times are unix seconds UTC. No foreign key constraints; the core keeps references consistent.

```sql
CREATE TABLE accounts (
  id              TEXT PRIMARY KEY,             -- uuid
  display_name    TEXT NOT NULL,
  plan            TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','premium','premium_plus')),
  plan_expires_at INTEGER,                      -- NULL for free; plan counts as free once passed
  plan_checked_at INTEGER,
  media_bytes     INTEGER NOT NULL DEFAULT 0,   -- backdrop storage used, for the quota
  created_at      INTEGER NOT NULL
);
CREATE INDEX idx_accounts_plan_expiry ON accounts(plan_expires_at) WHERE plan <> 'free';

CREATE TABLE identities (
  provider   TEXT NOT NULL CHECK (provider IN ('google','apple')),
  subject    TEXT NOT NULL,                     -- OIDC 'sub'
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
  id               TEXT PRIMARY KEY,            -- uuid generated by the client
  owner_id         TEXT NOT NULL,
  rev              INTEGER NOT NULL,
  doc              TEXT NOT NULL,               -- JSON, shared + owner-only fields, <= 16384 bytes
  audio_kind       TEXT,                        -- 'library' | 'spotify' | NULL, for the Spotify limit
  child_seq        INTEGER NOT NULL DEFAULT 0,  -- bumped by every memo (later comment) write
  child_purged_seq INTEGER NOT NULL DEFAULT 0,  -- highest seq of purged child tombstones
  updated_at       INTEGER NOT NULL,
  deleted_at       INTEGER                      -- tombstone: links answer 410 until purge
);
CREATE INDEX idx_events_owner ON events(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_spotify ON events(owner_id) WHERE audio_kind = 'spotify' AND deleted_at IS NULL;

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

CREATE TABLE memos (
  id         TEXT PRIMARY KEY,                  -- uuid generated by the client
  event_id   TEXT NOT NULL,
  author_id  TEXT NOT NULL,
  seq        INTEGER NOT NULL,                  -- events.child_seq at the last write
  doc        TEXT NOT NULL,                     -- JSON: content, milestoneTag, createdAt; '{}' once deleted
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER                            -- tombstone kept 30 days
);
CREATE INDEX idx_memos_event_seq ON memos(event_id, seq);

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
  expires_at  INTEGER NOT NULL,                 -- created_at + 30 days, for unused invites
  accepted_by TEXT,                             -- set when linked; this consumes the invite
  accepted_at INTEGER,
  revoked_at  INTEGER                           -- cancelled by the owner
);
CREATE INDEX idx_invites_event ON invites(event_id);

CREATE TABLE media (
  id           TEXT PRIMARY KEY,                -- 22 chars base64url; blob key m/{id}.{ext}
  owner_id     TEXT NOT NULL,                   -- the event owner, charged for storage
  event_id     TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('still','motion')),
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
  key          TEXT NOT NULL,                   -- e.g. 'signin:ip:<hash>', 'write:acct:<id>'
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
) WITHOUT ROWID;
```

Comments (later phase) get a `comments` table shaped like `memos`, using the same `child_seq`.

### 6.2 Firestore mapping (`FirestoreStore`)

| SQL table | Firestore |
| :--- | :--- |
| `accounts` | `accounts/{id}` |
| `identities` | `identities/{provider}:{subject}` |
| `sessions` | `sessions/{tokenHash}` |
| `events` | `events/{id}` with `ownerId`, `rev`, `doc`, `audioKind`, `childSeq`, `childPurgedSeq`, `deletedAt` |
| `revisions` | `events/{id}/revisions/{rev zero-padded to 10 digits}` |
| `memos` | `events/{id}/memos/{memoId}` (query by `seq`) |
| `links` | `links/{token}` with `eventId`, `kind` (query by `eventId`) |
| `grants` | `grants/{eventId}_{accountId}` (query by `accountId` or `eventId`) |
| `invites` | `invites/{tokenHash}` |
| `media` | `media/{id}` |
| `rate_counters` | `counters/{key}_{windowStart}` with `FieldValue.increment` |

Patch, memo writes (which bump `childSeq`), invite accept and quota checks run in Firestore transactions.

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
    "kind": "animated", "stillId": "Pz8...", "motionId": "Hq3...", "dim": 0.3,
    "stillUrl": "https://media.<domain>/m/Pz8....jpg", "motionUrl": "https://media.<domain>/m/Hq3....mp4"
  },
  "audio": {"kind": "spotify", "url": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", "title": "Today's Top Hits", "artist": "Spotify"},
  "notes": "Book the photographer",
  "pinned": true,
  "categoryId": "anniversaries",
  "updatedAt": "2026-10-12T15:04:05Z"
}
```

- Shared fields: `title`, `emoji`, `targetDate`, `targetTime`, `timeZone`, `unitMode`, `recurrence`, `theme`, `backdrop`, `audio`.
- Owner-only fields: `notes`, `pinned`, `categoryId`. Present only in the owner's projection. Memos are owner-only too.
- `backdrop.kind` is `still` (only `stillId`) or `animated` (`stillId` is the key photo, `motionId` the MP4). `*Url` fields are set by the server and ignored in writes.
- `audio` is `{"kind":"library","trackId":"calm-lofi"}` or `{"kind":"spotify","url","title","artist"}`. Spotify URLs must be `https://open.spotify.com/` track, album or playlist URLs (an `intl-xx/` segment is allowed, the query is dropped). Title and artist come from the app (Spotify oEmbed) and are at most 200 characters.
- Field rules (title 1 to 100 characters, emoji one grapheme, dates 1900 to 2200, IANA zone or null, colours `#RRGGBB`, ids `^[a-z0-9_-]{1,32}$`, notes at most 4,000 characters, `backdrop.dim` 0 to 0.8) come from `:core:model`.
- `theme` and `backdrop` together carry the app's `EventCustomization` ([customization spec](../features/customization/SPEC.md)). Customization fields the web page cannot render yet (preset wallpapers, text colour override, gradient angle) are added to `theme` as optional fields when the page supports them; additive fields do not change the API version.

Memo:
```json
{"id": "5c1f…", "eventId": "0b8f…", "seq": 41, "content": "Booked the venue today.", "milestoneTag": "Day 100", "createdAt": "…", "updatedAt": "…"}
```

### 7.3 Endpoints

| Method | Path | Who | Purpose |
| :--- | :--- | :--- | :--- |
| GET | `/health` | anyone | `{"status":"ok","version":"…","live":"ws"}` |
| POST | `/auth/token` | anyone (rate limited) | `{provider, idToken, nonce}`: sign in, creating the account on first use; returns a session |
| POST | `/auth/signout` | session | ends this session |
| GET, PATCH, DELETE | `/me` | session | account and plan; change display name; delete account |
| POST | `/me/plan/refresh` | session | re-reads the plan from RevenueCat, returns `{plan, expiresAt}` |
| GET | `/sync` | session | manifest `{"events":[{id, rev, role, childSeq}]}`, ETag |
| POST | `/events/fetch` | session | `{ids}` (at most 100): documents projected by role |
| GET | `/events/{id}` | any role | one document, ETag |
| PUT | `/events/{id}` | session | create; repeating with the same owner returns the current document |
| PATCH | `/events/{id}` | owner, editor | `{baseRev, patch}` → `{event, overwritten}` |
| DELETE | `/events/{id}` | owner | delete the event, its memos, links, invites, grants and media |
| GET | `/events/{id}/children?after=` | owner | `{memos, seq, reset}`: memos changed or deleted after `seq` |
| PUT, PATCH, DELETE | `/events/{id}/memos/{memoId}` | owner | create (idempotent), patch, delete a memo |
| GET | `/events/{id}/revisions?before=&limit=` | owner, editor | history page, newest first, at most 50 |
| POST | `/events/{id}/restore` | owner, editor | `{rev}`: new revision with that revision's shared fields |
| GET | `/events/{id}/sharing` | owner | links, people, pending invites |
| POST | `/events/{id}/links` | owner | `{kind, label, expiresInDays}` → link with `url` |
| PATCH, DELETE | `/links/{linkId}` | owner | change label or expiry; revoke |
| POST | `/events/{id}/invites` | owner | `{role}` → `{inviteId, url}`; the URL is returned only here |
| DELETE | `/invites/{inviteId}` | owner | cancel an unused invite |
| GET | `/invites/{token}` | session | `{state, eventTitle, ownerName, role}`; `state` is `open`, `used`, `expired`, `cancelled` or `member`. Consumes nothing |
| POST | `/invites/{token}/accept` | session | links the account, consumes the invite, returns `{eventId, url}`. For the owner or an existing member: returns the event and consumes nothing |
| PUT | `/events/{id}/people/{accountId}` | owner | `{role}` |
| DELETE | `/events/{id}/people/{accountId}` | owner, or the person (`me`) | remove or leave |
| GET | `/links/{token}` | anyone (public), session with access (people) | link view, ETag |
| POST | `/events/{id}/media` | owner, editor | raw body, `Content-Type`, `X-Media-Kind: still|motion` → `{mediaId, url}` |
| GET | `/audio/catalog` | anyone | built-in tracks, ETag, cacheable |
| GET | `/audio/{trackId}?event=` or `?link=` | see section 10.3 | the track file |
| GET | `/live?event={id}` or `/live?link={token}` | as for reads | WebSocket upgrade, `ws` mode only |
| POST | `/internal/purge` | `CRON_SECRET` (vercel only) | runs the purge and plan re-check jobs |

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

Children (`GET /events/{id}/children?after=38`):
```json
{"memos": [{"id": "5c1f…", "seq": 39, "deleted": false, "content": "…"}, {"id": "7a2e…", "seq": 41, "deleted": true}],
 "seq": 41, "reset": false}
```
`reset: true` means `after` is older than the purged tombstones; the client drops its memos for the event and applies the full list returned.

### 7.5 Error codes

| HTTP | `code` | Meaning |
| :--- | :--- | :--- |
| 400 | `invalid_payload` | Validation failed. `details.field` names the field |
| 401 | `unauthorized` | No session, expired session or bad ID token |
| 401 | `sign_in_required` | People link or invite without a session |
| 402 | `premium_required` | The event owner's plan does not include this. `details.feature` names it (`animated_backdrop`, `premium_audio`, `spotify_events`) |
| 403 | `forbidden` | Role too low, or no access to the event |
| 403 | `field_not_allowed` | Non-owner wrote an owner-only field |
| 404 | `not_found` | Unknown, malformed or purged id or token. Identical for all of these |
| 409 | `conflict` | Event or memo id already used by another account |
| 410 | `revoked`, `expired`, `deleted` | Link revoked or expired, event deleted |
| 410 | `invite_used`, `invite_expired`, `invite_cancelled` | Invite linked to someone else, past 30 days, or cancelled |
| 413 | `payload_too_large` | Body or file over its limit |
| 415 | `unsupported_media_type` | Wrong content type, or file content does not match |
| 429 | `rate_limited` | Too many requests, `Retry-After` set |
| 429 | `quota_exceeded` | Count or storage quota reached |
| 500 | `internal_error` | `details.requestId` set |
| 503 | `service_unavailable` | Maintenance mode or provider limit reached |

---

## 8. Accounts, sessions and plans

- **Sign-in** (app): Google via Credential Manager (Android) and Google Sign-In (iOS); Apple via AuthenticationServices (iOS) and an in-app browser tab (Android). The app sends the ID token and its nonce. The core checks signature (JWKS cached per instance), `iss`, `aud` (configured client ids), `exp` and `nonce`. An unknown identity creates the account.
- **Web sign-in**: `/auth/{provider}/start` sets a 10 minute `__Host-dtm_oauth` cookie (state, PKCE verifier, nonce, return path; `SameSite=None` because Apple returns with a cross-site form POST) and redirects. The callback exchanges the code server to server (Apple's client secret is an ES256 JWT signed by the core), creates the session, sets `__Host-dtm_session` (`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=7776000`) and redirects to the return path (must start with `/e/` or `/i/`).
- **Sessions**: `st_` + 43 chars base64url (256 bits), stored as SHA-256. Valid until 90 days after last use.
- **First sign-in on a device**: the app uploads local events (`PUT /events/{id}`) and memos. No server-side merge step is needed.
- **Deletion**: deletes owned events (with revisions, memos, links, invites, grants, media), the account's grants, identities and sessions. Revisions they authored on other events keep `author_id = NULL`. Store subscriptions are not cancelled by the backend; the app tells the user how.
- **Plans**: the app configures RevenueCat with `appUserID = accountId` after sign-in (a guest's purchase moves to the account with RevenueCat `logIn`). After a purchase or restore, and on launch when the cached plan has expired, the app calls `POST /me/plan/refresh`. The core calls `GET https://api.revenuecat.com/v1/subscribers/{accountId}` with the secret key, maps active entitlements `premium` and `premium_plus` to `plan` and `plan_expires_at`, and stores them. The daily job re-checks accounts whose `plan_expires_at` has passed, in batches of 100.
- **Gating**: on writes that add Premium content, the core loads the event owner's plan and checks the plan table from `:core:model` (feature list in [`docs/features/premium/SPEC.md`](../features/premium/SPEC.md)). Existing Premium content is never removed or blocked from display.

---

## 9. Live updates

- Messages: `{"type":"rev","rev":13}` after an accepted event write or restore; `{"type":"children","seq":41}` after a memo write (delivered to the owner's sockets only); `{"type":"access"}` after a link or grant change or event deletion. Clients refetch with `If-None-Match`.
- `ws` mode: the client opens `wss://<domain>/api/v1/live?link=…` (or `?event=…` with a session). The core authorizes like a read, then returns `LiveUpgrade`. Cloudflare forwards the request to `EventRoom` (`idFromName(eventId)`), which accepts the socket with the Hibernation API, tags it with the subscriber's role, and broadcasts published messages. Self-host keeps a map of event id to sockets. The client reconnects with backoff (1, 2, 5, 10, 30 seconds) and refetches after each reconnect.
- `poll` mode: conditional GET every 20 seconds while visible; every 60 seconds after 10 minutes without changes; none while hidden; one immediate GET on becoming visible.

---

## 10. Backdrops and audio

### 10.1 Backdrop files

| Part | Types accepted | Limits |
| :--- | :--- | :--- |
| still (also the key photo of an animated backdrop) | JPEG, WebP | 1.5 MB, long edge 2560 px (clients target 2048 px) |
| motion | MP4, H.264 video track only, no audio track | 4 MB, 5 s, long edge 1280 px |

Client side:
- Still: Android decodes with `ImageDecoder` and encodes WebP (quality 80, lower in steps); iOS uses an ImageIO thumbnail at 2048 px and JPEG quality 0.82, lower in steps; the web editor uses canvas `toBlob('image/webp')` with a JPEG fallback.
- iPhone Live Photo: `PHAssetResource` gives the key photo and the paired video (MOV, often HEVC, with sound). `AVAssetExportSession` with an H.264 1280 px preset and a composition without the audio track produces the motion part.
- Google Motion Photo: the XMP `Container:Directory` (or legacy `MicroVideoOffset`) gives the offset of the MP4 appended to the JPEG or HEIC file. The app cuts it out and runs Media3 Transformer (H.264, 1280 px, audio removed). Files without this metadata are treated as stills.

Server side (core, no decoding):
1. Check size against the part's limit before reading the whole body when `Content-Length` is present.
2. Identify the type from magic bytes and compare with `Content-Type`.
3. Read dimensions (JPEG SOF, WebP VP8/VP8L/VP8X, MP4 `tkhd`), duration (`mvhd`) and codec (`avc1` sample entry). Reject MP4 with a sound track or a `©xyz` location atom.
4. Remove JPEG APP1 to APP15 segments except ICC, and WebP `EXIF` and `XMP ` chunks.
5. For `motion`, check the event owner's plan (`animated_backdrop`).
6. `BlobStore.put("m/{id}.{ext}")`, add bytes to the owner's `media_bytes`, insert the `media` row with `unused_since = now` until an event references it.

Serving: `Cache-Control: public, max-age=86400`, `X-Content-Type-Options: nosniff`. The purge deletes files with `unused_since` older than 24 hours. Display: the still first; for animated, `<video muted playsinline poster=still>` plays once on load and on tap, then shows the still; under `prefers-reduced-motion` the video element is not created.

### 10.2 Audio catalog

`backend/core/audio/catalog.json`:
```json
{"tracks": [{"id": "calm-lofi", "title": "Calm Lo-Fi", "artist": "…", "durationSec": 184, "tier": "free", "bytes": 2950000}]}
```
Files are AAC (`.m4a`), at most 4 MB, stored in the blob store at `audio/{id}.m4a`, uploaded by the operator with the variant's deploy tooling. The catalog ships with the core, so changing it is a deploy, not an app release.

### 10.3 Audio file access (`GET /audio/{trackId}`)

- Free track: served to anyone, `Cache-Control: public, max-age=604800`.
- Premium track: served when the caller's account has a plan with `premium_audio`, or when `?event=` names an event the caller can read, or `?link=` names an active link, and that event's `audio.trackId` is this track. `Cache-Control: private, max-age=604800`. Otherwise `402 premium_required`.
- Served by streaming `BlobStore.get`, so it works on every variant. The app caches files, so each device downloads a track once.

---

## 11. Limits and quotas

Defaults, the same on every provider (overridable only for tests). Plan-dependent limits live in the plan table ([`docs/features/premium/SPEC.md`](../features/premium/SPEC.md)).

| Limit | Value |
| :--- | :--- |
| Title | 1 to 100 characters |
| Notes | 4,000 characters |
| Memo text | 10,000 characters |
| Event document | 16 KB |
| Events owned per account | 500 |
| Memos per event | 500 |
| Active public links per event | 10 |
| People link per event | 1 |
| People with access per event | 50 |
| Pending invites per event | 20 |
| Unused invite lifetime | 30 days |
| Session lifetime | 90 days after last use |
| Revisions kept | latest 200 per event |
| Child tombstones kept | 30 days |
| Backdrop files | section 10.1 |
| Backdrop storage | 100 MB per owner account |
| Uploads | 20 per hour per account |
| Audio track file | 4 MB |
| Spotify links (free plan) | 3 owned events |
| Writes (event and memo PUT, PATCH, DELETE, restore) | 120 per minute per account |
| Sign-in attempts | 30 per hour per IP |
| Plan refresh | 10 per hour per account |
| Live polling | 20 s visible, 60 s after 10 min idle, none hidden |

Per-IP counters use `SHA-256(ip + ":" + yyyymmdd + ":" + RATE_SALT)`. Raw IPs are never stored or logged. The core refuses to start without `RATE_SALT`.

---

## 12. Free tier budget and plan requirements

Cloudflare Workers Free (numbers from Cloudflare docs, to re-check in task 5.4):

| Resource | Limit | Use |
| :--- | :--- | :--- |
| Worker requests | 100,000 per day | Page view: 1 page + 1 WebSocket upgrade + 1 refetch per change. Sync: 1 request when idle (`304`). Audio: 1 per track per device. Static assets are not Worker requests. |
| Worker CPU | 10 ms per request | Hashing, JSON, validation, templating, byte scanning of uploads. No image decoding. |
| D1 rows written | 100,000 per day | An event patch writes about 5 rows (event, revision, counters); a memo write about 4. |
| D1 storage | 500 MB per database | Event documents at most 16 KB; revisions store only changed fields. |
| Durable Objects | 100,000 requests and 13,000 GB-s per day, SQLite-backed only | Publishes and WebSocket messages count as requests. Hibernation keeps idle sockets free of duration. |
| R2 | 10 GB storage, 1 million writes and 10 million reads per month, no egress fee | Backdrops and audio. Backdrop reads are cached at the edge for 1 day. |

Planning ceiling: about 30,000 page views per day. Past that, Workers Paid (5 USD per month).

Other costs: self-host is the server only. Vercel Hobby forbids commercial use. Firebase Functions need Blaze. RevenueCat is free up to 2,500 USD monthly tracked revenue, then 1%.

---

## 13. Spike results

To be filled by tasks 1.1 and 1.2.

| Build | Worker startup | Warm CPU p50 | Bundle (gzip) |
| :--- | :--- | :--- | :--- |
| TypeScript | | | |
| Kotlin/JS | | | |

Decision: (pending). Criteria: Kotlin/JS only if warm CPU ≤ 1.25 × TypeScript, startup ≤ 100 ms and bundle ≤ 1 MB gzip.

---

## 14. Security, testing and operations

Security:
- Tokens: link `[A-Za-z0-9_-]{22}` (128 bits, clear text, design D10); invite same format, stored hashed; session `st_` + 43 chars, stored hashed. Token format is checked before any store access.
- Page headers: `Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: https://media.<domain>; media-src 'self' https://media.<domain>; font-src 'self'; connect-src 'self' wss://<domain>; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; frame-src 'none'; object-src 'none'; upgrade-insecure-requests`, plus `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Strict-Transport-Security: max-age=31536000`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- HTML escaping and the JSON data blob rules are unchanged from `services/share/` (`SHARE_SERVICE.md` section 7.1).
- Logs: one JSON line per request with `ts`, `route`, `status`, `reqId`, `rateLimited`. Never bodies, titles, memo text, tokens, cookies, `Authorization`, IPs or Spotify URLs.

Testing (details in [`TESTING_STRATEGY.md`](../standards/TESTING_STRATEGY.md)):
- `:core:model` tests on every target; core unit tests.
- Store conformance suite against each `Store` (SQLite, Firestore emulator).
- HTTP conformance suite in `backend/core/conformance/` against each variant: `wrangler dev`, the self-host container, the Vercel handler on Node with a libSQL file, the Firebase emulators.
- Countdown vectors generated from `:core:model`; `countdown.js` must pass them. With a TypeScript core, also the generated contract checks (task 2.8).

Operations:
- Maintenance: `MAINTENANCE=1` makes writes return `503`; reads keep working.
- Takedown: revoke the reported link and delete the event's media files with the provider's own tools (an SQL statement for D1, SQLite and Turso; the console for Firestore and the blob store). Each variant's README holds the exact commands. An admin API is not planned.
- Daily job: plan re-check; media unused for 24 hours; links revoked or expired more than 30 days ago; event tombstones older than 30 days with their revisions and memos; memo tombstones older than 30 days (raising `child_purged_seq`); sessions unused for 90 days; invites expired or cancelled more than 30 days ago; rate counters older than 2 days. Bounded batches of 500 rows.
- Backups: D1 Time Travel (7 days on Free); self-host copies the volume; Turso and Firestore use their own point-in-time recovery.
- CI: one workflow `backend.yml` (see [`WORKFLOW_PIPELINE.md`](../ci-cd/WORKFLOW_PIPELINE.md) section 4).

---

## 15. Owner inputs

Needed before production:
- Domain on a Cloudflare zone, plus `media.<domain>` for R2.
- Apple: Team ID, bundle id, App Store id, a Services ID for web sign-in, a Sign in with Apple private key, subscription products.
- Google: OAuth client ids for Android, iOS and web, the web client secret, Play subscription products.
- RevenueCat project with entitlements `premium` (and `premium_plus` later) and its secret API key.
- Licensed audio tracks and the free and Premium split.
- Android package name and signing key fingerprints for `assetlinks.json`.
- Abuse contact address, privacy policy owner and jurisdiction.
- For other providers when used: Turso database and Vercel Blob store; a Firebase project on Blaze.
