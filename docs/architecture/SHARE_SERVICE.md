# Share Service Architecture & API Contract

Status: design, not yet implemented. Feature behavior is in [`docs/features/sharing/SPEC.md`](../features/sharing/SPEC.md). Build order is in [`docs/plans/SHARE_SERVICE_IMPLEMENTATION_PLAN.md`](../plans/SHARE_SERVICE_IMPLEMENTATION_PLAN.md).

This document is the contract for the three parallel implementers. Where it says MUST, deviations need a doc change in the same PR.

---

## 1. Decision

The share service is a small web service on **Cloudflare Workers Free** with **D1** and **Workers Static Assets**. TypeScript, Hono, zod, vitest with `@cloudflare/vitest-pool-workers`, wrangler. It lives in `services/share/`.

It serves:
- the public share page `https://daysthatmatter.app/e/{shareToken}` (live ticking countdown, smart banners, Open Graph tags),
- the App Links / Universal Links association files,
- a REST API under `/api/v1` that the app uses to create, read, update and revoke shares.

Why Cloudflare and not the alternatives:

| Option | Result |
| :--- | :--- |
| Cloudflare Workers + D1 + Static Assets | Chosen. Free, no inactivity pause, custom domain, SQLite data that is easy to move. |
| Supabase Free | Rejected. Projects pause after about a week of inactivity, which silently breaks old share links. No custom domain on the free plan, which breaks App Links. |
| Firebase Hosting + Firestore (previous spec) | Rejected for sharing. Security rules cannot express hashed manage tokens, and the old rule `allow read: if true` allowed listing every share. Cloud Functions need the paid Blaze plan. |

Firebase stays in the app for account sync (see [`PERSISTENCE_AND_SYNC.md`](PERSISTENCE_AND_SYNC.md)). The share service does not depend on Firebase in v1.

---

## 2. Architecture

```
 App (KMP, Ktor client)                 Browser / link preview bots
        |  /api/v1/*                           |  /e/{token}
        v                                      v
 +--------------------------------------------------------+
 |  Cloudflare, zone daysthatmatter.app                    |
 |                                                         |
 |  Static Assets (no Worker run, free, unlimited)         |
 |    /  /assets/*  /.well-known/*  /favicon*  /og/*       |
 |                                                         |
 |  Worker (Hono)    run_worker_first: /e/*, /api/*        |
 |    GET /e/:token     -> HTML (server-rendered)          |
 |    /api/v1/*         -> JSON                            |
 |    scheduled()       -> nightly purge                   |
 |                                                         |
 |  D1 (SQLite)   binding DB                               |
 +--------------------------------------------------------+
```

Rules:
- Only `/e/*` and `/api/*` invoke the Worker. Everything else is a static asset. `run_worker_first` MUST be `["/e/*", "/api/*"]`.
- The share page is rendered by the Worker with the event data inlined as JSON, so a page view costs 1 Worker request and the page needs no network call after load (CSP `connect-src 'none'`). Link preview bots (WhatsApp, iMessage, Slack, X) get per-event Open Graph tags from the same response.
- The Worker never generates images. The Open Graph image is a static branded image under `/og/`.
- The wasm web app, if hosted on the same origin, lives under `/app/`. The prefix `/e/` and `/api/` are reserved for the share service.

---

## 3. Repository layout (`services/share/`)

```
services/share/
  README.md                 (C) how to run, test, deploy
  package.json              (C) scripts: dev, test, typecheck, lint, deploy, migrate
  package-lock.json         (C)
  tsconfig.json             (C)
  wrangler.jsonc            (C) bindings, assets, cron, routes, environments
  vitest.config.ts          (A)
  migrations/               (A) D1 SQL migrations, numbered: 0001_init.sql
  schema/                   (A) share-payload.v1.schema.json (JSON Schema, shared with the app and the page)
  src/                      (A) Worker code
    index.ts                  Hono app, route registration, scheduled handler
    routes/shares.ts          /api/v1/shares routes
    routes/health.ts
    routes/page.ts            (B) GET /e/:token handler, calls render
    lib/tokens.ts             token generation, SHA-256, constant-time compare
    lib/validate.ts           zod schemas, payload sanitizing
    lib/ratelimit.ts          D1 counters, optional binding
    lib/errors.ts             error envelope
    lib/headers.ts            security headers middleware
    lib/db.ts                 prepared statements
    lib/purge.ts              nightly purge
    page/render.ts          (B) HTML templates (hono/html, auto-escaped)
    page/og.ts              (B) Open Graph tag builder
  public/                   (B) static assets
    index.html                landing page for /
    gone.html, error.html     static fallbacks
    assets/share.css          tokens copied from design/v1/css/styles.css
    assets/countdown.js       client countdown (ES module, no dependencies)
    assets/*.woff2            self-hosted fonts
    og/default.png            1200x630
    .well-known/assetlinks.json
    .well-known/apple-app-site-association
    _headers                  content types and cache headers
  test/
    api/                    (A) API, auth, limits, purge tests
    page/                   (B) page rendering, XSS corpus, header tests
    fixtures/countdown-vectors.json  (B) golden vectors, see section 9
```

File ownership. Implementers MUST NOT edit files owned by another, except to resolve a merge conflict agreed in the PR.

| Owner | Branch | Owns |
| :--- | :--- | :--- |
| A: API, D1, migrations, tests | `feat/share-api` | `src/index.ts`, `src/routes/shares.ts`, `src/routes/health.ts`, `src/lib/*`, `migrations/`, `schema/`, `vitest.config.ts`, `test/api/` |
| B: web page, static assets, well-known, OG | `feat/share-web` | `src/routes/page.ts`, `src/page/*`, `public/**`, `test/page/`, `test/fixtures/` |
| C: CI, wrangler, deploy docs, service README | `chore/share-ci` | `.github/workflows/share-service.yml`, `services/share/wrangler.jsonc`, `package.json`, `package-lock.json`, `tsconfig.json`, `README.md`, deploy sections of this doc |

Interfaces between owners:
- B calls the data access function `getShareByToken(db, token, nowSeconds)` exported from `src/lib/db.ts` (owner A). Its return type is the `ShareLookup` union in section 6.6. A MUST publish this function and its type first (milestone M1) so B can code against it.
- `src/index.ts` (A) mounts `pageRoutes` from `src/routes/page.ts` (B). Until B lands, A mounts a stub that returns 404.
- C owns `wrangler.jsonc`. A and B request binding or config changes through C.

---

## 4. Data model (D1)

Migration `migrations/0001_init.sql`. Times are unix seconds (UTC).

```sql
CREATE TABLE shares (
  id             TEXT PRIMARY KEY,               -- uuid v4, internal only, never returned
  token_hash     TEXT NOT NULL UNIQUE,           -- hex SHA-256 of shareToken
  manage_hash    TEXT NOT NULL,                  -- hex SHA-256 of manageToken
  install_id     TEXT NOT NULL,                  -- client-generated uuid, quota key only
  schema_version INTEGER NOT NULL,
  payload        TEXT NOT NULL,                  -- JSON, canonical, <= 8192 bytes; '{}' after revoke
  payload_bytes  INTEGER NOT NULL,
  access_mode    TEXT NOT NULL DEFAULT 'view' CHECK (access_mode IN ('view')),
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  expires_at     INTEGER,                        -- NULL = never
  revoked_at     INTEGER,                        -- NULL = active
  rev            INTEGER NOT NULL DEFAULT 1,
  CHECK (payload_bytes <= 8192)
);
CREATE INDEX idx_shares_install ON shares(install_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_shares_expires ON shares(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_shares_revoked ON shares(revoked_at) WHERE revoked_at IS NOT NULL;

CREATE TABLE rate_counters (
  key          TEXT NOT NULL,                    -- e.g. 'create:ip:<hash>', 'create:global:20261010'
  window_start INTEGER NOT NULL,                 -- unix seconds, aligned to the window size
  count        INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
) WITHOUT ROWID;
```

Notes:
- Raw tokens are never stored. Lookups hash the token from the URL and query `token_hash`.
- `access_mode` is reserved. v1 allows only `view`. Collaborative memos are out of scope.
- `install_id` is not an identity. It is a soft quota key. It is never returned by the API and never logged.
- Revoke clears `payload` to `'{}'` and sets `payload_bytes = 0`. The row stays 30 days so reads can answer 410, then the purge deletes it.
- IP addresses are hashed with a daily salt for `rate_counters` keys: `SHA-256(ip + ":" + yyyymmdd + ":" + RATE_SALT)`. Raw IPs are never stored or logged.
- All SQL uses prepared statements with `bind()`. No string-built SQL.

---

## 5. Tokens

| Token | Format | Entropy | Where it lives |
| :--- | :--- | :--- | :--- |
| `shareToken` | 22 chars base64url (no padding) | 128 bits from `crypto.getRandomValues` | In the URL. Anyone with it can read. |
| `manageToken` | `mt_` + 43 chars base64url | 256 bits | Returned once on create. Stored by the app in secure storage. |

- Both are generated by the Worker. SHA-256 (hex) is stored. No salt or KDF is needed at this entropy.
- Comparison of `manage_hash` MUST be constant time.
- Path parameter format check, before any D1 access: `shareToken` MUST match `^[A-Za-z0-9_-]{22}$`. Otherwise respond exactly as for an unknown token (404). This saves D1 reads on scanners.
- A guest who loses the manage token cannot update or revoke. There is no recovery in v1. The app warns about this and the user can create a new link. Expiry limits the exposure.

---

## 6. REST API contract

Base URL: `https://daysthatmatter.app/api/v1`. JSON, UTF-8. Timestamps in JSON are ISO-8601 UTC strings with `Z`, millisecond precision not required (`2026-10-10T15:04:05Z`).

### 6.1 Conventions

- Request bodies MUST have `Content-Type: application/json` (else 415 `unsupported_media_type`). Hard body limit 16384 bytes, checked from `Content-Length` and again after reading (else 413 `payload_too_large`).
- Zod schemas are `.strict()`: unknown fields are rejected with 400 `invalid_payload`. Clients MUST ignore unknown fields in responses (`ignoreUnknownKeys = true`).
- Error body on every non-2xx JSON response:
  ```json
  {"error": {"code": "invalid_payload", "message": "targetDate: invalid date", "details": null}}
  ```
  `code` is a stable machine string from the table in 6.8. `message` is for humans and may change. `details` is optional (`null` or an object). No stack traces, no SQL, no echo of user content.
- Every response has: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Request-Id: <uuid>`. Error responses also have `Cache-Control: no-store` (except 410, see 6.3).
- CORS: no CORS headers on any `/api/v1` route in v1. Native apps do not need CORS. The share page does not call the API. Never reflect `Origin`. No cookies are read or set; authentication is by bearer token only.
- Client IP is read from `CF-Connecting-IP` only.
- `X-Install-Id: <uuid v4>` header is required on `POST /shares`. Invalid or missing gives 400 `invalid_install_id`.

### 6.2 Share payload v1

The payload is a snapshot of the event for display. It is sent by the app in create and update requests and returned unchanged on read.

```json
{
  "v": 1,
  "title": "Our wedding",
  "emoji": "💍",
  "targetDate": "2027-06-12",
  "targetTime": "16:30:00",
  "timeZone": "Europe/Paris",
  "unitMode": "auto",
  "recurrence": {"type": "yearly", "originalYear": 2027, "days": null},
  "theme": {
    "paletteId": "violet",
    "cardStyle": "glass",
    "typography": "modern",
    "gradient": ["#8B5CF6", "#3B82F6"]
  }
}
```

| Field | Type | Rules |
| :--- | :--- | :--- |
| `v` | integer | MUST equal the request `schemaVersion`. Supported: `[1]`. |
| `title` | string | 1 to 100 chars after NFC normalization and trimming. Control chars (C0, C1, U+2028, U+2029) and bidi overrides (U+202A to U+202E, U+2066 to U+2069) are rejected. |
| `emoji` | string or null | At most one grapheme, at most 16 UTF-8 bytes. |
| `targetDate` | string | `YYYY-MM-DD`, a real date, year 1900 to 2200. |
| `targetTime` | string or null | `HH:mm:ss` 24 h. Null means start of day (00:00:00). |
| `timeZone` | string or null | Valid IANA zone name (checked with `Intl.DateTimeFormat`). Null means floating: the viewer's local zone is used (for New Year, birthdays). |
| `unitMode` | string | `auto`, `days`, `calendar`. `auto` follows the events spec (days, then hours/min/sec under 48 h). Business-day mode is not shared in v1. |
| `recurrence.type` | string | `none`, `yearly`, `monthly`, `weekly`, `customDays`. |
| `recurrence.originalYear` | integer or null | Required when `yearly`, otherwise null. 1900 to 2200. |
| `recurrence.days` | integer or null | Required when `customDays`, 1 to 3650. Otherwise null. |
| `theme.paletteId`, `cardStyle`, `typography` | string | Matches `^[a-z0-9_-]{1,32}$`. The page falls back to defaults for unknown ids. |
| `theme.gradient` | array or null | Two strings matching `^#[0-9A-Fa-f]{6}$`. |

Excluded from the payload and rejected if present: `notes`, `memos`, `ownerId`, `id`, email, display name, avatar, audio, wallpaper or any URL field. v1 shares carry no memos and no media. A request containing `memos` or `includeMemos` returns 400 `invalid_payload`.

Serialized payload (canonical JSON as stored) MUST be at most 8192 bytes, else 413.

The JSON Schema file `schema/share-payload.v1.schema.json` is the machine-readable form. It is used by the Worker tests, the page, and the app test fixtures.

### 6.3 `POST /shares` create a share

Headers: `Content-Type: application/json`, `X-Install-Id: <uuid>`.

Request:
```json
{
  "schemaVersion": 1,
  "payload": { "...": "payload v1" },
  "expiresInDays": 365
}
```
- `expiresInDays`: integer 1 to 365, or null/absent for no expiry. `expiresAt` is not accepted on create. Default: no expiry.

Response `201 Created`, header `Location: /api/v1/shares/{shareToken}`, `Cache-Control: no-store`:
```json
{
  "shareToken": "Zq3u8Yc0Vf1o7e2N9a4Kxw",
  "url": "https://daysthatmatter.app/e/Zq3u8Yc0Vf1o7e2N9a4Kxw",
  "manageToken": "mt_u0n1...43 chars",
  "schemaVersion": 1,
  "createdAt": "2026-10-10T15:04:05Z",
  "expiresAt": "2027-10-10T15:04:05Z"
}
```
`expiresAt` is null when there is no expiry. `manageToken` appears only in this response.

Errors: 400 `invalid_payload`, 400 `invalid_install_id`, 413 `payload_too_large`, 415 `unsupported_media_type`, 422 `unsupported_schema_version` (`details: {"supported":[1]}`), 429 `rate_limited` (with `Retry-After` seconds), 429 `quota_exceeded` (50 active shares for this install, or the global daily create cap), 503 `service_unavailable` (D1 limit hit or kill switch on).

### 6.4 `GET /shares/{shareToken}` read a share (public)

No authentication.

`200 OK`:
```json
{
  "shareToken": "Zq3u8Yc0Vf1o7e2N9a4Kxw",
  "schemaVersion": 1,
  "payload": { "...": "payload v1" },
  "accessMode": "view",
  "createdAt": "2026-10-10T15:04:05Z",
  "updatedAt": "2026-10-10T15:04:05Z",
  "expiresAt": null,
  "serverTime": "2026-10-10T15:09:00Z"
}
```
Headers: `ETag: "r{rev}"`, `Cache-Control: public, max-age=30, stale-while-revalidate=60`. `If-None-Match` matching gives `304` with no body. `serverTime` lets clients correct clock skew.

Other responses:
- `404 not_found`: unknown share, purged share, or malformed token. Identical body, status and headers for all three. `Cache-Control: no-store`.
- `410 revoked` or `410 expired`: error envelope with that `code`. `Cache-Control: public, max-age=60`. No payload.

### 6.5 `PUT /shares/{shareToken}` update (owner)

Headers: `Authorization: Bearer mt_...`. Optional `If-Match: "r3"`.

Request:
```json
{"schemaVersion": 1, "payload": {"...": "payload v1"}, "expiresInDays": 30}
```
- `expiresInDays`: absent means keep the current expiry. `null` means remove expiry. An integer 1 to 365 sets `expires_at = now + N days`.

`200 OK`: `{"rev": 4, "updatedAt": "2026-10-10T16:00:00Z", "expiresAt": null}`. `rev` increases by 1 on every update.

Errors:
- 401 `unauthorized`: `Authorization` header missing or not `Bearer mt_...`.
- 404 `not_found`: unknown share, malformed token, or wrong manage token (not distinguishable).
- 410 `revoked` or `expired`: the share is revoked or expired. Revocation is permanent. A new share must be created.
- 412 `precondition_failed`: `If-Match` does not equal the current ETag.
- 400, 413, 415, 422 as in 6.3.
- 429 `rate_limited`: 30 requests per minute per share.

### 6.6 `DELETE /shares/{shareToken}` revoke (owner)

Headers: `Authorization: Bearer mt_...`.

Sets `revoked_at = now`, clears the payload, increments `rev`. `204 No Content`. Repeating the call with the same token returns 204. Errors: 401, 404 as in 6.5, 429.

### 6.7 `GET /health`

`200 {"status":"ok","time":"2026-10-10T15:09:00Z","version":"<git sha or 'dev'>"}`. Does not touch D1. `Cache-Control: no-store`.

Internal type used by the page route (not part of the HTTP contract):
```ts
type ShareLookup =
  | { status: 'ok'; share: { shareToken: string; schemaVersion: number; payload: SharePayload; createdAt: number; updatedAt: number; expiresAt: number | null; rev: number } }
  | { status: 'revoked' | 'expired' | 'not_found' };

function getShareByToken(db: D1Database, token: string, nowSeconds: number): Promise<ShareLookup>;
```
`getShareByToken` applies the token format check, so a malformed token returns `not_found` without a D1 query.

### 6.8 Error codes

| HTTP | `code` | Meaning |
| :--- | :--- | :--- |
| 400 | `invalid_payload` | Body or payload failed validation. `details` may list field paths. |
| 400 | `invalid_install_id` | `X-Install-Id` missing or not a uuid. |
| 401 | `unauthorized` | Manage token missing or malformed header. |
| 404 | `not_found` | Unknown, malformed or purged token, or wrong manage token. Also unknown routes. |
| 410 | `revoked` | Share was revoked. |
| 410 | `expired` | Share expired. |
| 412 | `precondition_failed` | `If-Match` mismatch. |
| 413 | `payload_too_large` | Body over 16 KB or payload over 8 KB. |
| 415 | `unsupported_media_type` | Not `application/json`. |
| 422 | `unsupported_schema_version` | `details.supported` lists accepted versions. |
| 429 | `rate_limited` | Too many requests. `Retry-After` set. |
| 429 | `quota_exceeded` | Active share cap or global daily create cap. |
| 500 | `internal_error` | Unhandled error. Body includes `details: {"requestId": "..."}`. |
| 503 | `service_unavailable` | D1 daily limit exhausted or kill switch (`MAINTENANCE=1`). |

### 6.9 Versioning

- `schemaVersion` is an integer in the request and `v` is inside the payload. The server accepts the versions in a `SUPPORTED_VERSIONS` list and returns 422 otherwise.
- Reads return the stored version unchanged. The server never rewrites old payloads. Clients migrate upward.
- Additive optional fields do not bump the version. Breaking changes bump it and add a new zod schema and JSON Schema file. The API path stays `/api/v1` unless request or response envelopes change incompatibly.

---

## 7. Share page and link routes

### 7.1 `GET /e/{shareToken}` (Worker)

| State | Status | Body |
| :--- | :--- | :--- |
| Active | 200 | Full page with the event. |
| Unknown, malformed, purged | 404 | `Link not found` page. Same for all three. |
| Revoked or expired | 410 | `This link is no longer available` page. No event details. |
| Worker or D1 error | 503 | Short static-style error page. |

Headers on every response of this route:
- `Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests`. Event data and `serverTime` are injected as `<script type="application/json" id="share-data">` (shape: `{"shareToken","payload","serverTime"}`), which is not executed, so no inline script nonce is needed. The countdown script is `/assets/countdown.js`.
- `Cache-Control: no-store` (revocation takes effect on the next request).
- `X-Robots-Tag: noindex, nofollow` and `<meta name="robots" content="noindex">`.
- `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security: max-age=31536000`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

HTML rules:
- Build HTML with the `hono/html` tag (auto-escaping). Never concatenate user data into strings.
- The JSON blob escapes `<`, `>`, `&`, U+2028 and U+2029 as `\uXXXX`. The page script reads it with `JSON.parse` and writes to the DOM only with `textContent`.
- `og:url` and `canonical` are built from the validated token and the fixed origin `https://daysthatmatter.app`, never from the `Host` header.
- Open Graph and Twitter tags: `og:title` (title truncated to 70 chars), `og:description` (server-computed text such as `124 days to go`), `og:image` (static `/og/default.png`), `twitter:card=summary_large_image`. Attribute values are escaped.
- Smart banners. iOS: `<meta name="apple-itunes-app" content="app-id={IOS_APP_ID}, app-argument=https://daysthatmatter.app/e/{token}">`. Android: an in-page banner with an `Open in app` button (the https link, which opens the app when App Links are verified) and a Play Store link with `&referrer=` carrying the token. A custom scheme fallback `daysthatmatter://event?token={token}` is a secondary link. Store ids are placeholders (`IOS_APP_ID_PLACEHOLDER`, `PLAY_PACKAGE_PLACEHOLDER`) until the apps are published. Desktop shows the page without banners.
- A `Report this link` mailto link and the footer text `Created by a user of Days That Matter`. No third-party scripts, fonts or analytics.

### 7.2 Static assets

- `/` landing page, `/assets/*`, `/og/*`, `/.well-known/*` are served by Static Assets. They are not routed through the Worker.
- `public/_headers` MUST set `Content-Type: application/json` for `/.well-known/apple-app-site-association` (extensionless) and `/.well-known/assetlinks.json`, plus `Cache-Control: public, max-age=3600`. If `_headers` cannot set the type for the extensionless file, the owner of the page (B) adds a Worker route for it and records the change here. Verify with a deployed preview, since local emulation may differ.
- Association files MUST NOT redirect, MUST NOT need auth, and MUST NOT be touched by any catch-all route.
- `assetlinks.json`: relation `delegate_permission/common.handle_all_urls`, the package name, and a `sha256_cert_fingerprints` list that includes the Play App Signing key and the upload/debug key. The package name and fingerprints are placeholders until known (see section 11).
- `apple-app-site-association`: `{"applinks":{"details":[{"appIDs":["TEAMID.bundleid"],"components":[{"/":"/e/*"}]}]}}` with placeholders for Team ID and bundle id.
- A CI check MUST fail a release deploy (production environment) while any placeholder remains in the association files.

### 7.3 Countdown on the page

`assets/countdown.js` computes the countdown in the browser from the JSON blob and `serverTime` (the page response includes it for skew correction).
- Semantics match [`docs/features/events/SPEC.md`](../features/events/SPEC.md) section 2: total units, calendar breakdown, future (until), past (since), day of event, recurrence (yearly with anniversary count, monthly with end-of-month clamping, weekly, custom days).
- Time zone: local fields to instant using `Intl.DateTimeFormat` with the IANA zone. `timeZone: null` uses the viewer's zone.
- Ticks once per second, pauses when the tab is hidden and resyncs on `visibilitychange`.
- Accessibility: the visible ticker is `aria-hidden`. A visually hidden summary updates once per minute. The server renders an initial value, and a `<noscript>` shows static text. `prefers-reduced-motion` disables confetti and glow. Targets are at least 44 px, focus rings are visible.
- Visual style: tokens from `design/v1/css/styles.css`, copied into `public/assets/share.css`. A CI check (script) MUST fail when the copied token values differ from the design source. A `prefers-color-scheme: light` variant is added because v1 design is dark only.
- The countdown logic is tested against golden vectors, see section 9.

---

## 8. Security model

| Area | Rule |
| :--- | :--- |
| Read access | Possession of the 128-bit `shareToken`. No list or search endpoint exists. |
| Write access | Possession of the 256-bit `manageToken`. 404 for wrong token and unknown share. |
| Create abuse | Per IP: 10 creates per minute and 60 per hour. Per install: 50 active shares. Global: 20000 creates per UTC day (budget guard for the D1 write limit). Counters are D1 rows (`rate_counters`). The Workers Rate Limiting binding MAY be added as an extra burst guard if the Free plan supports it (unverified; it is per location and eventually consistent, so it is not a control by itself). |
| Read abuse | Per IP: 120 requests per minute on `/api/v1/shares/{token}` and `/e/*` using the Rate Limiting binding if available. D1 counters are NOT used for reads (each check would be a write). Malformed tokens never reach D1. |
| Cloudflare edge | Domain is on Cloudflare DNS. Enable Bot Fight Mode and one WAF rate limiting rule on `/e/*` if the plan allows it (verify in the dashboard). |
| Anonymous spam | Titles are the only free text. They are escaped everywhere, never auto-linked, and capped at 100 chars. A report link and an admin revoke runbook exist (see 10.4). Firebase App Check on create is a possible later hardening. |
| Input | zod `.strict()` schemas, size caps, Unicode checks, no URL fields. |
| Output | Auto-escaping templates, JSON blob escaping, `textContent` only, strict CSP, `nosniff`. |
| Privacy | Payload is an allow-list. No memos, owner id, email, names, notes, media. `install_id` and IP are not logged or returned. |
| Logging | JSON line per request: `ts`, `route`, `status`, `reqId`, `tokenHashPrefix` (first 8 hex of the token hash), `rateLimited`. Never log bodies, titles, tokens, `Authorization` headers, IPs, `X-Install-Id`. A test asserts this. Workers Logs head sampling at 10%. |
| Secrets | `RATE_SALT` and `ADMIN_KEY` are wrangler secrets, never in `wrangler.jsonc`. |
| Retention | Revoked and expired rows are purged 30 days after revoke or expiry. D1 Time Travel keeps 7 days of history, so deleted data can remain recoverable for 7 days. State this in the privacy policy. |
| Referrers | Token is in the URL path. `Referrer-Policy: no-referrer` on all pages. |
| Account deletion | Shares are not linked to a user account in v1, so account deletion does not affect them. The app SHOULD revoke the user's active shares before sign-out or deletion, using the stored manage tokens. |

---

## 9. Testing

- `vitest` with `@cloudflare/vitest-pool-workers`. D1 runs locally in miniflare and migrations from `migrations/` are applied before tests.
- Golden vectors: `test/fixtures/countdown-vectors.json` holds records `{rule, timeZone, targetDate, targetTime, nowInstant, expectedTargetInstant, expectedBreakdown}`. The KMP side generates the same file from `kotlinx-datetime` in a later milestone (see the plan); until then the vectors are hand-written from the events spec, including Feb 29, month-end clamping, DST transitions and day-of-event.
- Required test groups are listed in the plan, section 5.

---

## 10. Free-tier budget, deployment and operations

### 10.1 Limits (checked 2026-10-10 against Cloudflare docs)

| Resource | Free limit | Design use |
| :--- | :--- | :--- |
| Worker requests | 100,000 per day, reset 00:00 UTC. Over the limit the route returns error 1027 or 429. | 1 request per page view, 1 per API call. About 60k views per day is the planning ceiling. |
| Worker CPU | 10 ms per request | Hashing, zod validation and HTML templating only. No image or QR generation. No JWT or RSA work. |
| Subrequests / D1 queries per invocation | 50 | At most 4 queries per request. Purge runs in batches. |
| Static asset requests | Documented as free and unlimited | Keep everything static that can be. Whether they count toward the 100k is not stated; check the dashboard after launch. |
| D1 rows read | 5,000,000 per day | About 1 to 3 rows per request. Not the limiting factor. |
| D1 rows written | 100,000 per day. Queries fail after the limit until 00:00 UTC. | Creates (2 rows: share and counter), updates, revokes. Global create cap 20,000 per day keeps room. |
| D1 storage | 500 MB per database, 5 GB per account | 8 KB cap per share gives well over 50k shares. |
| Cron triggers | 5 per account | 1 used (nightly purge). |

Planning ceiling. 100k requests per day is about 1.1 requests per second on average. Past 60k per day average, upgrade to Workers Paid (5 USD per month), which lifts the D1 and request caps. Add an alert (manual check of the dashboard in v1).

Over-limit behavior. The `/e/*` route cannot serve a custom page when the quota is gone. Static assets keep working. Apps handle 429 or 503 on resolve by showing `Link temporarily unavailable, try again later`. There is no Firestore fallback.

Not verified (confirm manually before relying on them):
- Custom Domains on the Free plan (the domain's DNS must be a Cloudflare zone; the hostname must not have an existing CNAME).
- The Workers Rate Limiting binding on the Free plan.
- Number of free WAF rate limiting rules.
- Whether `_headers` can set `Content-Type` for an extensionless file.
- Whether static asset requests count toward the 100k per day.

### 10.2 Environments

| Env | Worker name | Host | D1 database | Deploy trigger |
| :--- | :--- | :--- | :--- | :--- |
| local | n/a | `localhost:8787` via `wrangler dev` | local miniflare D1 | manual |
| preview | `dtm-share-preview` | `dtm-share-preview.<account>.workers.dev` | `dtm-share-preview` | push to `master` touching `services/share/**` |
| production | `dtm-share` | `daysthatmatter.app` (Custom Domain) | `dtm-share` | tag `share-v*.*.*` (manual, approved) |

`wrangler.jsonc` defines `env.preview` and `env.production`. The `workers.dev` host cannot serve App Links, so only production can be used to test deep links.

### 10.3 Deployment

CI file `.github/workflows/share-service.yml` (owner C). Secrets: `CLOUDFLARE_API_TOKEN` (scoped to Workers and D1 edit), `CLOUDFLARE_ACCOUNT_ID`.
1. Install (`npm ci`), typecheck, lint, test (`vitest`).
2. Asset check: placeholders, token drift against `design/v1/css/styles.css`, JSON validity of the association files.
3. Deploy order: apply D1 migrations (`wrangler d1 migrations apply <db> --remote --env <env>`), then `wrangler deploy --env <env>`. Migrations MUST be backward compatible with the previous Worker version (add columns or tables only; no drops in the same release).
4. Smoke test after deploy: `GET /api/v1/health`, create then read then revoke a share on preview, fetch both well-known files with `redirect: manual`.

Rollback: `wrangler rollback` for the Worker. D1 changes roll forward only; use Time Travel for data recovery.

Secrets are set with `wrangler secret put RATE_SALT --env <env>` and `ADMIN_KEY`. Never committed.

### 10.4 Operations runbook (documented in the service README by C)

- Abuse takedown: `wrangler d1 execute dtm-share --remote --command "UPDATE shares SET revoked_at=unixepoch(), payload='{}', payload_bytes=0, rev=rev+1 WHERE token_hash=?"` with the hash of the reported token. There is no public admin API in v1, so `ADMIN_KEY` is reserved and unused until one is added.
- Kill switch: set `MAINTENANCE=1` (wrangler var or dashboard). Create, update and revoke return 503. Reads keep working.
- Nightly purge (cron `0 3 * * *`): delete rows where `revoked_at < now - 30d` or `expires_at < now - 30d`, and `rate_counters` older than 2 days. Bounded batches (at most 500 rows per DELETE, at most 20 statements per run).

---

## 11. Inputs still needed from the project owner

These are placeholders in the first implementation and block a production launch, not the build:
- Registered domain `daysthatmatter.app` with DNS moved to a Cloudflare zone.
- Apple Team ID, iOS bundle id, App Store app id.
- Android package name, Play App Signing SHA-256 and upload/debug key fingerprints (the debug keystore is in `docs/keystore/`).
- Contact address for abuse reports.
- Privacy policy owner and jurisdiction (GDPR, CCPA).
