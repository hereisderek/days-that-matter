# Proposal: Pluggable backend and live shared events

## Why

Today a share publishes a frozen snapshot through a TypeScript service that only runs on Cloudflare, and account sync is planned on Firestore. That means two backends, no way to change provider, no live updates, no per-person access or editing, no photos, and no way to sell Premium features. Nothing is deployed yet, so changing direction now costs the least.

## What Changes

- One backend: a core with all behavior in `backend/core/`, and one variant per provider in its own directory (`backend/cloudflare/`, `backend/selfhost/`, `backend/vercel/`, `backend/firebase/`). Variants only implement three ports: store, blob storage and live updates.
- The core is written in Kotlin/JS or TypeScript, whichever is cheaper and faster in a measured spike. Either way, the rules come from `:core:model`, the app's shared Kotlin module.
- **BREAKING** (docs only, nothing shipped): the backend replaces Firestore and Firebase Auth. The app talks to one HTTP API on every provider.
- Signed-in users sync everything: events and memos now, comments when they ship. Sync runs automatically after each edit. A Sync button syncs at once and reminds the user that edits sync automatically. Guests stay local and are asked to sign in or create an account when they try to sync or share.
- **BREAKING**: shares are no longer snapshots, and manage tokens and guest links are removed. Sharing needs an account. A link shows the event itself and updates live.
- An event can have several public, read-only links and one people link. People join through one-time invite URLs. Both inviter and invitee need an account. An invite is consumed when it is linked to an account, not when it is opened. It opens the app when installed and asks for sign-in or sign-up in the app or on the web.
- Editors can change the event in the app or on the web. Every change is a revision with author and old and new values. Owners and editors can view history and restore.
- Backdrops: still photos for everyone; animated photos from iPhone Live Photos and Google Motion Photos as a Premium feature. Free users can add and preview one; saving shows the paywall and offers to use the still photo instead. Viewers always see animated photos.
- Background audio: a built-in catalog served by the backend (a few tracks free, the rest Premium), and Spotify links (free on up to 3 events, unlimited on Premium). Picking your own audio files is removed.
- Plans Free, Premium and Premium Plus (reserved), with one plan table shared by app, backend and docs. Purchases through the App Store and Google Play, verified by the backend.
- The share web page gains live updates, web sign-in and sign-up (redirect, no third-party scripts), the people link and invite flows, a small editor with history, backdrop display and audio playback.
- `services/share/` (TypeScript) is frozen as a behavior reference and removed once the Cloudflare variant reaches parity.

## Capabilities

### New Capabilities

- `backend-portability`: one API contract and one set of limits on every supported provider, live update mode discovery, conformance as the definition of "supported", maintenance mode.
- `accounts`: local use without an account, the sign-in prompt, Google and Apple sign-in and sign-up, first sign-in upload, sessions, display names, account deletion.
- `event-sync`: what syncs, automatic sync after edits, the Sync button, offline-first edits, field-level merge, owner-only fields and memos, shared validation, deletion and lost access, live updates in the app.
- `event-history`: revisions, who can see them, restore, retention.
- `event-sharing`: sharing needs an account, public links, revocation, the people link, invites and their flow, roles, changing and removing access, the shared field allow-list, deep links.
- `share-web`: page states, countdown parity, live changes, web sign-in and sign-up, web editing and history, audio on the page, link previews, page privacy and security, open in app, accessibility.
- `event-backdrops`: still and animated photos, on-device conversion, backend limits, metadata removal, playback rules, readability, lifecycle, quota.
- `event-audio`: the built-in catalog, Premium tracks, Spotify links and their free limit, playback in the app and on the web.
- `premium`: plans, the shared plan table, paywall on save, gating by the event owner's plan, viewers unaffected, purchases and restore, plan verification, ending Premium.

### Modified Capabilities

None. `openspec/specs/` is empty. Current behavior is described in `docs/features/`, and those docs are updated in this change.

## Impact

- Code: `:core:model` (Android, iOS, JVM, JS); `backend/core/` with `migrations/`, `web/`, `audio/` and `conformance/`; four variant directories. `services/share/` and `.github/workflows/share-service.yml` are removed later.
- App: Firebase SDK removed. Ktor client, Google and Apple sign-in, sync engine with memos and a Sync button, share and history screens, Live Photo and Motion Photo conversion, paywall and RevenueCat, audio catalog player, Spotify links.
- API: a new `/api/v1` contract, not compatible with the undeployed share API. Deep link paths `/e/{token}` and `/i/{token}`.
- Infrastructure: Cloudflare adds R2 and a Durable Object namespace. Self-host ships a Docker image. Vercel needs Turso and Vercel Blob. Firebase needs the Blaze plan. RevenueCat project and store subscription products.
- Docs: new `docs/architecture/BACKEND.md` and `docs/features/premium/SPEC.md`. Sync, auth, sharing, events, customization, media, memos, testing and CI docs updated. Share service docs marked as superseded.

## Out of Scope

- Comments: posting, settings and anonymous comments (later phase; they will sync like memos).
- Collaborative memos: memos are visible to the owner only.
- In-app Spotify playback and Spotify sign-in (blocked by Spotify's API access rules, see design D15).
- Choosing Premium Plus features.
- Purchases on the web.
- Email sign-in with one-time codes.
- Push notifications.
- Desktop and web apps (the share web page is in scope).
- Tooling to move data from one provider to another.
