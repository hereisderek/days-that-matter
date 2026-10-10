# Share Service Status, TODO and Next Steps

Status as of 2026-10-10. Design: [`SHARE_SERVICE.md`](../architecture/SHARE_SERVICE.md). Original plan: [`SHARE_SERVICE_IMPLEMENTATION_PLAN.md`](SHARE_SERVICE_IMPLEMENTATION_PLAN.md).

## 1. What is done (merged to `master`)

| PR | Content |
| :--- | :--- |
| #1 | Design docs: sharing spec, architecture and API contract, implementation plan |
| #2 | `services/share/` API: routes, D1 migration, validation, token hashing, rate limits, nightly purge, 112 tests |
| #3 | Share page (server-rendered), static assets, countdown script, OG meta, `.well-known` files, `_headers`, 179 tests in total |
| #4 | `.github/workflows/share-service.yml`, wrangler `preview` and `production` environments, scripts (`smoke`, `check-placeholders`, lint), service README |

Local checks on `master`: `npm run typecheck`, `npm run lint`, `npm test` (179 tests) and `npm run check:assets` pass in `services/share`.

Nothing is deployed. No Cloudflare account, D1 database or domain is configured yet.

## 2. Known CI state

The `Deploy preview` job fails on every push to `master` at the step `Refuse placeholder D1 id`. This is intended: `wrangler.jsonc` still has all-zero D1 `database_id` values. It goes green after step A3 below.

## 3. TODO: owner actions (block deployment and launch)

A. Cloudflare setup (blocks the first preview deploy)
- [ ] A1. Create a Cloudflare account (Free plan) and note the account id.
- [ ] A2. Create an API token scoped to Workers Scripts edit and D1 edit.
- [ ] A3. Run `wrangler d1 create dtm-share-preview` and `wrangler d1 create dtm-share`. Put both ids in `services/share/wrangler.jsonc` (`env.preview`, `env.production`). The ids are not secret.
- [ ] A4. Add GitHub repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- [ ] A5. Create the GitHub environments `preview` and `production` (the deploy jobs reference both). Give `production` a required reviewer.
- [ ] A6. Set Worker secrets for each environment: `wrangler secret put RATE_SALT --env preview` and `--env production` (use a long random value).
- [ ] A7. Push to `master`, confirm the preview deploy and the post-deploy smoke test pass.

B. Production launch inputs (see `SHARE_SERVICE.md` section 11)
- [ ] B1. Register `daysthatmatter.app` and move DNS to a Cloudflare zone.
- [ ] B2. Apple Team ID, iOS bundle id, App Store app id. Replace the placeholders in `public/.well-known/apple-app-site-association` and `src/page/og.ts`.
- [ ] B3. Android package name and Play App Signing SHA-256 plus upload/debug fingerprints. Replace the placeholders in `public/.well-known/assetlinks.json` and `src/page/og.ts`.
- [ ] B4. Abuse contact address (currently `abuse@daysthatmatter.app`, must exist).
- [ ] B5. Privacy policy owner and jurisdiction.
- [ ] B6. `npm run check:assets:strict` must pass (it fails while placeholders remain; the production deploy job runs it).
- [ ] B7. Tag `share-v0.1.0` on a commit on `master` to deploy production. Needs explicit approval per tag.

C. Manual verifications (not checkable offline)
- [ ] C1. Custom Domains work on the Free plan for this zone.
- [ ] C2. `_headers` sets `Content-Type: application/json` on the extensionless `apple-app-site-association` file (check on the deployed preview).
- [ ] C3. Whether the Workers Rate Limiting binding and free WAF rate limit rules are available. The Worker does not depend on them.
- [ ] C4. After launch, check the dashboard to see whether static asset requests count toward the 100k per day.
- [ ] C5. Lighthouse accessibility score of 95 or higher on the share page (no browser was available during implementation).
- [ ] C6. Verify App Links and Universal Links on real devices (iOS caches association files).

## 4. TODO: engineering follow-ups

Small items found in review. None blocks the build.

- [ ] E1. Fail closed when `RATE_SALT` is not set (today IP hashing silently uses an empty salt). Add a startup check and a test, then require the secret in the smoke test.
- [ ] E2. Migrate tests from `@cloudflare/vitest-pool-workers` (deprecated, prints a rename warning) to `@cloudflare/vitest-plugin`, then drop `legacy-peer-deps=true` from `.npmrc`.
- [ ] E3. Revisit the `compatibility_date` in `wrangler.jsonc` (pinned to `2026-08-01` because the local workerd rejected later dates).
- [ ] E4. Reconcile the desktop QR code: `docs/features/sharing/SPEC.md` mentions one, `SHARE_SERVICE.md` section 7.1 says the service generates none and desktop shows no banners.
- [ ] E5. Per-IP read rate limits are not implemented in the Worker. Add Cloudflare edge rules once C3 is answered, or an own counter if reads become a problem.
- [ ] E6. The 8192-byte payload cap cannot be reached with the v1 field limits. Keep as a safety net or tighten the field limits.
- [ ] E7. `check:assets` does not yet cover every drift check listed in `SHARE_SERVICE.md` section 10.3 step 2. Compare and fill the gaps.
- [ ] E8. Pin GitHub Actions in `share-service.yml` to commit SHAs instead of major versions. Update checkout and setup-node to Node 24 runtimes (CI prints a Node 20 deprecation warning).
- [ ] E9. Add the alert for the 60k requests per day planning ceiling (dashboard check only in v1).

## 5. Next steps (in order)

1. Do A1 to A7. Result: preview Worker live on `workers.dev`, CI green.
2. Run an end-to-end check against preview: create, read, update, revoke, expiry, the share page in a browser, `GET /e/{token}` for 404 and 410 states.
3. Do E1 and E2 in one small PR (`fix/share-hardening`).
4. Start milestone M6, the KMP client (separate worktree and PR per piece):
   - `ShareRepository` in the `network` module (Ktor, kotlinx-serialization) matching the contract in `SHARE_SERVICE.md` section 6.
   - Use cases: `ShareEventUseCase`, `RevokeShareUseCase`, `ResolveSharedEventUseCase`, `ImportSharedEventUseCase`.
   - Secure storage of `manageToken`, Room `shares` table, offline queue for create and revoke.
   - Deep link handling (App Links and Universal Links, `daysthatmatter://` fallback), in-app QR generation.
   - Share UI with the lost-token warning.
   - Fixture generator in Kotlin for the countdown golden vectors in `services/share/test/fixtures/countdown-vectors.json`, so the page and the app agree.
   - Add `timeZone` and the no-time-event meaning to `docs/features/events/SPEC.md` first (the `Event` model has no time zone today).
5. Do B1 to B7 and C5, C6 for the production launch.

## 6. Later (not planned yet)

- Memos in shares and collaborative memos (needs authenticated writes).
- Media in shares (R2).
- Signed-in recovery or revoke-all (Firebase ID token verification in the Worker).
- Dynamic Open Graph card rendered by the app and uploaded at share time.
- Public admin and report API (`ADMIN_KEY` is reserved for it).
- Upgrade to Workers Paid (5 USD per month) if traffic passes about 60k requests per day.
