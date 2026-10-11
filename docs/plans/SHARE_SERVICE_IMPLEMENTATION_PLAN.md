# Share Service Implementation Plan

> **Superseded (2026-10-12).** This plan was completed for milestones M1 to M4. Milestones M5 and M6 are replaced by the change's `tasks.md`. The direction changed to one backend core with provider variants, with live links, people access and history: see [`BACKEND.md`](../architecture/BACKEND.md) and the OpenSpec change [`pluggable-backend-live-sharing`](../../openspec/changes/pluggable-backend-live-sharing/). This document is kept as the behavior reference for `services/share/` until task 5.5 of that change removes the service.

Design and API contract: [`docs/architecture/SHARE_SERVICE.md`](../architecture/SHARE_SERVICE.md). Feature behavior: [`docs/features/sharing/SPEC.md`](../features/sharing/SPEC.md).

## 1. Scope

In scope: the service in `services/share/` (API, D1, share page, static assets, association files, CI, deploy docs).

Out of scope (later milestones, listed in section 7): KMP client work, collaborative memos, shared memos, media in shares, signed-in recovery of manage tokens, dynamic Open Graph images, a public admin API.

## 2. Milestones

| Milestone | Content | Exit criteria |
| :--- | :--- | :--- |
| M0 | This design merged (docs only) | PR `docs/share-service` merged. |
| M1 | Skeleton and contract types | `services/share/` builds and tests run (`npm ci && npm test` passes with a health test). A creates the minimal `package.json`, `tsconfig.json` and `wrangler.jsonc` for this. `getShareByToken` and `ShareLookup` are exported from `src/lib/db.ts`. Migration `0001_init.sql` applies. |
| M2 | API complete | All routes in contract section 6 pass the API test group. |
| M3 | Share page and assets | `/e/{token}` renders all states, countdown matches golden vectors, headers pass. Well-known files served with correct content type. |
| M4 | CI and preview deploy | Workflow runs on PR and deploys preview on `master`. Smoke test passes against preview. |
| M5 | Production launch | Domain on Cloudflare, placeholders replaced, production deploy from a `share-v*.*.*` tag, deep links verified on a real device. Needs inputs from contract section 11. |
| M6 (later) | KMP client | See section 7. |

M1 is done by implementer A first (about a small PR or the first commit on `feat/share-api`), and B and C rebase on it. B and C can start in parallel from the contract before M1 lands: B writes templates against the `ShareLookup` type, C writes the workflow and `wrangler.jsonc`.

## 3. Pull requests

All branches are created with `wt switch --create <branch> --no-cd` from `master`. Each PR is reviewed before merge. Owners are in the contract, section 3.

### PR 1: `feat/share-api` (implementer A)

Files: `services/share/src/index.ts`, `src/routes/shares.ts`, `src/routes/health.ts`, `src/lib/*`, `migrations/`, `schema/`, `vitest.config.ts`, `test/api/`.

Work:
1. Hono app, error envelope, security headers middleware, request id, JSON log line.
2. Migration `0001_init.sql` exactly as in the contract, section 4.
3. Token generation, hashing, constant-time compare.
4. zod schemas and Unicode checks for payload v1. JSON Schema file.
5. Routes: `POST /shares`, `GET /shares/{token}`, `PUT`, `DELETE`, `GET /health`.
6. Rate limits and quotas with `rate_counters`. Global daily create cap (10,000). Nightly purge also clears payloads of expired rows. `MAINTENANCE` flag.
7. Scheduled purge.
8. `getShareByToken` for the page route. Stub mount for the page routes.

Acceptance:
- Every status code and header in contract sections 6.1 to 6.8 is covered by a test.
- 404 responses for unknown, malformed, purged and wrong-manage-token are byte-identical in status, headers (except `X-Request-Id`) and body.
- No query reaches D1 for a malformed token (asserted with a query counter).
- No more than 4 D1 round trips per request (`db.batch()` counts as one).
- `npm run typecheck`, lint and tests pass.

### PR 2: `feat/share-web` (implementer B)

Files: `services/share/src/routes/page.ts`, `src/page/*`, `public/**`, `test/page/`, `test/fixtures/`.

Work:
1. Page route and templates for active, 404, 410 and 503 states.
2. Open Graph and Twitter tags, smart banners (placeholders), report link.
3. `share.css` from the `design/v1` tokens, light variant, reduced-motion handling.
4. `countdown.js` and the golden vector file.
5. Landing page `/`, static fallback pages, default OG image, self-hosted fonts.
6. `.well-known/assetlinks.json`, `.well-known/apple-app-site-association`, `_headers`.
7. Token drift check script and placeholder check script (run by C's workflow as `npm run check:assets`).

Acceptance:
- Header suite passes for `/e/{valid}`, `/e/{unknown}`, `/e/{revoked}` (CSP, nosniff, referrer, no-store, robots).
- XSS corpus renders inert in body, `<title>`, meta content and the JSON blob (golden-file snapshots).
- Countdown output equals every golden vector.
- Both well-known files parse as JSON, are served without redirect and with `application/json` (verified on preview; local test checks the `_headers` rule).
- Lighthouse accessibility score at least 95 on the active-state page (manual run, result in the PR).

### PR 3: `chore/share-ci` (implementer C)

Files: `.github/workflows/share-service.yml`, `services/share/wrangler.jsonc`, `package.json`, `package-lock.json`, `tsconfig.json`, `README.md`. The three config files already exist from A's M1 skeleton; C extends them, so PR 3 merges after the M1 skeleton commit.

Work:
1. `wrangler.jsonc` with assets (`directory: public`, `run_worker_first: ["/e/*", "/api/*"]`), D1 binding `DB`, cron `0 3 * * *`, `env.preview` and `env.production`, custom domain route for production.
2. `package.json` scripts: `dev`, `test`, `typecheck`, `lint`, `check:assets`, `migrate:local`, `migrate:preview`, `migrate:prod`, `deploy:preview`, `deploy:prod`.
3. Workflow: PR job (install, typecheck, lint, test, check:assets), `master` job (preview deploy and smoke test), tag job `share-v*.*.*` (production deploy with environment approval). Path filter `services/share/**`.
4. Service README: local setup, tests, secrets, environments, deploy order, rollback, runbook (contract section 10.4), manual checks list (contract section 10.1, unverified items).
5. `npm audit --audit-level=high` step, lockfile committed.

Acceptance:
- The workflow passes on a PR that touches `services/share/**` and does not run for other paths.
- Migrations run before the Worker deploy in both deploy jobs.
- No secret value appears in the repo. Required secrets are documented.
- `wrangler deploy --dry-run` succeeds in CI.

### PR order

PR 3 merges after the M1 skeleton commit of PR 1 (it extends the skeleton files); the rest of PR 1 and PR 3 can merge in either order. PR 2 merges after PR 1 (needs `getShareByToken`). Final integration check on preview after all three.

## 4. Task dependencies

```
M1 (A: skeleton + types) --> M2 (A: routes)
        |                         |
        +--> B starts page work --+--> M3 (B merges after A)
        +--> C starts CI/wrangler ---> M4
M3 + M4 --> M5 (needs owner inputs)
```

## 5. Test plan

Run with `vitest` and `@cloudflare/vitest-pool-workers`.

API (A):
1. Token generation: length, charset, 100k generated tokens without collision, hash format.
2. Payload validation table: valid, boundary (100 char title, 8192 byte payload, year 1900 and 2200) and hostile inputs (unknown field, `memos`, URL fields, NUL, U+202E, lone surrogates, bad IANA zone, bad hex colors).
3. Create, read, update, revoke flows, including ETag and `If-None-Match`, `If-Match` 412, idempotent revoke, PUT after revoke gives 410.
4. Auth: missing header 401, wrong token 404, unknown share 404, same response as malformed token.
5. 410 revoked and expired, expiry computed from `expiresInDays`, expiry boundary.
6. Limits: 413 body, 413 payload, 415, 422, per-IP rate limit with `Retry-After`, 51st active share per install gives `quota_exceeded`, global cap, `MAINTENANCE` gives 503 on writes only.
7. Purge: clears payload of expired rows, removes rows past the 30 day window, keeps younger rows, clears old counters, respects the batch bound.
8. Headers on every route class including 404 and 500. No CORS headers. Preflight `OPTIONS` from another origin gets no `Access-Control-Allow-Origin`.
9. Log redaction: a request containing a title, token, `Authorization`, install id and IP produces log output with none of those strings.

Page (B):
10. Rendering of each state and status code (200, 404, 410, 503).
11. XSS corpus (`</title><script>alert(1)</script>`, attribute break-outs, template strings, ZWJ emoji, bidi) over body, title, meta, JSON blob.
12. Header suite (section 7.1 of the contract) and CSP string equality.
13. Open Graph tags (values, escaping, truncation).
14. Countdown golden vectors (run in Node with the same module the browser loads).
15. Well-known files: valid JSON, expected keys, content type rule in `_headers`, no placeholder in production check.
16. Token drift check fails when a value in `share.css` differs from `design/v1/css/styles.css`.

CI (C):
17. Workflow lint (`actionlint` if available), dry-run deploy, smoke test script against preview.

Manual before M5: deep links on a real Android and iOS device, link previews in WhatsApp and iMessage, Lighthouse run, dashboard check of the unverified free-tier items.

## 6. Risks to track

- Free plan request cap of 100k per day. Mitigation: static assets, no per-view D1 writes, upgrade trigger at 60k per day.
- Anonymous create spam. Mitigation: IP, install and global caps. App Check is a later option.
- Lost manage token cannot revoke. Mitigation: expiry option and app warning.
- Association file mistakes fail silently and iOS caches them. Mitigation: placeholder check in CI, verify on device.
- Time zone mismatch between the Kotlin engine and the page. Mitigation: shared golden vectors.

## 7. Later milestones (not in this plan's PRs)

- KMP client (M6): `ShareRepository` in the `network` module with Ktor and kotlinx-serialization, use cases (`ShareEventUseCase`, `RevokeShareUseCase`, `ResolveSharedEventUseCase`, `ImportSharedEventUseCase`), secure storage of `manageToken`, Room `shares` table, offline queue for create and revoke, deep link handling, in-app QR generation, share UI with the lost-token warning, `kotlinx-datetime` fixture generator for the golden vectors.
- Add `timeZone` and the no-time-event meaning to `docs/features/events/SPEC.md` (the `Event` model has no time zone today).
- Collaborative memos and memos in shares (needs authenticated writes).
- Media in shares (R2).
- Signed-in recovery or revoke-all (Firebase ID token verification in the Worker).
- Dynamic Open Graph card rendered by the app and uploaded at share time.
- Public admin and report API.
