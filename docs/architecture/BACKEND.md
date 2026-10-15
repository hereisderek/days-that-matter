# Backend Architecture & API Contract

Status: design, not implemented. Behavior requirements: OpenSpec change [`pluggable-backend-live-sharing`](../../openspec/changes/pluggable-backend-live-sharing/) (specs in its `specs/` folder), and for unit modes, Home, notifications and smart days the change [`design-v2-features`](../../openspec/changes/design-v2-features/). Decisions and alternatives: its [`design.md`](../../openspec/changes/pluggable-backend-live-sharing/design.md). Work order: its [`tasks.md`](../../openspec/changes/pluggable-backend-live-sharing/tasks.md). China: [`CHINA.md`](CHINA.md).

This document replaces [`SHARE_SERVICE.md`](SHARE_SERVICE.md), which describes the frozen TypeScript service in `services/share/`.

---

## 1. Summary

- One backend for accounts, sync (events, memos, later comments), sharing, history, backdrops, audio, plans and purchases.
- `backend/core/` holds all behavior. Each provider is a variant in its own directory: **cloudflare** (primary), **selfhost**, **vercel**, **firebase**.
- Core language: TypeScript (owner decision, design D1 and section 13); Kotlin/JS stays an option if the core grows. Either way the rules come from `:core:model`, the Kotlin module the app uses.
- Purchases are verified with Apple and Google directly (no RevenueCat). Sign-in: Google, Apple, email codes, as plug-ins.
- A region is one deployment. The global region runs on Cloudflare; a China region would be a separate deployment (section 16).
- Share web pages are read-only (design D17): the public link page shows the event; invite and member links open the app. No browser sessions, no cookies.
- Push notifications go out through APNs and FCM (change `design-v2-features`, section 18).
- No web framework beyond a tiny router, no ORM, no server-side media processing.

---

## 2. Architecture

```
  Android / iOS app (KMP)              Browser (share pages)
  Ktor client, :core:model             HTML + countdown.js, live.js (read-only)
        |  /api/v1/*  (Bearer)                |  /e, /i, /s, /export, /admin, /api/v1 (no cookies)
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
    web/                    share page assets: share.css, countdown.js, live.js, admin.js (operator page), fonts, og/, .well-known/, test vectors
    audio/catalog.json      built-in track list
    smart/catalog.json      seasonal smart day templates (draft, change design-v2-features)
    contract/               generated from :core:model (task 2.8): api.schema.json, errors.json, plans.json,
                            limits.json, validation-vectors.json, merge-vectors.json
    conformance/            black-box HTTP suite every variant must pass
  cloudflare/               Worker entry, D1 driver, R2 store, EventRoom Durable Object, wrangler.jsonc
  selfhost/                 Node entry, node:sqlite driver, disk store, WebSocket hub, SMTP mailer, Dockerfile, compose.yaml
  vercel/                   handler entry, libSQL driver, Vercel Blob store, vercel.json
  firebase/                 function entry, FirestoreStore, Cloud Storage store, firebase.json, firestore.rules, storage.rules
```

`backend/*` are npm workspaces (TypeScript), each variant bundling only its own vendor code. If the core later moves to Kotlin/JS, they become Gradle modules (`:backend:core`, `:backend:cloudflare`, ...) built to JS.

---

## 4. Ports and plug-ins

Shown in Kotlin notation for readability; the implementation is TypeScript with the same shape.

```kotlin
interface Store {                       // use-case level; one call = one transaction
    suspend fun applyPatch(eventId: String, author: String, baseRev: Int, patch: JsonObject, now: Long): PatchResult
    suspend fun manifest(accountId: String): List<ManifestEntry>
    suspend fun joinInvite(tokenHash: String, accountId: String, now: Long): JoinResult
    // ... about 60 operations: accounts, identities, email codes, sessions, events, revisions, memos,
    //     links, invites, members, media and library, purchases, grants, exports, devices, rate counters,
    //     storage report, purge
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

Implementation notes (`backend/core/src/ports/`, wave 1):
- `SqlDriver.batch` returns the rows each statement changed. D1 and libSQL over HTTP have no interactive transactions, so `SqlStore` writes optimistically: it reads, computes the merge, then commits one batch whose statements apply only while the event is still at the rev it read, and retries otherwise. After 20 lost attempts the store throws `StoreBusyError` and the core answers `503 service_unavailable`.
- A new event starts at rev 1 without a revision row; every accepted patch that changes something appends one revision. A patch that changes nothing keeps the rev.
- `Config` comes from environment variables: `ORIGIN`, `MEDIA_ORIGIN`, `REGION`, `VERSION`, `LIVE_MODE` (`ws` or `poll`), `SIGN_IN` and `STORES` (comma lists), `FEATURE_SPOTIFY`, `UI_MEMO_BADGE`, `MAINTENANCE`, `INACTIVE_JOB`, `GOOGLE_CLIENT_IDS` and `APPLE_CLIENT_IDS` (comma lists of accepted ID token `aud` values, required when that method is in `SIGN_IN`), `APP_SCHEME` (the app's URL scheme for the Apple callback, default `daysthatmatter`), and the secrets `RATE_SALT`, `EMAIL_CODE_KEY`, `INVITE_KEY` (required) and `ADMIN_TOKEN` (optional, at least 32 characters).
- `Ports` also carries `keys`, the `KeyFetcher` for Google's and Apple's JWKS: `cachedKeyFetcher(fetch, clock)` in production (cached an hour per URL, refetched at most once a minute for an unknown key id), a fixed set of locally generated keys in tests.
- Identity providers live in `src/auth/`: `googleProvider` and `appleProvider` (`TokenProvider`, built from `Config` and `keys`) and the email code functions over the `Store` and `Mailer`.
- The store conformance suite (`src/store/conformance.ts`) has no test framework dependency; it runs against `SqlStore` on `node:sqlite` and the in-memory `MemoryStore`, and a test checks that it fails for a store with a lost-update bug.
- History (wave 3): each write that adds a revision deletes the event's revisions older than the newest 200 (`LIMITS.REVISIONS_KEPT`) in the same batch, guarded like the write itself; a write that changes nothing prunes nothing. Revisions of a deleted event go with the purge job (3.13) or account deletion.
- Sharing (wave 3): a link or invite is active while not revoked and not past `expires_at`. The 10 links and 20 invites per event count active ones (a full invite counts: the owner can raise its use count); creating checks the count in the same statement as the insert. `joinInvite` reads the invite, decides with `inviteAccess` (store/records.ts, shared by every store), then commits one batch: the member row is inserted only while the invite still has the use count, role and state it read and the event has fewer than 100 members, and the use is taken only when that row is this join's; a join that lost a race reads again. Removal sets `members.role = 'removed'`; leaving and "allow again" delete the row.
- Reads by role (wave 2): `GET /events/{id}` answers `404 not_found` for an unknown or malformed id, `403 forbidden` for an event the caller is not owner, viewer or editor of (removed members included), and `410 deleted` for a deleted event the caller could read. `POST /events/fetch` leaves those out instead. Members see `childSeq` 0 in the manifest. Memo writes past 500 per event answer `429 quota_exceeded` with `details.limit` = `memos_per_event`. Repeating `DELETE /events/{id}` or a memo `DELETE` answers `204`. Lists of ids go to SQL as one JSON parameter (`json_each`), which stays under D1's 100 bound parameters.

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
| Static files | Static Assets, `run_worker_first: ["/e/*","/i/*","/s/*","/auth/*","/export/*","/admin/*","/api/*"]` | served by the Node entry | `public/` + rewrites | Firebase Hosting + rewrites to the function |
| Plan needed | Workers Free | your server | Hobby is non-commercial only; Pro for a commercial app | Blaze (pay as you go) |
| Platform body limit | 100 MB | none | 4.5 MB | 32 MB |

Notes:
- Durable Objects on the Free plan must be SQLite-backed, so `EventRoom` is declared with a `new_sqlite_classes` migration even though it stores nothing.
- Self-host can put media on a separate host through its reverse proxy (`MEDIA_ORIGIN`). On the same origin, `/m/` responses carry `Content-Security-Policy: sandbox` and `X-Content-Type-Options: nosniff`.
- Firebase rules deny all client access to Firestore and Storage. Only the function reads and writes.
- Moving between SQL-family variants: SQLite dump and import plus a copy of the blob files. Moving to or from Firestore needs an export tool, built when first needed.

---

## 6. Data model

### 6.1 SQL (SQLite dialect), `backend/core/migrations/`

Times are unix seconds UTC. No foreign key constraints; the core keeps references consistent.

`0001_init.sql` holds `accounts`, `events`, `revisions`, `memos`, `links`, `members`, `media`, `grants`, `exports` and `devices`. `0002_accounts.sql` adds `identities`, `email_codes` and `sessions` (task 3.5) and the column `events.first_upload_at` (section 8, first sign-in upload). `0003_sharing.sql` adds `invites` (task 3.8). The other tables come as their own migrations with their tasks: `purchases` (3.11), `rate_counters` (3.13). Drivers without a migration tool apply the files with `applyMigrations` (table `_migrations`); D1 can use `wrangler d1 migrations apply` on the same files.

```sql
CREATE TABLE accounts (
  id              TEXT PRIMARY KEY,             -- uuid
  display_name    TEXT NOT NULL,
  plan            TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','premium','premium_plus')),
  plan_expires_at INTEGER,                      -- derived from purchases and grants; plan counts as free once passed
  audio_blocked   INTEGER NOT NULL DEFAULT 0,   -- set by the operator for repeated copyright reports
  media_bytes     INTEGER NOT NULL DEFAULT 0,   -- sum of bytes of the account's media rows; changed in the same write as each insert and delete
  media_files     INTEGER NOT NULL DEFAULT 0,   -- number of the account's media rows; same rule
  last_active_at  INTEGER NOT NULL,             -- last authenticated request from any device, written at most once per day
  inactive_notice_1_at INTEGER,                 -- inactive accounts: first email sent (section 17); NULL after any signed-in use
  inactive_notice_2_at INTEGER,                 -- second email sent
  created_at      INTEGER NOT NULL
);
CREATE INDEX idx_accounts_media_bytes ON accounts(media_bytes);   -- storage report (section 14)
CREATE INDEX idx_accounts_media_files ON accounts(media_files);
CREATE INDEX idx_accounts_last_active ON accounts(last_active_at); -- storage report and inactive accounts job

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
  account_id   TEXT NOT NULL,                   -- app sessions only; the web has none (design D17)
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
  audio_media_id   TEXT,                        -- custom audio: the library file, for "used on N days" and garbage collection
  child_seq        INTEGER NOT NULL DEFAULT 0,  -- bumped by every memo (later comment) write
  child_purged_seq INTEGER NOT NULL DEFAULT 0,  -- highest seq of purged child tombstones
  updated_at       INTEGER NOT NULL,
  deleted_at       INTEGER,                     -- tombstone: links answer 410 until purge
  first_upload_at  INTEGER                      -- set when a first sign-in upload created it past the owned-event limit (section 8)
);
CREATE INDEX idx_events_owner ON events(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_spotify ON events(audio_set_by) WHERE audio_kind = 'spotify' AND deleted_at IS NULL;
CREATE INDEX idx_events_audio_media ON events(audio_media_id) WHERE audio_media_id IS NOT NULL AND deleted_at IS NULL;

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
  archived_at INTEGER,                          -- the member's own archive; never shown to others (change design-v2-features)
  reminders  TEXT,                              -- the member's own reminder choices, JSON like the owner-only `reminders` field
  created_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, account_id)
) WITHOUT ROWID;
CREATE INDEX idx_members_account ON members(account_id) WHERE role <> 'removed';

CREATE TABLE media (
  id           TEXT PRIMARY KEY,                -- 22 chars base64url; blob key m/{id}.{ext} or a/{id}.m4a
  uploader_id  TEXT NOT NULL,                   -- plan gates and counts use the uploader
  event_id     TEXT,                            -- backdrops: the event; NULL for custom audio (library files, used by any number of events)
  kind         TEXT NOT NULL CHECK (kind IN ('still','motion','audio')),
  content_type TEXT NOT NULL,
  bytes        INTEGER NOT NULL,
  width        INTEGER,
  height       INTEGER,
  duration_ms  INTEGER,
  title        TEXT,                            -- custom audio: title shown in the library, at most 200 characters
  library_removed_at INTEGER,                   -- custom audio: removed from the uploader's library (section 10.4)
  created_at   INTEGER NOT NULL,
  unused_since INTEGER                          -- set when nothing uses the file (backdrops: no event; audio: no event and out of the library); purged 24 h later
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

CREATE TABLE grants (                           -- plans granted by the operator without a store purchase (promotions)
  id         TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  plan       TEXT NOT NULL CHECK (plan IN ('premium','premium_plus')),
  starts_at  INTEGER NOT NULL,
  ends_at    INTEGER NOT NULL,
  reason     TEXT NOT NULL                      -- for the operator, e.g. 'promo-2026-11'
);
CREATE INDEX idx_grants_account ON grants(account_id);

CREATE TABLE exports (                          -- data export links (section 17)
  token_hash TEXT PRIMARY KEY,                  -- SHA-256 hex of the 22-char token
  account_id TEXT NOT NULL,
  reason     TEXT NOT NULL CHECK (reason IN ('request','inactive')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL                   -- request: 30 days; inactive: the deletion date
) WITHOUT ROWID;
CREATE INDEX idx_exports_account ON exports(account_id);

CREATE TABLE devices (                          -- push registration (change design-v2-features, section 18)
  install_id   TEXT PRIMARY KEY,                -- random per app install
  account_id   TEXT NOT NULL,
  platform     TEXT NOT NULL CHECK (platform IN ('ios','android')),
  push_token   TEXT NOT NULL,
  locale       TEXT NOT NULL,                   -- BCP 47 tag, for notification text
  time_zone    TEXT NOT NULL,                   -- IANA id
  kinds        TEXT NOT NULL,                   -- JSON array of enabled push kinds: 'changes', 'added', 'offers'
  last_seen_at INTEGER NOT NULL                 -- written at most once per day; the row is removed after 90 days
) WITHOUT ROWID;
CREATE INDEX idx_devices_account ON devices(account_id);

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
| `accounts` (storage and inactivity fields) | `mediaBytes`, `mediaFiles`, `lastActiveAt`, `inactiveNotice1At`, `inactiveNotice2At` on `accounts/{id}`, with indexes for the storage report and the inactive accounts job |
| `events` | `events/{id}` with `ownerId`, `rev`, `doc`, `audioKind`, `audioSetBy`, `audioMediaId`, `childSeq`, `childPurgedSeq`, `deletedAt` |
| `revisions` | `events/{id}/revisions/{rev zero-padded to 10 digits}` |
| `memos` | `events/{id}/memos/{memoId}` (query by `seq`) |
| `links` | `links/{token}` (query by `eventId`) |
| `invites` | `invites/{tokenHash}` (query by `eventId`) |
| `members` | `members/{eventId}_{accountId}` with `archivedAt`, `reminders` (query by `accountId` or `eventId`) |
| `media` | `media/{id}`, `eventId` null for library audio (query by `uploaderId`, `kind`) |
| `purchases` | `purchases/{store}_{originalId hash}` |
| `grants` | `grants/{id}` (query by `accountId`) |
| `exports` | `exports/{tokenHash}` (query by `accountId`) |
| `devices` | `devices/{installId}` (query by `accountId`) |
| `rate_counters` | `counters/{key}_{windowStart}` with `FieldValue.increment` |

Patch, memo writes (which bump `childSeq`), invite join (which bumps `useCount`), media inserts and deletes (which change `mediaBytes` and `mediaFiles`) and plan-count checks run in Firestore transactions.

---

## 7. API contract

### 7.1 Conventions

- Base URL `https://<domain>/api/v1`. JSON, UTF-8. Timestamps are ISO-8601 UTC strings (`2026-10-12T15:04:05Z`).
- Requests are validated strictly: unknown fields give `400 invalid_payload`. Clients ignore unknown fields in responses.
- JSON bodies at most 64 KB. Uploads at most 4,194,304 bytes.
- Auth: `Authorization: Bearer st_<43 chars>` from the app. Share web pages have no sessions and set no cookies (design D17). Operator routes take `Authorization: Bearer <ADMIN_TOKEN>` (section 14).
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
  "theme": {"paletteId": "violet", "cardStyle": "glass", "typography": "modern", "gradient": ["#8B5CF6", "#3B82F6"], "size": "medium"},
  "backdrop": {
    "kind": "animated", "stillId": "Pz8...", "motionId": "Hq3...", "dim": 0.3, "blur": 0,
    "stillUrl": "https://media.<domain>/m/Pz8....jpg", "motionUrl": "https://media.<domain>/m/Hq3....mp4"
  },
  "audio": {"kind": "spotify", "url": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", "title": "Today's Top Hits", "artist": "Spotify"},
  "notes": "Book the photographer",
  "pinnedAt": "2026-10-01T08:00:00Z",
  "categoryId": "anniversaries",
  "archivedAt": null,
  "reminders": {"daysBefore": [0, 7], "time": "09:00"},
  "updatedAt": "2026-10-12T15:04:05Z"
}
```

- Shared fields: `title`, `emoji`, `targetDate`, `targetTime`, `timeZone`, `unitMode`, `recurrence`, `theme`, `backdrop`, `audio`.
- Owner-only fields: `notes`, `pinnedAt` (null = not pinned; the carousel shows newest first), `categoryId`, `archivedAt` (null = not archived), `reminders`. Present only in the owner's projection. Memos are owner-only too. A write that sets `archivedAt` also clears `pinnedAt`. Members keep their own archive and reminders on their membership (`PATCH /events/{id}/membership`).
- `backdrop.kind` is `still` (only `stillId`) or `animated` (`stillId` is the key photo, `motionId` the MP4). `*Url` fields are set by the server and ignored in writes.
- `audio` is one of `{"kind":"library","trackId":"calm-lofi"}`, `{"kind":"custom","mediaId":"…","title":"…"}` or `{"kind":"spotify","url","title","artist"}`. A `custom` `mediaId` must be a file in the writer's own library (section 10.4). Public link projections drop `custom` audio. Spotify URLs must be `https://open.spotify.com/` track, album or playlist URLs (an `intl-xx/` segment is allowed, the query is dropped); title and artist come from the app (oEmbed), at most 200 characters.
- Field rules (title 1 to 100 characters, emoji one grapheme, dates 1900 to 2200, IANA zone or null, colours `#RRGGBB`, ids `^[a-z0-9_-]{1,32}$`, notes at most 4,000 characters, `backdrop.dim` 0 to 0.8) come from `:core:model`.
- `unitMode`: `auto`, `days`, `weeks`, `hours`, `calendar` or `workdays` ([events spec](../features/events/SPEC.md) section 2.1).
- `theme.size`: `small`, `medium` (default when missing) or `large`. Home list only; other views ignore it.
- `backdrop.blur`: 0 to 16, default 0. A blur radius in points at a 390 pt card width, scaled with the card. Applies to photo and art backdrops; the app and the public link page render it, the server never blurs. Art presets are not in the API yet; when `theme` gains a preset id, `backdrop.blur` applies to them too.
- `reminders`: `null` or `{"daysBefore": [...], "time": "HH:MM"}` with `daysBefore` a subset of `0`, `1`, `7` and `time` default `09:00` local. Scheduled on the device, never by the server.
- `theme` and `backdrop` together carry the app's `EventCustomization` ([customization spec](../features/customization/SPEC.md)). Customization fields the web page cannot render yet are added to `theme` as optional fields when the page supports them; additive fields do not change the API version.

Memo:
```json
{"id": "5c1f…", "eventId": "0b8f…", "seq": 41, "content": "Booked the venue today.", "milestoneTag": "Day 100", "createdAt": "…", "updatedAt": "…"}
```

### 7.3 Endpoints

| Method | Path | Who | Purpose |
| :--- | :--- | :--- | :--- |
| GET | `/health` | anyone | `{"status":"ok","version":"…"}` |
| GET | `/config` | anyone | `{"region":"global","live":"ws","signIn":["apple","google","email"],"stores":["apple","google"],"features":{"spotify":true},"ui":{"memoBadge":"top-right"}}`, cacheable. `ui` holds display settings the operator changes without an app release; `memoBadge` is `top-left` or `top-right` (default) |
| POST | `/auth/token` | anyone (rate limited) | `{provider, idToken, nonce}` for Google and Apple: sign in, creating the account on first use |
| POST | `/auth/email/start` | anyone (rate limited) | `{email}`: sends a 6-digit code. Always `202`, whether or not the address has an account |
| POST | `/auth/email/verify` | anyone (rate limited) | `{email, code}`: sign in, creating the account on first use |
| POST | `/auth/signout` | session | ends this session |
| GET, PATCH, DELETE | `/me` | session | account, plan and limits used; change display name; delete account |
| POST | `/me/identities` | session | add a sign-in method (same bodies as sign-in) |
| GET | `/me/library` | session | custom audio library, newest first: `{"audio":[{mediaId, title, durationSec, bytes, createdAt, usedBy}]}`, ETag (section 10.4) |
| POST | `/me/library` | session | raw M4A body, `Content-Type: audio/mp4`, `X-Media-Title` (percent-encoded UTF-8, at most 200 characters), same checks as section 10.1 → `{mediaId}` |
| DELETE | `/me/library/{mediaId}` | session (uploader) | removes the file from the library → `204`; days that use it keep playing it |
| POST | `/me/export` | session | emails a data export link to the account's email → `202`; at most 1 per day (section 17) |
| PUT, DELETE | `/me/devices/{installId}` | session | push registration `{platform, pushToken, locale, timeZone, kinds}`; `DELETE` on sign-out (section 18) |
| GET | `/sync` | session | manifest `{"events":[{id, rev, role, childSeq}]}`, ETag |
| POST | `/events/fetch` | session | `{ids}` (at most 100): documents projected by role |
| GET | `/events/{id}` | owner, member | one document, ETag |
| PUT | `/events/{id}` | session | create (owned-event limit applies); repeating with the same owner returns the current document |
| PATCH | `/events/{id}` | owner, editor | `{baseRev, patch}` → `{event, overwritten}` |
| DELETE | `/events/{id}` | owner | delete the event, its memos, links, invites, members and media |
| PATCH | `/events/{id}/membership` | member | `{archived, reminders}`: the member's own archive and reminders; never shown to others |
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
| POST | `/events/{id}/media` | owner, editor | backdrop files: raw body, `Content-Type`, `X-Media-Kind: still|motion` → `{mediaId, url}`. Custom audio goes to `POST /me/library` |
| GET | `/audio/catalog` | anyone | built-in tracks, ETag, cacheable |
| GET | `/audio/{id}?event=` or `?link=` | see section 10.3 | a built-in track or a custom audio file |
| POST | `/purchases/apple` | session, or none for a guest | `{signedTransactions}` (JWS from StoreKit 2) → `{plan, expiresAt}` |
| POST | `/purchases/google` | session, or none for a guest | `{productId, purchaseToken}` → `{plan, expiresAt}` |
| POST | `/purchases/apple/notifications` | Apple (signed payload) | App Store Server Notifications V2 |
| GET | `/live?event={id}` or `/live?link={token}` | as for reads | WebSocket upgrade, `ws` mode only |
| GET | `/admin/storage?order=bytes_desc\|files_desc\|last_active_desc&limit=50&after=` | operator (`ADMIN_TOKEN`) | storage report per account, default `bytes_desc` (section 14) |
| GET | `/holidays/{region}/{year}` | anyone | draft (smart days): public holiday set of a region, ETag, cacheable |
| GET | `/smart/catalog` | anyone | draft (smart days): seasonal templates with their season windows, ETag, cacheable |
| POST | `/internal/daily` | `CRON_SECRET` (vercel only) | runs the daily job |

Page routes (HTML): `GET /e/{token}` (public link: the event, view only); `GET /i/{token}` and `GET /s/{eventId}` (generic landing pages that open the app, identical for every token or id, design D17); `GET /export/{token}` and `GET /export/{token}/{file}` (data export, section 17); `GET /admin/storage` (operator page). `POST /auth/apple/callback` receives Sign in with Apple's form POST for the Android app and redirects to the app (section 8); it sets no cookie. Self-host only: `GET /m/{file}`.

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
- Anyone, no session. `live.url` is null in `poll` mode. ETag over `event` and `live` (not `serverTime`), `Cache-Control: no-cache`; a matching `If-None-Match` answers `304`.
- A deleted event answers `410 deleted`, a revoked link `410 revoked`, an expired link `410 expired` (checked in that order), with no event details; every token in one of these states gets the same bytes apart from `X-Request-Id`. An unknown, malformed or purged token answers `404 not_found`; the format (`[A-Za-z0-9_-]{22}`) is checked before any store access.

Not found looks the same (task 3.9): `GET /links/{token}`, `GET /invites/{token}` and `POST /invites/{token}/join` answer an unknown, malformed or purged token with byte-identical responses (status, headers and body `{"error":{"code":"not_found","message":"Not found","details":null}}`) apart from `X-Request-Id`, and so does `GET /events/{id}` for an unknown, malformed or purged id. The invite routes check the token format before the session, so a malformed token answers `404` even without one; a well-formed token without a session answers `401`. Member links (`/s/{eventId}`) resolve in the app with `GET /events/{id}`: a member gets the member view with its ETag, a signed-in non-member `403 forbidden` with no event details.
Member view (`GET /events/{id}` for a member) adds `role`, `members: [{"name","role"}]`, and from the membership `archived` (true or false) and `reminders`.

Sharing (`GET /events/{id}/sharing`):
```json
{
  "links": [{"id": "…", "label": "Instagram", "url": "https://<domain>/e/…", "expiresAt": null}],
  "invites": [{"id": "…", "url": "https://<domain>/i/…", "role": "editor", "maxUses": 5, "useCount": 2, "expiresAt": "2026-11-11T15:04:05Z"}],
  "members": [{"accountId": "…", "name": "Mum", "role": "editor", "joinedVia": "…"}],
  "removed": [{"accountId": "…", "name": "Ex"}]
}
```
- Lists the active links and invites (not revoked, not past their expiry; full invites included), oldest first, and the members and removed members by joining time. `joinedVia` is the invite id, or null. An invite whose token cannot be opened under the current `INVITE_KEY` (section 14) is left out. Owner only: others get `403 forbidden`. `Cache-Control: no-store`.

Links and invites (owner only; others `403 forbidden`, a deleted event `410 deleted`; ids are UUIDs, unknown or malformed ones `404 not_found`). Expiry is an ISO-8601 time after now and at most 5 years ahead, or null for never (the app offers 5 days, 30 days, never and a custom date):
- `POST /events/{id}/links` `{"label": "Instagram", "expiresAt": null}` (both optional; label 1 to 100 characters or null; expiry default never) → `201` with the link `{"id", "label", "url", "expiresAt"}`. An eleventh active link answers `429 quota_exceeded` with `details.limit` = `links_per_event`.
- `PATCH /links/{linkId}` `{"label"?, "expiresAt"?}` → `200` with the link. A revoked link answers `410 revoked`, an expired one `410 expired` (it cannot be revived). `DELETE /links/{linkId}` revokes for good → `204`, also when repeated.
- `POST /events/{id}/invites` `{"role": "editor", "maxUses": 5, "expiresAt": "…"}` (`role` required; `maxUses` 1 to 100 or null for unlimited, default 1; expiry default 30 days) → `201` `{"inviteId", "url"}`. A twenty-first active invite answers `429 quota_exceeded`, `details.limit` = `invites_per_event`.
- `PATCH /invites/{inviteId}` `{"role"?, "maxUses"?, "expiresAt"?}` → `200` with the invite as listed. A use count at or below the uses taken makes the invite full. Revoked: `410 invite_revoked`; expired: `410 invite_expired`. `DELETE /invites/{inviteId}` → `204`, also when repeated.

Invite state (`GET /invites/{token}`, session): `{"state": "open", "eventTitle": "Our wedding", "ownerName": "Mum", "role": "editor"}`, with an ETag (`private, no-cache`); it takes no use.
- `state`: `owner` and `member` (the caller has the event, whatever the invite's state), `removed` (blocked until "allow again"), then `revoked`, `expired`, `full` (no uses left, or the event has 100 members), else `open`.
- `eventTitle` and `ownerName` are set only for `open`, `owner` and `member`; `role` is the invite's role for `open`, the caller's role for `member`, else null. A deleted event answers `410 deleted`. Without a session `401`.

Join (`POST /invites/{token}/join`, session) → `200` `{"eventId": "…", "url": "https://<domain>/s/{eventId}"}`: a new member takes one use; owners and members take none. Refusals: removed `403 forbidden` ("Ask the owner to invite you again"), `410 invite_revoked`, `410 invite_expired`, `410 invite_full`, `410 deleted`, `429 quota_exceeded` with `details.limit` = `members_per_event`.

Members (owner only): `PUT /events/{id}/members/{accountId}` `{"role": "viewer"}` → `200` `{"accountId", "name", "role", "joinedVia"}`; `404` when the account is not a viewer or editor. `DELETE /events/{id}/members/{accountId}` removes and blocks rejoining → `204` (also when already removed; `404` for an account that is not on the event). `DELETE /events/{id}/members/me` is a viewer or editor leaving → `204` (the owner gets `403`). `DELETE /events/{id}/removed/{accountId}` ("allow again") → `204`; the account can then join through an invite.

Every change above (link or invite created, changed or revoked, a join, a role change, a removal, leaving, "allow again") publishes `{"type": "access"}` to the event (section 9). Removed members and leavers lose the event from their manifest, and their reads and writes answer `403 forbidden` from the next request.

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

Library (`GET /me/library`):
```json
{"audio": [{"mediaId": "Qm7…", "title": "First dance", "durationSec": 214, "bytes": 2580000, "createdAt": "2026-10-12T15:04:05Z", "usedBy": 2}]}
```

Sign-in (`POST /auth/token`, `POST /auth/email/verify`) → `200`; `created` is true when this sign-in created the account:
```json
{"session": "st_…", "account": {"...": "as GET /me"}, "created": true}
```

Account (`GET /me`; also the answer to `PATCH /me` and `POST /me/identities`). `usage` counts what the account uses of each counted feature; `limits` is the effective plan's row of the plan table (0 = not included, null = no limit); `planExpiresAt` null = no end:
```json
{"id": "…", "displayName": "Mum", "plan": "free", "planExpiresAt": null,
 "identities": [{"provider": "google", "email": "mum@example.com"}, {"provider": "apple", "email": null}],
 "usage": {"events": 2, "photos": 0, "animated_backdrop": 0, "custom_audio": 0, "spotify_events": 1},
 "limits": {"events": 10, "photos": 5, "animated_backdrop": 0, "premium_audio": 0, "custom_audio": 0, "spotify_events": 3},
 "createdAt": "2026-10-12T15:04:05Z"}
```
`PATCH /me`: `{"displayName": "Mum"}` (title rule, 1 to 100 characters). `POST /me/identities` returns `409 conflict` when the method belongs to another account.

Fetch (`POST /events/fetch`): `{"events": [EventDoc, …]}`, each projected by the caller's role. Ids that are unknown, deleted or not readable by the caller are left out; the manifest already tells the client what went.

Memos: `PUT /events/{id}/memos/{memoId}` with `{"content": "…", "milestoneTag": "Day 100", "createdAt": "…"}` → the memo (section 7.2) with `201` when new, `200` when the id already exists on this event; `PATCH` with `{"patch": {"content": "…", "milestoneTag": null}}` → the memo (null clears `milestoneTag` only); `DELETE` → `204`.

Revisions page (`GET /events/{id}/revisions`): `{"revisions": [Revision, …], "next": 9}`; `next` is the `before` of the next page, null at the end.
- `limit` 1 to 50 (default 50), `before` a rev (whole number from 1); anything else answers `400 invalid_payload`. `Cache-Control: no-store`.
- The owner sees every change. An editor sees only shared fields: `changes` and `overwrote` leave owner-only fields out, and a revision that changed only owner-only fields is left out of the editor's pages (pages stay full). Viewers get `403 forbidden`; public links have no history.
- `changes[].from` and `to` are the old and new values; null means absent (cleared). `author` is null once the author deleted their account. `restoredFrom` is the rev a restore brought back, else null.

Restore (`POST /events/{id}/restore`, owner or editor): `{"rev": 4}` → `200` with the patch answer `{"event": …, "overwritten": […]}`.
- Brings back the shared fields as they were at `rev`, for the owner too; owner-only fields keep their current values. `unitMode` and `recurrence` that were absent at `rev` come back as `"auto"` and `{"type": "none"}` (they cannot be cleared).
- The changed fields are written as one new revision with `restoredFrom` = `rev`; earlier revisions stay. When the shared fields already match, nothing is written and the rev stays.
- It goes through the same write path as `PATCH /events/{id}`: validation (a value the rules no longer accept answers `400 invalid_payload` naming the field), role checks, plan gates (tasks 3.10 and 3.12) and the live `rev` notice.
- A `rev` above the current rev, or one whose later revisions were pruned (all revisions after `rev` are needed), answers `400 invalid_payload` with `details.field` = `rev`. Viewers get `403 forbidden`.

Status codes without a body of their own: `PUT /events/{id}` `201` when created, `200` with the current document when it exists; `DELETE /events/{id}` `204`; `POST /auth/signout` `204`; `DELETE /me` `204`; `POST /auth/email/start` `202` with no body; `DELETE /links/{linkId}`, `DELETE /invites/{inviteId}`, `DELETE /events/{id}/members/{accountId}` and `DELETE /events/{id}/removed/{accountId}` `204`.

Membership (`PATCH /events/{id}/membership`):
```json
{"archived": true, "reminders": {"daysBefore": [1], "time": "09:00"}}
```

Storage report (`GET /admin/storage`):
```json
{"rows": [{"accountId": "…", "displayName": "Mum", "plan": "premium",
           "files": {"still": 41, "motion": 12, "audio": 7},
           "bytes": {"media": 98123456, "documents": 412000}, "totalBytes": 98535456,
           "lastActiveAt": "2026-10-11T08:00:00Z"}],
 "next": "…"}
```

### 7.5 Error codes

| HTTP | `code` | Meaning |
| :--- | :--- | :--- |
| 400 | `invalid_payload` | Validation failed. `details.field` names the field |
| 400 | `invalid_code` | Email code wrong, expired or out of attempts |
| 401 | `unauthorized` | No session, expired session, bad ID token, or a missing or wrong operator token |
| 402 | `premium_required` | The writer's plan does not include this. `details.feature` names it (`animated_backdrop`, `premium_audio`, `custom_audio`, `photos`, `spotify_events`, `events`) |
| 403 | `forbidden` | Role too low, not a member, or removed |
| 403 | `field_not_allowed` | Non-owner wrote an owner-only field |
| 404 | `not_found` | Unknown, malformed or purged id or token. Identical for all of these |
| 409 | `conflict` | Event or memo id already used by another account |
| 410 | `revoked`, `expired`, `deleted` | Link or export link revoked or expired, event deleted |
| 410 | `invite_full`, `invite_expired`, `invite_revoked` | Invite has no uses left, is past its expiry, or was revoked |
| 413 | `payload_too_large` | Body or file over its limit |
| 415 | `unsupported_media_type` | Wrong content type, or file content does not match |
| 429 | `rate_limited` | Too many requests (including a second data export on the same day), `Retry-After` set |
| 429 | `quota_exceeded` | A count limit that no plan raises (paid limits, links per event, members per event). `details.limit` names fixed limits: `memos_per_event`, `links_per_event`, `invites_per_event`, `members_per_event`; `details.feature` names plan limits |
| 500 | `internal_error` | `details.requestId` set |
| 503 | `service_unavailable` | Maintenance mode or provider limit reached |

---

## 8. Accounts, sessions, plans and purchases

- **Google and Apple** (app): Credential Manager and Google Sign-In (iOS) for Google; AuthenticationServices (iOS) and an in-app browser tab (Android) for Apple. The app sends the ID token and its nonce; the core checks signature (RS256, JWKS cached per instance), `iss` (`https://accounts.google.com` or `accounts.google.com`; `https://appleid.apple.com`), `aud` (one of `GOOGLE_CLIENT_IDS` or `APPLE_CLIENT_IDS`), `exp` (one minute of clock skew allowed) and `nonce`. Nonce rule: a Google token's `nonce` claim is the app's nonce as sent; an Apple token's `nonce` claim is the lower-case hex SHA-256 of the app's nonce (the app gives Apple the hash, on iOS and in the Android web flow). Every failure answers `401 unauthorized` with the same message. Only emails the provider marks verified (`email_verified` true or `"true"`) link accounts.
- **Sign in with Apple on Android**: the app opens Apple's authorize URL in an in-app browser tab with `response_mode=form_post`, its own `state` and the SHA-256 of its nonce. Apple posts `code`, `id_token`, `state` and, on first sign-in, `user` to `POST /auth/apple/callback`. The core stores nothing there and answers `303` with `Location: intent://auth/apple?code=…&id_token=…&state=…&user=…&error=…#Intent;scheme=<APP_SCHEME>;end` (only those fields, when present; `APP_SCHEME` defaults to `daysthatmatter`). The app checks `state` and signs in with `POST /auth/token` like iOS. No cookie and no browser session: the web has no sign-in (design D17).
- **Email codes**: the address is trimmed and lower-cased. A 6-digit code from a CSPRNG is stored as an HMAC with `EMAIL_CODE_KEY`, valid 10 minutes, dead after 5 wrong attempts. Each try is counted before the code is compared, so parallel guesses stay within the 5; a right code works once; a new request replaces the old code. When the mail provider refuses, `POST /auth/email/start` answers `503 service_unavailable`. Limits: 5 codes per address per hour, 20 per IP per hour. The response never says whether an account exists. The email contains only the code and the app name.
- **Linking**: a new identity whose verified email matches an existing verified identity joins that account. `POST /me/identities` adds a method explicitly.
- **Sessions**: `st_` + 43 chars base64url (256 bits), stored as SHA-256. Valid until 90 days after last use.
- **Activity**: an authenticated request sets `accounts.last_active_at` (at most one write per day) and clears `inactive_notice_1_at` and `inactive_notice_2_at` (section 17).
- **First sign-in on a device**: the app uploads local events (`PUT /events/{id}`) and memos. Uploads above the owned-event limit are accepted for this first upload only, so nothing local is lost. The app marks them with `PUT /events/{id}?firstUpload=1&createdAt=<ISO-8601 local creation time>`. The limit is skipped only while the session is less than 24 hours old, `createdAt` is before the session started (pre-sign-in local data), and fewer than 500 of the owner's events were uploaded this way since the session started; such events get `events.first_upload_at`. Otherwise, and for every request without the flag, the limit applies: `402 premium_required` (`details.feature` = `events`) when a higher plan allows more, `429 quota_exceeded` when none does. Known residual risk: a client can forge `createdAt` and sign in again to upload past the limit; the rate limits (task 3.13) and the operator storage report bound it.
- **Deletion**: deletes owned events (with revisions, memos, links, invites, members, media), the account's memberships, uploads (library included), identities, sessions, grants, exports and devices. Inactive accounts are deleted the same way (section 17). Revisions they authored on other events keep `author_id = NULL`. Store subscriptions are not cancelled by the backend; the app tells the user how.
- **Purchases (native)**:
  - Apple: the app buys with StoreKit 2 (Swift bridge) and sets `appAccountToken` to the account id when signed in. It sends `jwsRepresentation` of each current entitlement to `POST /purchases/apple`. The core verifies the JWS signature and `x5c` chain to Apple Root CA G3, `bundleId` and `environment`, then stores the purchase. App Store Server Notifications V2 (signed the same way) report renewals, grace periods, expiry and refunds.
  - Google: the app buys with Play Billing Library and sends the purchase token. The core gets an OAuth token for the service account (RS256 JWT, cached 1 hour), calls `purchases.subscriptionsv2.get`, acknowledges new purchases and stores the result.
  - Guests: purchases are stored with `account_id = NULL`; the app sends them again after sign-in to attach them. "Restore purchases" resends current entitlements.
  - Plan: the highest plan among the account's active or grace purchases and active grants. The daily job re-checks purchases past `expires_at` (App Store Server API status, Play API) and grants past `ends_at`. A gated write whose plan looks expired triggers one re-check before rejecting.
- **Promotions (grants)**: the operator gives an account a plan for a period without a store purchase, for example one month of Premium, by adding a `grants` row with the provider's own tools (an SQL insert on D1, SQLite and Turso; the console on Firestore; exact commands in each variant's README). The same command sets the account's `plan` and `plan_expires_at` to the highest of its purchases and grants, so requests read no extra rows; the daily job does the same for grants that ended. When a grant ends, the lapsed-plan rule applies: nothing added during the grant is removed or hidden; only adding more above the plan's limits is blocked.
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
| `audio` (custom audio, uploaded to the library with `POST /me/library`) | M4A (AAC), no video track | 4 MB |

Client side:
- Still: Android decodes with `ImageDecoder` and encodes WebP (quality 80, lower in steps); iOS uses an ImageIO thumbnail at 2048 px and JPEG quality 0.82, lower in steps. There is no web upload (design D17).
- iPhone Live Photo: `PHAssetResource` gives the key photo and the paired video (MOV, often HEVC, with sound). `AVAssetExportSession` with an H.264 1280 px preset and a composition without the audio track produces the motion part.
- Google Motion Photo: the XMP `Container:Directory` (or legacy `MicroVideoOffset`) gives the offset of the MP4 appended to the JPEG or HEIC file. The app cuts it out and runs Media3 Transformer (H.264, 1280 px, audio removed). Files without this metadata are treated as stills.
- Custom audio: iOS `AVAssetExportSession` (Apple M4A preset), Android Media3 Transformer (audio only, AAC). The app picks a bitrate so the result is at most 4 MB (96 kbps gives about 5.5 minutes) and asks for a section when the file is longer.

Server side (core, no decoding):
1. Check size against the kind's limit before reading the whole body when `Content-Length` is present.
2. Identify the type from magic bytes and compare with `Content-Type`.
3. Read dimensions (JPEG SOF, WebP VP8/VP8L/VP8X, MP4 `tkhd`), duration (`mvhd`) and codecs (`avc1`, `mp4a`). Reject `motion` with a sound track or a `©xyz` location atom, and `audio` with a video track.
4. Remove JPEG APP1 to APP15 segments except ICC, and WebP `EXIF` and `XMP ` chunks.
5. Check the uploader's plan and counts (`photos`, `animated_backdrop`, `custom_audio`) and the hourly upload limit.
6. `BlobStore.put`, insert the `media` row, and add its bytes to `accounts.media_bytes` and 1 to `accounts.media_files` in the same write. Backdrop files get `unused_since = now` until an event references them. Library audio starts with `unused_since` NULL, because the library uses it.

Serving: backdrops from the media origin with `Cache-Control: public, max-age=86400` and `X-Content-Type-Options: nosniff`. The daily job deletes files with `unused_since` older than 24 hours and subtracts them from the uploader's counters. Display: the still first; for animated, `<video muted playsinline poster=still>` plays once on load and on tap, then shows the still; under `prefers-reduced-motion` the video element is not created. Blur: CSS `filter: blur()` on the backdrop layer with the radius `backdrop.blur × card width / 390`. The app uses `Modifier.blur` on Android 12 and later and iOS, and draws a pre-blurred, downscaled bitmap below Android 12.

### 10.2 Built-in catalog

`backend/core/audio/catalog.json`:
```json
{"tracks": [{"id": "calm-lofi", "title": "Calm Lo-Fi", "artist": "…", "durationSec": 184, "tier": "free", "bytes": 2950000}]}
```
Files are AAC (`.m4a`), at most 4 MB, stored at `audio/{id}.m4a`, uploaded by the operator with the variant's deploy tooling. Tracks are public domain recordings. The catalog ships with the core, so changing it is a deploy, not an app release.

### 10.3 Audio access (`GET /audio/{id}`)

- Free built-in track: anyone, `Cache-Control: public, max-age=604800`.
- Premium built-in track: a caller whose plan includes `premium_audio`, or a caller who names an event it can read (`?event=` with a session, `?link=` with an active public link) whose audio is this track. `Cache-Control: private, max-age=604800`. Otherwise `402 premium_required`.
- Custom audio file: the uploader (library preview, without `?event=`), and the owner and members of an event that uses it (`?event=` with a session). Never through a public link or on a web page. Otherwise `404 not_found`.
- Served by streaming `BlobStore.get`, so it works on every variant. The app caches files, so each device downloads a file once.

### 10.4 Custom audio library

- The library is the account's `media` rows of kind `audio` with `library_removed_at IS NULL`, newest first. `usedBy` counts events (not deleted) whose `audio_media_id` is the file.
- A `{"kind":"custom","mediaId"}` audio write needs a file the writer uploaded and still has in their library, and a writer's plan that includes `custom_audio` (else `402 premium_required`, also for a file already in the library). It sets `events.audio_media_id` and clears the file's `unused_since`.
- `DELETE /me/library/{mediaId}` sets `library_removed_at`. Days that use the file keep it. When the file is out of the library and no event uses it (after this delete, an audio change, or an event deletion), the core sets `unused_since = now`; the daily job deletes it 24 hours later.
- Plan count `custom_audio`: the uploader's audio rows with `unused_since IS NULL`, that is, in the library or used by a day. Removing a file frees the slot only when no day uses it; the app says so.
- The library list is per account. Members never see another account's library, and `GET /me/library` returns only the caller's files.
- Spotify links are never library entries.

---

## 11. Limits

### 11.1 Plan table (initial values)

The plan table in `:core:model` is the source of truth; [`docs/features/premium/SPEC.md`](../features/premium/SPEC.md) lists the same values. Counts are per account: owned events count the owner's events; the others count what the account added.

| Limit | Free | Premium | Premium Plus |
| :--- | :--- | :--- | :--- |
| Owned events | 10 | 500 | as Premium until decided |
| Photo backdrops in use (still or animated) | 5 | 300 | |
| Animated photos in use | 0 | 30 | |
| Custom audio files in use (in the library or used by a day) | 0 | 20 | |
| Built-in tracks | free tracks | all | |
| Spotify events (set by the account) | 3 | no separate limit | |

### 11.2 Fixed limits (all plans)

| Limit | Value |
| :--- | :--- |
| Title | 1 to 100 characters |
| Notes | 4,000 characters |
| Memo text | 10,000 characters |
| Event document | 16 KB, counted in UTF-8 bytes after a patch is merged (`EventValidation.checkDocumentSize`). Per-field limits count characters, so four-byte characters in notes alone can pass them and still exceed 16 KB; the size check after the merge is what rejects it. |
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
| Custom audio title | 200 characters |
| Data export requests | 1 per day per account; link valid 30 days, or until the deletion date for inactive accounts |
| Inactive account | 24 months without signed-in use (placeholder, owner to confirm); emails at 0 and 3 months; deletion at 6 months |
| Operator API | 60 requests per hour per IP |
| Push devices | removed 90 days after the device last contacted the backend |
| Change notifications | 1 per hour per person per day |
| Offers and news notifications | 2 per month per device, opt-in |

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

## 13. Language decision

Decided by the owner on 2026-10-14 without a spike: `backend/core` is TypeScript (design D1). No measurements were taken. The table is kept for a later comparison, which design D1 describes (same two routes, link read and event patch, on a Workers Free preview).

| Build | Worker startup | Warm CPU p50 | Bundle (gzip) |
| :--- | :--- | :--- | :--- |
| TypeScript | not measured | not measured | not measured |
| Kotlin/JS | not measured | not measured | not measured |

If Kotlin/JS is adopted later, the backend must also load the `@js-joda/timezone` npm package: `kotlinx-datetime` on JS ships no time zone data, so every named zone fails without it (`:core:model` loads it for its own JS tests). Revisit when a trigger in design D1 fires. Kotlin/JS would be worth choosing only with warm CPU at most 1.25 times TypeScript, startup at most 100 ms and a bundle of at most 1 MB gzip.

---

## 14. Security, testing and operations

Security:
- Tokens: public link `[A-Za-z0-9_-]{22}` (128 bits, clear text); invite same format, stored as SHA-256 plus AES-GCM ciphertext under `INVITE_KEY`; data export same format, stored as SHA-256; session `st_` + 43 chars, stored hashed; email codes as HMAC. Token format is checked before any store access.
- Invite ciphertext (`invites.token_enc`): `v1.` + base64url(12-byte random IV ‖ AES-256-GCM ciphertext with its tag), the key derived with HKDF-SHA-256 from the `INVITE_KEY` text (empty salt, info `days-that-matter invite token v1`), the invite id as additional data, so a ciphertext only opens for its own row. Changing `INVITE_KEY` keeps every invite joinable (lookup is by hash), but their URLs can no longer be shown: the sharing list leaves them out until they expire or the owner makes new ones.
- Operator token: `ADMIN_TOKEN`, at least 32 random bytes, a deployment secret. Sent only as `Authorization: Bearer`, compared in constant time, never in URLs, logs or the apps. Unset means the operator routes answer `401` to everyone. The `/admin/storage` page keeps the token in memory only (no storage, no cookie). 60 requests per hour per IP. Rotate by changing the secret.
- The share web sets no cookies and has no forms (design D17).
- Page headers: `Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: https://media.<domain>; media-src 'self' https://media.<domain>; font-src 'self'; connect-src 'self' wss://<domain>; form-action 'none'; base-uri 'none'; frame-ancestors 'none'; frame-src 'none'; object-src 'none'; upgrade-insecure-requests`, plus `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Strict-Transport-Security: max-age=31536000`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- HTML escaping and the JSON data blob rules are unchanged from `services/share/` (`SHARE_SERVICE.md` section 7.1).
- Logs: one JSON line per request with `ts`, `route`, `status`, `reqId`, `rateLimited`. Never bodies, titles, memo text, emails, codes, tokens, cookies, `Authorization`, purchase tokens, push tokens, IPs or Spotify URLs.

Testing (details in [`TESTING_STRATEGY.md`](../standards/TESTING_STRATEGY.md)):
- `:core:model` tests on every target; core unit tests.
- Store conformance suite against each `Store` (SQLite, Firestore emulator).
- HTTP conformance suite in `backend/core/conformance/` against each variant: `wrangler dev`, the self-host container, the Vercel handler on Node with a libSQL file, the Firebase emulators.
- Purchase verification against recorded sandbox payloads (Apple JWS, notifications) and a fake Google API.
- Countdown vectors generated from `:core:model`; `countdown.js` must pass them. Also the generated contract checks (task 2.8).

Operations:
- Maintenance: `MAINTENANCE=1` makes writes return `503`; reads keep working.
- Takedown: revoke the reported link, or remove the reported media or custom audio file (clear it from the event, delete the blob), and for repeat copyright reports set `accounts.audio_blocked = 1`, with the provider's own tools (an SQL statement for D1, SQLite and Turso; the console for Firestore and the blob store). Each variant's README holds the exact commands, also for grants (section 8) and offers and news (section 18). A minimal operator API: the storage report only.
- Storage report: `GET /api/v1/admin/storage?order=bytes_desc|files_desc|last_active_desc&limit=50&after=` and the page `/admin/storage` (asks for the token, shows a sortable table; same-origin `admin.js` only). Rows: `{accountId, displayName, plan, files: {still, motion, audio}, bytes: {media, documents}, totalBytes, lastActiveAt}`. `bytes_desc` (default) orders by `accounts.media_bytes`, `files_desc` by `media_files`, `last_active_desc` by `last_active_at`, each one index read on every store. File counts per kind and document bytes (event and memo documents of owned events) are computed for the rows on the page only. `after` is the cursor from the previous page's `next`.
- Daily job: purchase re-checks; grants that ended; inactive account steps (section 17); expired export links; push devices unused for 90 days; media unused for 24 hours; links and invites revoked or expired more than 30 days ago; event tombstones older than 30 days with their revisions and memos; memo tombstones older than 30 days (raising `child_purged_seq`); expired email codes; sessions unused for 90 days; rate counters older than 2 days. Bounded batches of 500 rows.
- Backups: D1 Time Travel (7 days on Free); self-host copies the volume; Turso and Firestore use their own point-in-time recovery.
- CI: one workflow `backend.yml` (see [`WORKFLOW_PIPELINE.md`](../ci-cd/WORKFLOW_PIPELINE.md) section 4).

---

## 15. Owner inputs

Needed before the global launch:
- Domain on a Cloudflare zone, plus `media.<domain>` for R2.
- Apple: Team ID, bundle id, App Store id, a Services ID for Sign in with Apple on Android (return URL `/auth/apple/callback`), a Sign in with Apple private key, subscription products, an In-App Purchase key for the App Store Server API, the notification URL set in App Store Connect, and an APNs auth key for push (change `design-v2-features`).
- Google: OAuth client ids for Android, iOS and the server (the audience of ID tokens), Play subscription products, a service account with Play Console financial access, and a Firebase project with a service account for FCM HTTP v1 (change `design-v2-features`).
- `ADMIN_TOKEN` for the storage report, and the inactive account period (24 months is a placeholder).
- Email provider account and a sending domain with SPF, DKIM and DMARC.
- Licensed audio tracks and the free and Premium split.
- Android package name and signing key fingerprints for `assetlinks.json`. The app currently uses `dev.derek.daysthatmatter` as a provisional application id (debug builds add `.debug`), defined once in `androidApp/build.gradle.kts`. It is permanent once published: confirm or replace it before the first release.
- Abuse contact address, privacy policy owner and jurisdiction.
- Terms of service, privacy policy and disclaimer ([`docs/legal/`](../legal/README.md)), and a DMCA designated agent registered with the US Copyright Office.
- For other providers when used: Turso database and Vercel Blob store; a Firebase project on Blaze.

---

## 16. Regions

A region is one deployment with its own domain, data, sign-in methods, stores and features, reported by `GET /config`. Accounts and data never cross regions. The app picks the region once per install: on iOS from the App Store storefront country, on Android by build (China Android builds go to Chinese stores). The global region is Cloudflare. China would use the self-host variant on a mainland cloud; requirements and open points are in [`CHINA.md`](CHINA.md).

---

## 17. Inactive accounts and data export

Operator notes. Decision: design D18 of the change `pluggable-backend-live-sharing`. Requirements: its `accounts` spec ("Inactive accounts", "Notice before deleting an inactive account", "Data export request", "Data export contents").

### 17.1 Rules

- **Inactive:** no signed-in use for 24 months (placeholder, owner to confirm). Signed-in use is any authenticated request from any device; it sets `accounts.last_active_at` at most once per day and clears both notice columns.
- **Never inactive:** an account with an `active` or `grace` purchase, or a grant whose `ends_at` is in the future.
- **Schedule:**

| When | What happens |
| :--- | :--- |
| Day 0: `last_active_at` older than 24 months, no notice yet | Export link created (reason `inactive`, expires on the deletion date = day 0 + 6 months). Email 1 sent. `inactive_notice_1_at = now`. |
| `inactive_notice_1_at` + 3 months, no notice 2 yet | New export link. Email 2 sent with the deletion date: day 0 + 6 months, or 3 months after email 2 if email 2 went out late. `inactive_notice_2_at = now`. |
| The later of `inactive_notice_1_at` + 6 months and `inactive_notice_2_at` + 3 months | Account deleted exactly like a user-requested deletion (section 8). Its owned days' links show "no longer available". |
| Signed-in use at any point before deletion | Both notice columns set to NULL. The 24 months start again. Export links keep working until they expire. |

- **Data export:** `data.json` (account, owned events with all fields, days shared with the account with shared fields and role, memos, revisions the account authored, sharing settings, library list) plus every file the account uploaded. Page `/export/{token}` lists `data.json` and each file with its own link (`/export/{token}/data.json`, `/export/{token}/files/{mediaId}.{ext}`). `data.json` is built when downloaded, streamed page by page from the store. No ZIP on Workers (10 ms CPU); self-host may offer a ZIP. Links last 30 days (user request) or until the deletion date (inactive).
- **User request:** Settings › Account › "Download my data" calls `POST /me/export`: at most 1 per day, link sent to the account's email address.

### 17.2 Daily job steps

Run inside the daily job, in bounded batches of 500 accounts, after purchase re-checks (so a renewed subscription exempts the account the same day):
1. Accounts with `last_active_at < now - 24 months`, `inactive_notice_1_at IS NULL`, not exempt: create the export, send email 1, set `inactive_notice_1_at`.
2. Accounts with `inactive_notice_1_at < now - 3 months` and `inactive_notice_2_at IS NULL`, not exempt: create a new export, send email 2, set `inactive_notice_2_at`.
3. Accounts with `inactive_notice_1_at < now - 6 months` and `inactive_notice_2_at < now - 3 months`, not exempt: delete the account through the account deletion path. The second condition guarantees 3 months after email 2 even when it went out late.
4. Export rows past `expires_at`: delete.

An account that became exempt after a notice (new subscription or grant) gets both notice columns cleared instead. Month arithmetic is calendar months in UTC. If email sending fails, the step is retried on the next run and the account moves on only once the mail provider accepted the email. On Workers Free a run makes at most 50 subrequests, so it sends at most 40 emails; the rest go out on the following days, and each account's dates count from its own notices.

### 17.3 Email texts

Plain text, in the account's language when known, otherwise English. `{date}` is the deletion date.

Email 1, subject "Your Days That Matter account will be deleted on {date}":
```
You have not used your Days That Matter account since {lastActive}.
We will delete the account, its days, memos and files on {date}.
To keep the account, open the app and sign in before that date.
To download your data first: {exportUrl} (works until {date}).
Why: {termsUrl}
```

Email 2, subject "Reminder: your Days That Matter account will be deleted on {date}":
```
This is the second and last notice.
We will delete your Days That Matter account, its days, memos and files on {date}.
To keep the account, open the app and sign in before that date.
To download your data first: {exportUrl} (works until {date}).
```

Export requested in the app, subject "Your Days That Matter data":
```
Download your data here: {exportUrl}
The link works until {expiryDate}.
```

### 17.4 Check or pause

- Check: accounts with a notice, `SELECT id, last_active_at, inactive_notice_1_at, inactive_notice_2_at FROM accounts WHERE inactive_notice_1_at IS NOT NULL ORDER BY inactive_notice_1_at;` (D1, SQLite, Turso; on Firestore, query `accounts` by `inactiveNotice1At`). Accounts due for notice 1 in the next 30 days: `last_active_at` between now minus 24 months and that plus 30 days.
- Pause everything: set `INACTIVE_JOB=0` in the deployment config. The daily job then skips steps 1 to 3; export expiry still runs. Set it back to `1` to resume; overdue steps run on the next day.
- Keep one account: set its `last_active_at` to now and both notice columns to NULL (one SQL statement, or the console on Firestore). The 24 months start again.
- Open point: what to do when a notice email bounces or the account has no email address. Proposal: keep the schedule; the terms say so.

---

## 18. Notifications

Change [`design-v2-features`](../../openspec/changes/design-v2-features/) (design D6 and D7, `notifications` spec). Feature doc: [`notifications/SPEC.md`](../features/notifications/SPEC.md).

- **Reminders** are local notifications scheduled by the app. The backend only syncs the choices (`reminders`, owner-only on the event or on the membership). No server job.
- **Push kinds** sent by the core: `changes` (someone else changed a day you own or are a member of), `added` (someone added you to a day; no trigger until adding people by name is decided) and `offers` (offers and news, opt-in, at most 2 per month per device).
- **Devices:** `PUT /me/devices/{installId}` `{platform, pushToken, locale, timeZone, kinds}` after sign-in and when any value changes (at most once per day otherwise, to refresh `last_seen_at`). `DELETE` on sign-out. Tokens are removed on sign-out, when APNs answers `410` or `400 BadDeviceToken` or FCM answers `UNREGISTERED`, and by the daily job after 90 days without contact.
- **Changes:** after an accepted event write or restore, recipients are the owner and members except the author, minus anyone who archived the day, minus devices without `changes`. One `rate_counters` key per person and event with a 1-hour window keeps it to one notification per day per person per hour. Text: "{editor} changed the {field} of {title}", in the device's locale. Never notes or memo text.
- **Delivery:** APNs `POST https://api.push.apple.com/3/device/{token}` over HTTP/2 with an ES256 provider token (reused up to 1 hour); FCM HTTP v1 `POST https://fcm.googleapis.com/v1/projects/{project}/messages:send` with an access token from the service account (cached 1 hour). Both are outbound `fetch` from the core, enabled by configuration.
- **Cost on Cloudflare:** sending runs after the response (`waitUntil`). Workers Free allows 50 subrequests per invocation, so fan-out past 40 sends continues in the event's `EventRoom` Durable Object, 40 per alarm. Whether Workers `fetch` reaches APNs over HTTP/2 needs a spike (task 3.1 of the change); the fallback is FCM for both platforms.
- **Other variants:** self-host, Vercel and Firebase run on Node, which speaks HTTP/2 (`node:http2`); no subrequest limit.
- **Offers and news:** the operator sends them with a runbook command per variant. The core skips devices without `offers` and devices that got 2 that month.
- **China:** no FCM; see [`CHINA.md`](CHINA.md) open points.
