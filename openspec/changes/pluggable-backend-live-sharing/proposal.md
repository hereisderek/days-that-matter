# Proposal: Pluggable backend and live shared events

## Why

Today a share publishes a frozen snapshot through a TypeScript service that only runs on Cloudflare, and account sync is planned on Firestore. That means two backends, no way to change provider, no live updates, no per-person access or editing, no photos, and no way to sell paid features. Nothing is deployed yet, so changing direction now costs the least.

## What Changes

- One backend: a core with all behavior in `backend/core/`, and one variant per provider in its own directory (`backend/cloudflare/`, `backend/selfhost/`, `backend/vercel/`, `backend/firebase/`). Variants only implement small ports: store, blob storage, live updates, mail.
- The core is written in TypeScript (owner decision, 2026-10-14). Kotlin/JS stays an option if the core grows (design D1). Either way, the rules come from `:core:model`, the app's shared Kotlin module.
- **BREAKING** (docs only, nothing shipped): the backend replaces Firestore and Firebase Auth. The app talks to one HTTP API on every provider.
- Accounts: sign in with Google, Apple or an email code in the app; more methods can be added. Anything online needs an account; guests stay local and get a sign-in prompt. Users can download their data. Accounts unused for 24 months (owner to confirm) are deleted after two emails with a data download link.
- Signed-in users sync everything: events and memos now, comments when they ship. Sync runs after each edit; a Sync button syncs at once and says edits sync automatically.
- **BREAKING**: shares are no longer snapshots, and manage tokens are removed. Public links (view only, no account needed to open) and invite links (sign-in, join as viewer or editor) show the event itself and update live. The owner sets each link's expiry (5 days, 30 days, never, custom) and each invite's use count (1, 5, 10, unlimited, custom). Members see the event in their app. In a browser, invite and member links show only a generic page that opens the app.
- Web pages are read-only: no sign-in, editing or history on the web (design D17). Editors can change the event in the app. Every change is a revision with author and old and new values. Owners and editors can view history and restore.
- Backdrops: still photos, and animated photos from iPhone Live Photos and Google Motion Photos. Animated photos need a paid plan to save; free users can preview one and are offered the still. Viewers always see uploaded animated photos animated. Each backdrop has a shared dim level and blur radius.
- Background audio: a built-in catalog (a few tracks free, the rest paid), custom audio files kept in the account's library (paid, size-limited), and Spotify links (3 events free) with a short in-app preview where Spotify allows it.
- Plans Free, Premium and Premium Plus (reserved), with one plan table of limits for free and paid users. Gating uses the plan of the person saving. Purchases are verified with Apple and Google directly. The operator can grant a plan for a period (promotions).
- Regions: every deployment reports its sign-in methods, stores and features, so a later China deployment can run the same app and core with different settings.
- Operator: a storage report per account, the only operator API.
- `services/share/` (TypeScript) is frozen as a behavior reference and removed once the Cloudflare variant reaches parity.

## Capabilities

### New Capabilities

- `backend-portability`: one API contract and one set of limits on every supported provider, capability discovery per deployment, conformance as the definition of "supported", maintenance mode, the operator storage report.
- `accounts`: local use without an account, the sign-in prompt, Google, Apple and email code sign-in, identity linking, first sign-in upload, sessions, display names, account deletion, data export, deletion of inactive accounts.
- `event-sync`: what syncs, automatic sync after edits, the Sync button, offline-first edits, field-level merge, owner-only fields and memos, shared validation, deletion and lost access, live updates in the app.
- `event-history`: revisions, who can see them, restore, retention.
- `event-sharing`: public links, link expiry, invite links with roles and use counts, joining, members, roles, changing and removing access, the shared field allow-list, deep links.
- `share-web`: page states, countdown parity, live changes, read-only pages, invite and member landing pages, audio on the page, link previews, page privacy and security, open in app, accessibility.
- `event-backdrops`: still and animated photos, on-device conversion, Premium on save, viewer display, backend limits, metadata removal, readability (dim and blur), lifecycle.
- `event-audio`: the built-in catalog, Premium tracks, custom audio files and the custom audio library, Spotify links, previews and their free limit, playback in the app and on the web.
- `premium`: plans, the plan table, paid limits, paywall on save, gating by the writer's plan, viewers unaffected, purchases and restore, store verification, promotional grants, ending a plan.

### Modified Capabilities

None. `openspec/specs/` is empty. Current behavior is described in `docs/features/`, and those docs are updated in this change.

## Impact

- Code: `:core:model` (Android, iOS, JVM, JS); `backend/core/` with `migrations/`, `web/`, `audio/` and `conformance/`; four variant directories. `services/share/` and `.github/workflows/share-service.yml` are removed later.
- App: Firebase SDK removed. Ktor client, Google, Apple and email sign-in, sync engine with memos and a Sync button, share and history screens, Live Photo and Motion Photo conversion, paywall with StoreKit 2 (Swift bridge) and Play Billing, audio catalog, custom audio conversion, Spotify links, region selection.
- API: a new `/api/v1` contract, not compatible with the undeployed share API. Deep link paths `/e/{token}`, `/i/{token}`, `/s/{eventId}`. Pages `/export/{token}` (data export) and `/admin/storage` (operator).
- Infrastructure: Cloudflare adds R2 and a Durable Object namespace. Self-host ships a Docker image. Vercel needs Turso and Vercel Blob. Firebase needs the Blaze plan. App Store Server API key, Google Play service account, store subscription products, an email provider, an operator token (`ADMIN_TOKEN`).
- Legal: terms of service, privacy policy and disclaimer are all new and must exist before launch (accounts, uploads, sharing, purchases, promotions, copyright takedown, Spotify previews, deletion of inactive accounts, data export and its retention). The web sets no cookies. Coverage and update rules: `docs/legal/README.md`.
- Docs: new `docs/architecture/BACKEND.md`, `docs/architecture/CHINA.md` and `docs/features/premium/SPEC.md`. Sync, auth, sharing, events, customization, media, memos, testing and CI docs updated. Share service docs marked as superseded.

## Out of Scope

- Comments (later change; visibility and moderation rules recorded in design D12).
- Collaborative memos: memos are visible to the owner only.
- Launching in mainland China (separate change; see `docs/architecture/CHINA.md`).
- Full-track Spotify playback in the app and Spotify sign-in (a short preview plays where Spotify allows it, design D15).
- Spotify links in the custom audio library.
- Sign-in, joining, editing and history on the web (design D17).
- Choosing Premium Plus features.
- Purchases on the web.
- Push notifications (planned in change `design-v2-features`).
- Desktop and web apps (the share web page is in scope).
- Tooling to move data from one provider to another.
