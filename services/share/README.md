# Days That Matter share service

> **Superseded (2026-10-12).** This service is frozen. Do not deploy it. The direction changed to one backend core with provider variants, with live links, people access and history: see [`BACKEND.md`](../../docs/architecture/BACKEND.md) and the OpenSpec change [`pluggable-backend-live-sharing`](../../openspec/changes/pluggable-backend-live-sharing/). This document is kept as the behavior reference for `services/share/` until task 5.5 of that change removes the service.

Cloudflare Worker + D1 + Static Assets. Serves the public share page (`/e/{token}`), the App Links / Universal Links files and the REST API under `/api/v1`. Contract: [`docs/architecture/SHARE_SERVICE.md`](../../docs/architecture/SHARE_SERVICE.md). Plan: [`docs/plans/SHARE_SERVICE_IMPLEMENTATION_PLAN.md`](../../docs/plans/SHARE_SERVICE_IMPLEMENTATION_PLAN.md).

## Requirements

- Node 22 and npm. All tools are local dev dependencies, nothing is installed globally.
- A Cloudflare account only for deploying. Local development and tests need no account and no credentials.

## Local setup

```bash
cd services/share
npm ci
npm run migrate:local   # applies migrations/ to the local D1 (kept in .wrangler/, git-ignored)
npm run dev             # wrangler dev --local on http://localhost:8787
```

Optional local secrets go in `.dev.vars` (git-ignored), for example `RATE_SALT=dev-salt`.

## Scripts

| Script | What it does |
| :--- | :--- |
| `npm run dev` | Local Worker with local D1 and assets |
| `npm test` | vitest in the Workers pool (miniflare, local D1, migrations applied automatically) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (typescript-eslint recommended) |
| `npm run check:assets` | JSON validity of the association files. `check:assets:strict` also fails while placeholders remain |
| `npm run deploy:dry-run` | `wrangler deploy --dry-run` for preview and production. Needs no credentials |
| `npm run migrate:local` / `migrate:preview` / `migrate:prod` | Apply D1 migrations to local / preview / production |
| `npm run deploy:preview` / `deploy:prod` | `wrangler deploy` for the environment |
| `BASE_URL=... npm run smoke` | Smoke test: health, create, read, revoke, read returns 410, both well-known files without redirect |

## Environments

| Env | Worker | Host | D1 database | Trigger |
| :--- | :--- | :--- | :--- | :--- |
| local | n/a | `localhost:8787` | local miniflare D1 | manual |
| preview | `dtm-share-preview` | `dtm-share-preview.<account>.workers.dev` | `dtm-share-preview` | none (frozen, not deployed) |
| production | `dtm-share` | `daysthatmatter.app` (Custom Domain) | `dtm-share` | none (frozen, not deployed) |

`wrangler.jsonc` repeats `vars`, `d1_databases`, `triggers` and `observability` in each `env.*` block because wrangler does not inherit those keys. The `workers.dev` host cannot serve App Links, so only production tests deep links.

## One-time Cloudflare setup (project owner)

1. Create the databases and copy the ids into `wrangler.jsonc` (`env.preview` and `env.production`, replacing the all-zero placeholder). The ids are not secrets.
   ```bash
   npx wrangler d1 create dtm-share-preview
   npx wrangler d1 create dtm-share
   ```
2. Set the Worker secrets for each environment (values are never committed):
   ```bash
   npx wrangler secret put RATE_SALT --env preview
   npx wrangler secret put ADMIN_KEY --env preview
   npx wrangler secret put RATE_SALT --env production
   npx wrangler secret put ADMIN_KEY --env production
   ```
   `ADMIN_KEY` is reserved and unused in v1. `RATE_SALT` is a random string, for example `openssl rand -hex 32`.
3. Create a Cloudflare API token scoped to Workers Scripts edit and D1 edit, and add GitHub repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
4. Add GitHub repository variables `SHARE_PREVIEW_URL` (the preview `workers.dev` URL, shown by the first deploy) and optionally `SHARE_PRODUCTION_URL` (defaults to `https://daysthatmatter.app`).
5. Create GitHub environments `preview` and `production`. Add required reviewers to `production`.
6. For production: move `daysthatmatter.app` DNS to a Cloudflare zone, and replace the placeholders in `public/.well-known/*` (see contract section 11).

## CI and deploy

Workflow: [`.github/workflows/share-service.yml`](../../.github/workflows/share-service.yml). Details: [`docs/ci-cd/WORKFLOW_PIPELINE.md`](../../docs/ci-cd/WORKFLOW_PIPELINE.md) section 4.

- Pull request and push: `npm ci`, typecheck, lint, test, `check:assets`, `npm audit --omit=dev --audit-level=high`, dry-run deploy. Nothing else.
- The deploy jobs were removed on 2026-10-12: this service is frozen and is not deployed.

## Rollback

- Worker: `npx wrangler rollback --env <env>`.
- D1 rolls forward only. For data recovery use D1 Time Travel (7 days): `npx wrangler d1 time-travel info dtm-share --env production`.

## Runbook

- **Abuse takedown.** Revoke by token hash (SHA-256 hex of the reported token; the share page URL carries the token):
  ```bash
  npx wrangler d1 execute dtm-share --remote --env production --command "UPDATE shares SET revoked_at=unixepoch(), payload='{}', payload_bytes=0, rev=rev+1 WHERE token_hash='<hash>'"
  ```
  There is no public admin API in v1.
- **Kill switch.** Set `MAINTENANCE=1` (the `vars` entry for the environment in `wrangler.jsonc` and redeploy, or in the dashboard under the Worker's variables). Create, update and revoke return 503. Reads keep working.
- **Nightly purge.** Cron `0 3 * * *` clears payloads of expired rows, deletes rows revoked or expired more than 30 days ago and `rate_counters` older than 2 days, in bounded batches.
- **Logs.** Workers Logs with 10% head sampling. Lines are JSON with `ts`, `route`, `status`, `reqId`, `tokenHashPrefix`, `rateLimited`. No bodies, tokens, IPs or install ids are logged.
- **Free-tier watch.** 100k Worker requests and 100k D1 row writes per day. Check the dashboard after launch. Past about 60k views per day, upgrade to Workers Paid.

## Manual checks still open

Not verifiable without a Cloudflare account (contract section 10.1). Confirm before relying on them:

- Custom Domains on the Free plan (DNS must be a Cloudflare zone, no existing CNAME for the hostname).
- The Workers Rate Limiting binding on the Free plan.
- Number of free WAF rate limiting rules, and Bot Fight Mode.
- Whether `_headers` sets `Content-Type: application/json` for the extensionless `apple-app-site-association` file on a deployed preview (the smoke test checks this).
- Whether static asset requests count toward the 100k per day.
- Lighthouse accessibility score of at least 95 on the active-state share page.
- Deep links on a real Android and iOS device after production deploy.
