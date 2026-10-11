# Backend Architecture & API Contract

Status: design, not implemented. Behavior requirements: OpenSpec change [`pluggable-backend-live-sharing`](../../openspec/changes/pluggable-backend-live-sharing/) (specs in its `specs/` folder). Decisions and alternatives: its [`design.md`](../../openspec/changes/pluggable-backend-live-sharing/design.md). Work order: its [`tasks.md`](../../openspec/changes/pluggable-backend-live-sharing/tasks.md). China: [`CHINA.md`](CHINA.md).

This document replaces [`SHARE_SERVICE.md`](SHARE_SERVICE.md), which describes the frozen TypeScript service in `services/share/`.

---

## 1. Summary

- One backend for accounts, sync (events, memos, later comments), sharing, history, backdrops, audio, plans and purchases.
- `backend/core/` holds all behavior. Each provider is a variant in its own directory: **cloudflare** (primary), **selfhost**, **vercel**, **firebase**.
- Core language: Kotlin/JS or TypeScript, whichever wins the spike on CPU time, startup and bundle size (design D1, results in section 13). Either way the rules come from `:core:model`, the Kotlin module the app uses.
- Purchases are verified with Apple and Google directly (no RevenueCat). Sign-in: Google, Apple, email codes, as plug-ins.
- A region is one deployment. The global region runs on Cloudflare; a China region would be a separate deployment (section 16).
- No web framework beyond a tiny router, no ORM, no server-side media processing.

---

## 2. Architecture

```
  Android / iOS app (KMP)              Browser (share pages)
  Ktor client, :core:model             HTML + countdown.js, live.js, editor.js
        |  /api/v1/*  (Bearer)                |  /e, /i, /s, /auth, /api/v1 (cookie)
        v                                     v
 +----------------------------------------------------------------------+
 | Variant entry (backend/<provider>/): converts the platform request,   |
 | wires ports, cron and WebSockets                                      |
 +----------------------------------------------------------------------+
 | backend/core: router, auth (identity plug-ins), sync, sharing,        |
 | history, media checks, plans, purchase verifiers, audio, pages, purge |
 |                                                rules from :core:model |
 |   ports:  Store     BlobStore     LiveHub     Mailer    Clock/Random  |
 +-----------|-------------|-------------|-----------|-------------------+
             v             v             v           v
   SqlStore + SqlDriver  R2 / disk /   Durable     HTTP mail API
   (D1, node:sqlite,     Vercel Blob / Object /    (default) or
    libSQL) or           Cloud Storage hub / poll  SMTP (self-host)
   FirestoreStore
```

Rules:
- The core never imports a vendor SDK. A variant directory contains only port implementations, an entry file and deploy config. Any behavior belongs in the core.
- The core speaks its own request and response types (method, path, query, headers, body, client IP). A `LiveUpgrade(eventId, subscriber)` response tells the variant to open a WebSocket.
- Integrations that do not depend on the host use the platform `fetch` from the core and are enabled by configuration: identity providers (Google, Apple, email), purchase verifiers (Apple, Google), the default HTTP mailer.

---

## 3. Directories

```
core/model/                 Kotlin Multiplatform (android, iosArm64, iosSimulatorArm64, jvm, js): EventDoc, Memo,
                            field sets, roles, validation, patch/merge, projections, plan table, countdown engine, API types
backend/
  core/                     all backend behavior
    src/                    router, handlers, ports, SqlStore, identity providers, purchase verifiers, pages, audio
    migrations/             SQLite migrations, shared by D1, self-host and Turso
    web/                    share page assets: share.css, countdown.js, live.js, editor.js, fonts, og/, .well-known/, test vectors
    audio/catalog.json      built-in track list
    contract/               generated from :core:model; only when the core is TypeScript (task 2.8)
    conformance/            black-box HTTP suite every variant must pass
  cloudflare/               Worker entry, D1 driver, R2 store, EventRoom Durable Object, wrangler.jsonc
  selfhost/                 Node entry, node:sqlite driver, disk store, WebSocket hub, SMTP mailer, Dockerfile, compose.yaml
  vercel/                   handler entry, libSQL driver, Vercel Blob store, vercel.json
  firebase/                 function entry, FirestoreStore, Cloud Storage store, firebase.json, firestore.rules, storage.rules
```

With Kotlin, `backend/*` are Gradle modules (`:backend:core`, `:backend:cloudflare`, ...) built to JS, each variant bundling only its own vendor code. With TypeScript, they are npm workspaces.

---

## 4. Ports and plug-ins

Shown in Kotlin; the TypeScript version has the same shape.

```kotlin
interface Store {                       // use-case level; one call = one transaction
    suspend fun applyPatch(eventId: String, author: String, baseRev: Int, patch: JsonObject, now: Long): PatchResult
    suspend fun manifest(accountId: String): List<ManifestEntry>
    suspend fun joinInvite(tokenHash: String, accountId: String, now: Long): JoinResult
    // ... about 45 operations: accounts, identities, email codes, sessions, events, revisions, memos,
    //     links, invites, members, media, purchases, rate counters, purge
}

interface SqlDriver {                   // the only persistence code SQL variants write
    suspend fun query(sql: String, args: List<Any?>): List<Map<String, Any?>>
    suspend fun batch(statements: List<Statement>): List<Int>   // atomic
}

interface BlobStore {
    suspend fun put(key: String, bytes: ByteArray, contentType: String)
    suspend fun get(key: String): BlobStream?                    // access-checked audio
    suspend fun delete(keys: List<String>)
    fun publicUrl(key: String): String
}

interface LiveHub {
    val mode: LiveMode                  // Ws or Poll
    suspend fun publish(eventId: String, message: LiveMessage)   // no-op in Poll mode
}

interface Mailer { suspend fun send(to: String, subject: String, text: String) }

// Core plug-ins, enabled per deployment in Config:
interface IdentityProvider {            // google, apple, email; later wechat, phone
    val id: String
    suspend fun verify(credential: JsonObject): VerifiedIdentity   // subject, email, emailVerified, name
}
interface PurchaseVerifier {            // apple, google; later Chinese Android stores
    val store: String
    suspend fun verify(proof: JsonObject): List<PurchaseRecord>    // product, original id, expiry, status
    suspend fun recheck(record: PurchaseRecord): PurchaseRecord
}
```

`Clock`, `Random` and `Config` (region, origin, media origin, enabled identity providers and stores, keys and secrets, maintenance flag) are injected. Every `Store` must pass the store conformance suite.

---

## 5. Provider variants

| | cloudflare | selfhost | vercel | firebase |
| :--- | :--- | :--- | :--- | :--- |
| Runtime | Workers | Node 24 LTS or newer, Docker | Vercel Functions (Node) | Cloud Functions 2nd gen (Node) |
| Store | D1 via `SqlStore` | SQLite file via `node:sqlite` (WAL) | Turso (libSQL over HTTP) via `SqlStore` | Firestore via `FirestoreStore` |
| Blobs | R2, public on `media.<domain>` | directory on the volume, served at `/m/` | Vercel Blob (public) | Cloud Storage bucket |
| Live mode | `ws`: Durable Object `EventRoom` per event, Hibernation API | `ws`: in-process hub | `poll` | `poll` |
| Mailer | HTTP mail API | SMTP or HTTP mail API | HTTP mail API | HTTP mail API |
| Daily job | Cron Trigger `0 3 * * *` | timer in the process | Vercel Cron calling `/api/v1/internal/daily` with `CRON_SECRET` | `onSchedule` |
| Static files | Static Assets, `run_worker_first: ["/e/*","/i/*","/s/*","/auth/*","/api/*"]` | served by the Node entry | `public/` + rewrites | Firebase Hosting + rewrites to the function |
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
  plan_expires_at INTEGER,                      -- derived from purchases; plan counts as free once passed
  audio_blocked   INTEGER NOT NULL DEFAULT 0,   -- set by the operator for repeated copyright reports
  created_at      INTEGER NOT NULL
);

CREATE TABLE identities (
  provider       TEXT NOT NULL,                 -- 'google' | 'apple' | 'email' | later 'wechat', 'phone'
  subject        TEXT NOT NULL,                 -- OIDC 'sub', or the normalized email for 'email'
  account_id     TEXT NOT NULL,
  email          TEXT,                          -- shown to the account owner only
  email_verified INTEGER NOT NULL DEFAULT 0,    -- only verified emails link accounts
  created_at     INTEGER NOT NULL,
  PRIMARY KEY (provider, subject)
) WITHOUT ROWID;
CREATE INDEX idx_identities_account ON identities(account_id);
CREATE INDEX idx_identities_email ON identities(email) WHERE email_verified = 1;

CREATE TABLE email_codes (
  email_hash TEXT PRIMARY KEY,                  -- SHA-256 hex of the normalized email
  code_mac   TEXT NOT NULL,                     -- HMAC-SHA-256(EMAIL_CODE_KEY, email + code)
  expires_at INTEGER NOT NULL,                  -- now + 10 minutes
  attempts   INTEGER NOT NULL DEFAULT 0         -- at 5 the code is dead
) WITHOUT ROWID;

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
  audio_kind       TEXT,                        -- 'library' | 'custom' | 'spotify' | NULL
  audio_set_by     TEXT,                        -- account that set the audio, for the Spotify count
  child_seq        INTEGER NOT NULL DEFAULT 0,  -- bumped by every memo (later comment) write
  child_purged_seq INTEGER NOT NULL DEFAULT 0,  -- highest seq of purged child tombstones
  updated_at       INTEGER NOT NULL,
  deleted_at       INTEGER                      -- tombstone: links answer 410 until purge
);
CREATE INDEX idx_events_owner ON events(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_spotify ON events(audio_set_by) WHERE audio_kind = 'spotify' AND deleted_at IS NULL;

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

CREATE TABLE links (                            -- public, view-only links
  id         TEXT PRIMARY KEY,
  token      TEXT NOT NULL UNIQUE,              -- 22 chars base64url, stored in clear (design D10)
  event_id   TEXT NOT NULL,
  label      TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,                           -- NULL = never
  revoked_at INTEGER
);
CREATE INDEX idx_links_event ON links(event_id);

CREATE TABLE invites (
  id         TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,              -- SHA-256 hex, for lookup
  token_enc  TEXT NOT NULL,                     -- AES-GCM(INVITE_KEY, token), so owners can copy it on any device
  event_id   TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('viewer','editor')),
  max_uses   INTEGER,                           -- NULL = unlimited; else 1 to 100
  use_count  INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,                           -- NULL = never
  revoked_at INTEGER
);
CREATE INDEX idx_invites_event ON invites(event_id);

CREATE TABLE members (
  event_id   TEXT NOT NULL,
  account_id TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('viewer','editor','removed')),   -- 'removed' blocks rejoining
  invite_id  TEXT,                              -- invite used to join
  created_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, account_id)
) WITHOUT ROWID;
CREATE INDEX idx_members_account ON members(account_id) WHERE role <> 'removed';

CREATE TABLE media (
  id           TEXT PRIMARY KEY,                -- 22 chars base64url; blob key m/{id}.{ext} or a/{id}.m4a
  uploader_id  TEXT NOT NULL,                   -- plan gates and counts use the uploader
  event_id     TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('still','motion','audio')),
  content_type TEXT NOT NULL,
  bytes        INTEGER NOT NULL,
  width        INTEGER,
  height       INTEGER,
  duration_ms  INTEGER,
  created_at   INTEGER NOT NULL,
  unused_since INTEGER                          -- set when no event references it; purged 24 h later
);
CREATE INDEX idx_media_uploader ON media(uploader_id, kind) WHERE unused_since IS NULL;
CREATE INDEX idx_media_unused ON media(unused_since) WHERE unused_since IS NOT NULL;

CREATE TABLE purchases (
  store       TEXT NOT NULL,                    -- 'apple' | 'google'
  original_id TEXT NOT NULL,                    -- Apple originalTransactionId, Google purchase token
  account_id  TEXT,                             -- NULL until attached (guest purchase)
  product_id  TEXT NOT NULL,
  plan        TEXT NOT NULL,                    -- plan the product grants
  status      TEXT NOT NULL CHECK (status IN ('active','grace','expired','refunded')),
  expires_at  INTEGER,
  checked_at  INTEGER NOT NULL,
  PRIMARY KEY (store, original_id)
) WITHOUT ROWID;
CREATE INDEX idx_purchases_account ON purchases(account_id);
CREATE INDEX idx_purchases_expiry ON purchases(expires_at) WHERE status IN ('active','grace');

CREATE TABLE rate_counters (
  key          TEXT NOT NULL,                   -- e.g. 'code:email:<hash>', 'upload:acct:<id>'
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
) WITHOUT ROWID;
```

Comments (later change) get a `comments` table shaped like `memos`, using the same `child_seq`.

### 6.2 Firestore mapping (`FirestoreStore`)

| SQL table | Firestore |
| :--- | :--- |
| `accounts` | `accounts/{id}` |
| `identities` | `identities/{provider}:{subject}` (query by `email`) |
| `email_codes` | `emailCodes/{emailHash}` |
| `sessions` | `sessions/{tokenHash}` |
| `events` | `events/{id}` with `ownerId`, `rev`, `doc`, `audioKind`, `audioSetBy`, `childSeq`, `childPurgedSeq`, `deletedAt` |
| `revisions` | `events/{id}/revisions/{rev zero-padded to 10 digits}` |
| `memos` | `events/{id}/memos/{memoId}` (query by `seq`) |
| `links` | `links/{token}` (query by `eventId`) |
| `invites` | `invites/{tokenHash}` (query by `eventId`) |
| `members` | `members/{eventId}_{accountId}` (query by `accountId` or `eventId`) |
| `media` | `media/{id}` (query by `uploaderId`, `kind`) |
| `purchases` | `purchases/{store}_{originalId hash}` |
| `rate_counters` | `counters/{key}_{windowStart}` with `FieldValue.increment` |

Patch, memo writes (which bump `childSeq`), invite join (which bumps `useCount`) and plan-count checks run in Firestore transactions.

---

## 7. API contract

### 7.1 Conventions

- Base URL `https://<domain>/api/v1`. JSON, UTF-8. Timestamps are ISO-8601 UTC strings (`2026-10-12T15:04:05Z`).
- Requests are validated strictly: unknown fields give `400 invalid_payload`. Clients ignore unknown fields in responses.
- JSON bodies at most 64 KB. Uploads at most 4,194,304 bytes.
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
- `audio` is one of `{"kind":"library","trackId":"calm-lofi"}`, `{"kind":"custom","mediaId":"…","title":"…"}` or `{"kind":"spotify","url","title","artist"}`. Public link projections drop `custom` audio. Spotify URLs must be `https://open.spotify.com/` track, album or playlist URLs (an `intl-xx/` segment is allowed, the query is dropped); title and artist come from the app (oEmbed), at most 200 characters.
- Field rules (title 1 to 100 characters, emoji one grapheme, dates 1900 to 2200, IANA zone or null, colours `#RRGGBB`, ids `^[a-z0-9_-]{1,32}$`, notes at most 4,000 characters, `backdrop.dim` 0 to 0.8) come from `:core:model`.
- `theme` and `backdrop` together carry the app's `EventCustomization` ([customization spec](../features/customization/SPEC.md)). Customization fields the web page cannot render yet are added to `theme` as optional fields when the page supports them; additive fields do not change the API version.

Memo:
```json
{"id": "5c1f…", "eventId": "0b8f…", "seq": 41, "content": "Booked the venue today.", "milestoneTag": "Day 100", "createdAt": "…", "updatedAt": "…"}
```

### 7.3 Endpoints

| Method | Path | Who | Purpose |
| :--- | :--- | :--- | :--- |
| GET | `/health` | anyone | `{"status":"ok","version":"…"}` |
| GET | `/config` | anyone | `{"region":"global","live":"ws","signIn":["apple","google","email"],"stores":["apple","google"],"features":{"spotify":true}}`, cacheable |
| POST | `/auth/token` | anyone (rate limited) | `{provider, idToken, nonce}` for Google and Apple: sign in, creating the account on first use |
| POST | `/auth/email/start` | anyone (rate limited) | `{email}`: sends a 6-digit code. Always `202`, whether or not the address has an account |
| POST | `/auth/email/verify` | anyone (rate limited) | `{email, code}`: sign in, creating the account on first use |
| POST | `/auth/signout` | session | ends this session |
| GET, PATCH, DELETE | `/me` | session | account, plan and limits used; change display name; delete account |
| POST | `/me/identities` | session | add a sign-in method (same bodies as sign-in) |
| GET | `/sync` | session | manifest `{"events":[{id, rev, role, childSeq}]}`, ETag |
| POST | `/events/fetch` | session | `{ids}` (at most 100): documents projected by role |
| GET | `/events/{id}` | owner, member | one document, ETag |
| PUT | `/events/{id}` | session | create (owned-event limit applies); repeating with the same owner returns the current document |
| PATCH | `/events/{id}` | owner, editor | `{baseRev, patch}` → `{event, overwritten}` |
| DELETE | `/events/{id}` | owner | delete the event, its memos, links, invites, members and media |
| GET | `/events/{id}/children?after=` | owner | `{memos, seq, reset}` |
| PUT, PATCH, DELETE | `/events/{id}/memos/{memoId}` | owner | create (idempotent), patch, delete a memo |
| GET | `/events/{id}/revisions?before=&limit=` | owner, editor | history page, newest first, at most 50 |
| POST | `/events/{id}/restore` | owner, editor | `{rev}` |
| GET | `/events/{id}/sharing` | owner | public links, invites (with URLs and use counts), members, removed members |
| POST | `/events/{id}/links` | owner | `{label, expiresAt}` (`null` = never) → link with `url` |
| PATCH, DELETE | `/links/{linkId}` | owner | change label or expiry; revoke |
| POST | `/events/{id}/invites` | owner | `{role, maxUses, expiresAt}` (`maxUses` null = unlimited) → `{inviteId, url}` |
| PATCH, DELETE | `/invites/{inviteId}` | owner | change expiry, use count or role; revoke |
| GET | `/invites/{token}` | session | `{state, eventTitle, ownerName, role}`; `state` is `open`, `full`, `expired`, `revoked`, `member`, `owner` or `removed`. Uses nothing |
| POST | `/invites/{token}/join` | session | adds the account as a member and takes one use; returns `{eventId, url}` (`/s/{eventId}`). Owners and members get the event and take no use |
| PUT | `/events/{id}/members/{accountId}` | owner | `{role}` |
| DELETE | `/events/{id}/members/{accountId}` | owner (removes and blocks rejoining), or the member (`me`, leaves) |
| DELETE | `/events/{id}/removed/{accountId}` | owner | "Allow again": lifts the block |
| GET | `/links/{token}` | anyone | public link view, ETag |
| POST | `/events/{id}/media` | owner, editor | raw body, `Content-Type`, `X-Media-Kind: still|motion|audio` → `{mediaId, url}` |
| GET | `/audio/catalog` | anyone | built-in tracks, ETag, cacheable |
| GET | `/audio/{id}?event=` or `?link=` | see section 10.3 | a built-in track or a custom audio file |
| POST | `/purchases/apple` | session, or none for a guest | `{signedTransactions}` (JWS from StoreKit 2) → `{plan, expiresAt}` |
| POST | `/purchases/google` | session, or none for a guest | `{productId, purchaseToken}` → `{plan, expiresAt}` |
| POST | `/purchases/apple/notifications` | Apple (signed payload) | App Store Server Notifications V2 |
| GET | `/live?event={id}` or `/live?link={token}` | as for reads | WebSocket upgrade, `ws` mode only |
| POST | `/internal/daily` | `CRON_SECRET` (vercel only) | runs the daily job |

Page routes (HTML): `GET /e/{token}` (public link), `GET /i/{token}` (invite), `GET /s/{eventId}` (member page), `GET /auth/{google|apple}/start?return=`, `GET|POST /auth/{google|apple}/callback`, `GET|POST /auth/email` (code form), `POST /auth/signout`. Self-host only: `GET /m/{file}`.

### 7.4 Selected bodies

Patch:
```json
{"baseRev": 9, "patch": {"title": "Our wedding day", "backdrop": null}}
```
```json
{"event": {"...": "document at rev 10"}, "overwritten": ["targetTime"]}
```

Public link view (`GET /links/{token}`):
```json
{
  "event": {"rev": 10, "title": "…", "...": "shared fields only, no custom audio"},
  "serverTime": "2026-10-12T15:09:00Z",
  "live": {"mode": "ws", "url": "wss://<domain>/api/v1/live?link=…"}
}
```
Member view (`GET /events/{id}` for a member) adds `role` and `members: [{"name","role"}]`.

Sharing (`GET /events/{id}/sharing`):
```json
{
  "links": [{"id": "…", "label": "Instagram", "url": "https://<domain>/e/…", "expiresAt": null}],
  "invites": [{"id": "…", "url": "https://<domain>/i/…", "role": "editor", "maxUses": 5, "useCount": 2, "expiresAt": "2026-11-11T15:04:05Z"}],
  "members": [{"accountId": "…", "name": "Mum", "role": "editor", "joinedVia": "…"}],
  "removed": [{"accountId": "…", "name": "Ex"}]
}
```

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

### 7.5 Error codes

| HTTP | `code` | Meaning |
| :--- | :--- | :--- |
| 400 | `invalid_payload` | Validation failed. `details.field` names the field |
| 400 | `invalid_code` | Email code wrong, expired or out of attempts |
| 401 | `unauthorized` | No session, expired session or bad ID token |
| 401 | `sign_in_required` | Invite or member page without a session |
| 402 | `premium_required` | The writer's plan does not include this. `details.feature` names it (`animated_backdrop`, `premium_audio`, `custom_audio`, `photos`, `spotify_events`, `events`) |
| 403 | `forbidden` | Role too low, not a member, or removed |
| 403 | `field_not_allowed` | Non-owner wrote an owner-only field |
| 404 | `not_found` | Unknown, malformed or purged id or token. Identical for all of these |
| 409 | `conflict` | Event or memo id already used by another account |
| 410 | `revoked`, `expired`, `deleted` | Link revoked or expired, event deleted |
| 410 | `invite_full`, `invite_expired`, `invite_revoked` | Invite has no uses left, is past its expiry, or was revoked |
| 413 | `payload_too_large` | Body or file over its limit |
| 415 | `unsupported_media_type` | Wrong content type, or file content does not match |
| 429 | `rate_limited` | Too many requests, `Retry-After` set |
| 429 | `quota_exceeded` | A count limit that no plan raises (paid limits, links per event, members per event) |
| 500 | `internal_error` | `details.requestId` set |
| 503 | `service_unavailable` | Maintenance mode or provider limit reached |

---

## 8. Accounts, sessions, plans and purchases

- **Google and Apple** (app): Credential Manager and Google Sign-In (iOS) for Google; AuthenticationServices (iOS) and an in-app browser tab (Android) for Apple. The app sends the ID token and its nonce; the core checks signature (JWKS cached per instance), `iss`, `aud`, `exp` and `nonce`.
- **Web sign-in**: `/auth/{provider}/start` sets a 10 minute `__Host-dtm_oauth` cookie (state, PKCE verifier, nonce, return path; `SameSite=None` because Apple returns with a cross-site form POST) and redirects. The callback exchanges the code server to server (Apple's client secret is an ES256 JWT signed by the core), creates the session, sets `__Host-dtm_session` (`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=7776000`) and redirects to the return path (must start with `/e/`, `/i/` or `/s/`).
- **Email codes**: the address is trimmed and lower-cased. A 6-digit code from a CSPRNG is stored as an HMAC with `EMAIL_CODE_KEY`, valid 10 minutes, dead after 5 wrong attempts. Limits: 5 codes per address per hour, 20 per IP per hour. The response never says whether an account exists. The email contains only the code and the app name.
- **Linking**: a new identity whose verified email matches an existing verified identity joins that account. `POST /me/identities` adds a method explicitly.
- **Sessions**: `st_` + 43 chars base64url (256 bits), stored as SHA-256. Valid until 90 days after last use.
- **First sign-in on a device**: the app uploads local events (`PUT /events/{id}`) and memos. Uploads above the owned-event limit are accepted for this first upload only, so nothing local is lost.
- **Deletion**: deletes owned events (with revisions, memos, links, invites, members, media), the account's memberships, uploads, identities and sessions. Revisions they authored on other events keep `author_id = NULL`. Store subscriptions are not cancelled by the backend; the app tells the user how.
- **Purchases (native)**:
  - Apple: the app buys with StoreKit 2 (Swift bridge) and sets `appAccountToken` to the account id when signed in. It sends `jwsRepresentation` of each current entitlement to `POST /purchases/apple`. The core verifies the JWS signature and `x5c` chain to Apple Root CA G3, `bundleId` and `environment`, then stores the purchase. App Store Server Notifications V2 (signed the same way) report renewals, grace periods, expiry and refunds.
  - Google: the app buys with Play Billing Library and sends the purchase token. The core gets an OAuth token for the service account (RS256 JWT, cached 1 hour), calls `purchases.subscriptionsv2.get`, acknowledges new purchases and stores the result.
  - Guests: purchases are stored with `account_id = NULL`; the app sends them again after sign-in to attach them. "Restore purchases" resends current entitlements.
  - Plan: the highest plan among the account's active or grace purchases. The daily job re-checks purchases past `expires_at` (App Store Server API status, Play API). A gated write whose plan looks expired triggers one re-check before rejecting.
- **Gating**: on writes that add paid content or count against a limit, the core loads the writer's plan and counts and checks the plan table from `:core:model` (values in [`docs/features/premium/SPEC.md`](../features/premium/SPEC.md)). Existing content is never removed or hidden.

---

## 9. Live updates

- Messages: `{"type":"rev","rev":13}` after an accepted event write or restore; `{"type":"children","seq":41}` after a memo write (owner sockets only); `{"type":"access"}` after a link, invite or member change, or event deletion. Clients refetch with `If-None-Match`.
- `ws` mode: the client opens `wss://<domain>/api/v1/live?link=…` (or `?event=…` with a session). The core authorizes like a read, then returns `LiveUpgrade`. Cloudflare forwards the request to `EventRoom` (`idFromName(eventId)`), which accepts the socket with the Hibernation API, tags it with the subscriber's role, and broadcasts published messages. Self-host keeps a map of event id to sockets. The client reconnects with backoff (1, 2, 5, 10, 30 seconds) and refetches after each reconnect.
- `poll` mode: conditional GET every 20 seconds while visible; every 60 seconds after 10 minutes without changes; none while hidden; one immediate GET on becoming visible.

---

## 10. Backdrops and audio

### 10.1 Files

| Kind | Types accepted | Limits |
| :--- | :--- | :--- |
| `still` (also the key photo of an animated backdrop) | JPEG, WebP | 1.5 MB, long edge 2560 px (clients target 2048 px) |
| `motion` | MP4, H.264 video track only, no audio track | 4 MB, 5 s, long edge 1280 px |
| `audio` (custom audio) | M4A (AAC), no video track | 4 MB |

Client side:
- Still: Android decodes with `ImageDecoder` and encodes WebP (quality 80, lower in steps); iOS uses an ImageIO thumbnail at 2048 px and JPEG quality 0.82, lower in steps; the web editor uses canvas `toBlob('image/webp')` with a JPEG fallback.
- iPhone Live Photo: `PHAssetResource` gives the key photo and the paired video (MOV, often HEVC, with sound). `AVAssetExportSession` with an H.264 1280 px preset and a composition without the audio track produces the motion part.
- Google Motion Photo: the XMP `Container:Directory` (or legacy `MicroVideoOffset`) gives the offset of the MP4 appended to the JPEG or HEIC file. The app cuts it out and runs Media3 Transformer (H.264, 1280 px, audio removed). Files without this metadata are treated as stills.
- Custom audio: iOS `AVAssetExportSession` (Apple M4A preset), Android Media3 Transformer (audio only, AAC). The app picks a bitrate so the result is at most 4 MB (96 kbps gives about 5.5 minutes) and asks for a section when the file is longer.

Server side (core, no decoding):
1. Check size against the kind's limit before reading the whole body when `Content-Length` is present.
2. Identify the type from magic bytes and compare with `Content-Type`.
3. Read dimensions (JPEG SOF, WebP VP8/VP8L/VP8X, MP4 `tkhd`), duration (`mvhd`) and codecs (`avc1`, `mp4a`). Reject `motion` with a sound track or a `©xyz` location atom, and `audio` with a video track.
4. Remove JPEG APP1 to APP15 segments except ICC, and WebP `EXIF` and `XMP ` chunks.
5. Check the uploader's plan and counts (`photos`, `animated_backdrop`, `custom_audio`) and the hourly upload limit.
6. `BlobStore.put`, insert the `media` row with `unused_since = now` until an event references it.

Serving: backdrops from the media origin with `Cache-Control: public, max-age=86400` and `X-Content-Type-Options: nosniff`. The daily job deletes files with `unused_since` older than 24 hours. Display: the still first; for animated, `<video muted playsinline poster=still>` plays once on load and on tap, then shows the still; under `prefers-reduced-motion` the video element is not created.

### 10.2 Built-in catalog

`backend/core/audio/catalog.json`:
```json
{"tracks": [{"id": "calm-lofi", "title": "Calm Lo-Fi", "artist": "…", "durationSec": 184, "tier": "free", "bytes": 2950000}]}
```
Files are AAC (`.m4a`), at most 4 MB, stored at `audio/{id}.m4a`, uploaded by the operator with the variant's deploy tooling. Tracks are public domain recordings. The catalog ships with the core, so changing it is a deploy, not an app release.

### 10.3 Audio access (`GET /audio/{id}`)

- Free built-in track: anyone, `Cache-Control: public, max-age=604800`.
- Premium built-in track: a caller whose plan includes `premium_audio`, or a caller who names an event it can read (`?event=` with a session, `?link=` with an active public link) whose audio is this track. `Cache-Control: private, max-age=604800`. Otherwise `402 premium_required`.
- Custom audio file: the owner and members of the event that uses it (`?event=` with a session). Never through a public link. Otherwise `404 not_found`.
- Served by streaming `BlobStore.get`, so it works on every variant. The app caches files, so each device downloads a file once.

---

## 11. Limits

### 11.1 Plan table (initial values)

The plan table in `:core:model` is the source of truth; [`docs/features/premium/SPEC.md`](../features/premium/SPEC.md) lists the same values. Counts are per account: owned events count the owner's events; the others count what the account added.

| Limit | Free | Premium | Premium Plus |
| :--- | :--- | :--- | :--- |
| Owned events | 10 | 500 | as Premium until decided |
| Photo backdrops in use (still or animated) | 5 | 300 | |
| Animated photos in use | 0 | 30 | |
| Custom audio files in use | 0 | 20 | |
| Built-in tracks | free tracks | all | |
| Spotify events (set by the account) | 3 | no separate limit | |

### 11.2 Fixed limits (all plans)

| Limit | Value |
| :--- | :--- |
| Title | 1 to 100 characters |
| Notes | 4,000 characters |
| Memo text | 10,000 characters |
| Event document | 16 KB |
| Memos per event | 500 |
| Active public links per event | 10 |
| Active invites per event | 20 |
| Invite use count | 1 to 100, or unlimited |
| Link and invite expiry | 5 days, 30 days, never, or custom up to 5 years |
| Members per event | 100 |
| Session lifetime | 90 days after last use |
| Revisions kept | latest 200 per event |
| Child tombstones kept | 30 days |
| Files | section 10.1 |
| Uploads | 20 per hour per account |
| Writes (event and memo PUT, PATCH, DELETE, restore) | 120 per minute per account |
| Email codes | 5 per address per hour, 20 per IP per hour; 10 minutes; 5 attempts |
| Sign-in attempts | 30 per hour per IP |
| Live polling | 20 s visible, 60 s after 10 min idle, none hidden |

Per-IP counters use `SHA-256(ip + ":" + yyyymmdd + ":" + RATE_SALT)`. Raw IPs are never stored or logged. The core refuses to start without `RATE_SALT`, `EMAIL_CODE_KEY` and `INVITE_KEY`.

---

## 12. Free tier budget and plan requirements

Cloudflare Workers Free (numbers from Cloudflare docs, to re-check in task 5.4):

| Resource | Limit | Use |
| :--- | :--- | :--- |
| Worker requests | 100,000 per day | Page view: 1 page + 1 WebSocket upgrade + 1 refetch per change. Sync: 1 request when idle (`304`). Audio: 1 per file per device. Static assets are not Worker requests. |
| Worker CPU | 10 ms per request | Hashing, JSON, validation, templating, byte scanning of uploads, one JWS or JWT signature check. No image decoding. |
| D1 rows written | 100,000 per day | An event patch writes about 5 rows (event, revision, counters); a memo write about 4. |
| D1 storage | 500 MB per database | Event documents at most 16 KB; revisions store only changed fields. |
| Durable Objects | 100,000 requests and 13,000 GB-s per day, SQLite-backed only | Publishes and WebSocket messages count as requests. Hibernation keeps idle sockets free of duration. |
| R2 | 10 GB storage, 1 million writes and 10 million reads per month, no egress fee | Backdrops and audio. Backdrop reads are cached at the edge for 1 day. |

Planning ceiling: about 30,000 page views per day. Past that, Workers Paid (5 USD per month).

Other costs: self-host is the server only. Vercel Hobby forbids commercial use. Firebase Functions need Blaze. Email: one transactional mail provider (for example Resend or Postmark; check current free tiers). Purchases: store fees only.

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
- Tokens: public link `[A-Za-z0-9_-]{22}` (128 bits, clear text); invite same format, stored as SHA-256 plus AES-GCM ciphertext under `INVITE_KEY`; session `st_` + 43 chars, stored hashed; email codes as HMAC. Token format is checked before any store access.
- Page headers: `Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: https://media.<domain>; media-src 'self' https://media.<domain>; font-src 'self'; connect-src 'self' wss://<domain>; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; frame-src 'none'; object-src 'none'; upgrade-insecure-requests`, plus `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Strict-Transport-Security: max-age=31536000`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- HTML escaping and the JSON data blob rules are unchanged from `services/share/` (`SHARE_SERVICE.md` section 7.1).
- Logs: one JSON line per request with `ts`, `route`, `status`, `reqId`, `rateLimited`. Never bodies, titles, memo text, emails, codes, tokens, cookies, `Authorization`, purchase tokens, IPs or Spotify URLs.

Testing (details in [`TESTING_STRATEGY.md`](../standards/TESTING_STRATEGY.md)):
- `:core:model` tests on every target; core unit tests.
- Store conformance suite against each `Store` (SQLite, Firestore emulator).
- HTTP conformance suite in `backend/core/conformance/` against each variant: `wrangler dev`, the self-host container, the Vercel handler on Node with a libSQL file, the Firebase emulators.
- Purchase verification against recorded sandbox payloads (Apple JWS, notifications) and a fake Google API.
- Countdown vectors generated from `:core:model`; `countdown.js` must pass them. With a TypeScript core, also the generated contract checks (task 2.8).

Operations:
- Maintenance: `MAINTENANCE=1` makes writes return `503`; reads keep working.
- Takedown: revoke the reported link, or remove the reported media or custom audio file (clear it from the event, delete the blob), and for repeat copyright reports set `accounts.audio_blocked = 1`, with the provider's own tools (an SQL statement for D1, SQLite and Turso; the console for Firestore and the blob store). Each variant's README holds the exact commands. An admin API is not planned.
- Daily job: purchase re-checks; media unused for 24 hours; links and invites revoked or expired more than 30 days ago; event tombstones older than 30 days with their revisions and memos; memo tombstones older than 30 days (raising `child_purged_seq`); expired email codes; sessions unused for 90 days; rate counters older than 2 days. Bounded batches of 500 rows.
- Backups: D1 Time Travel (7 days on Free); self-host copies the volume; Turso and Firestore use their own point-in-time recovery.
- CI: one workflow `backend.yml` (see [`WORKFLOW_PIPELINE.md`](../ci-cd/WORKFLOW_PIPELINE.md) section 4).

---

## 15. Owner inputs

Needed before the global launch:
- Domain on a Cloudflare zone, plus `media.<domain>` for R2.
- Apple: Team ID, bundle id, App Store id, a Services ID for web sign-in, a Sign in with Apple private key, subscription products, an In-App Purchase key for the App Store Server API, the notification URL set in App Store Connect.
- Google: OAuth client ids for Android, iOS and web, the web client secret, Play subscription products, a service account with Play Console financial access.
- Email provider account and a sending domain with SPF, DKIM and DMARC.
- Licensed audio tracks and the free and Premium split.
- Android package name and signing key fingerprints for `assetlinks.json`.
- Abuse contact address, privacy policy owner and jurisdiction.
- Terms of service, privacy policy and disclaimer ([`docs/legal/`](../legal/README.md)), and a DMCA designated agent registered with the US Copyright Office.
- For other providers when used: Turso database and Vercel Blob store; a Firebase project on Blaze.

---

## 16. Regions

A region is one deployment with its own domain, data, sign-in methods, stores and features, reported by `GET /config`. Accounts and data never cross regions. The app picks the region once per install: on iOS from the App Store storefront country, on Android by build (China Android builds go to Chinese stores). The global region is Cloudflare. China would use the self-host variant on a mainland cloud; requirements and open points are in [`CHINA.md`](CHINA.md).
