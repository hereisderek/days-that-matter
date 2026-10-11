# Proposal: Pluggable backend and live shared events

## Why

Today a share publishes a frozen snapshot through a TypeScript service that only runs on Cloudflare, and account sync is planned on Firestore. That means two backends, no way to change provider, no live updates, no per-person access or editing, and no photos. The app and the service also implement the same rules (validation, countdown) in two languages. Nothing is deployed yet, so changing direction now costs the least.

## What Changes

- A new backend written in Kotlin, built from the same `:core:model` module as the app (models, validation, merge rules, countdown engine). It runs on Cloudflare, a self-hosted Node server, Vercel and Firebase. Each provider is an adapter behind three ports: store, blob storage and live updates.
- **BREAKING** (docs only, nothing shipped): the backend replaces Firestore for account sync. The app talks to one HTTP API on every provider. The Firebase SDK leaves the app.
- **BREAKING**: shares are no longer snapshots. A link shows the event itself and updates live when the owner or an editor changes it.
- **BREAKING**: manage tokens are removed. Links belong to an account. A guest gets an anonymous account on first share. Signing in with Google or Apple keeps the guest's links.
- An event can have several public, read-only links (each revocable, with optional expiry) and one people link. People get access through single-use invites with the role viewer or editor, and must sign in.
- Editors can change the event in the app or on the web. Every change is a revision with its author and the old and new values. Owners and editors can view history and restore a revision.
- Photo backdrops: still photos and short animations (video, Live Photo, GIF, animated WebP). The device compresses them to fixed limits. The backend strips location metadata. A still poster is shown when motion is reduced.
- The share web page gains live updates, web sign-in (redirect, no third-party scripts), the people link access flow, a small editor with history, and backdrop display.
- `services/share/` (TypeScript) is frozen as a behavior reference and removed once the Cloudflare adapter reaches parity.

## Capabilities

### New Capabilities

- `backend-portability`: one API contract and one set of limits on every supported provider, live update mode discovery, conformance as the definition of "supported", maintenance mode.
- `accounts`: use without an account, anonymous accounts, Google and Apple sign-in, sessions, upgrade and merge, display names, account deletion.
- `event-sync`: which events the backend stores, offline-first edits, field-level merge, owner-only fields, shared validation, deletion and lost access, live updates in the app.
- `event-history`: revisions, who can see them, restore, retention.
- `event-sharing`: public links, revocation, the people link, invites, roles, changing and removing access, the shared field allow-list, deep links.
- `share-web`: page states, countdown parity with the app, live changes, web sign-in, web editing and history, link previews, page privacy and security, open in app, accessibility.
- `event-backdrops`: backdrop types, on-device compression, backend limits, metadata removal, motion and data preferences, readability, lifecycle, quota.

### Modified Capabilities

None. `openspec/specs/` is empty. Current behavior is described in `docs/features/`, and those docs are updated in this change.

## Impact

- Code: new Gradle modules `:core:model` (Android, iOS, JVM, JS), `:server:core` (JVM, JS), `:server:cloudflare`, `:server:selfhost`, `:server:vercel`, `:server:firebase`. New `server/web/` (static assets and page scripts) and `server/conformance/` (HTTP test suite). `services/share/` and `.github/workflows/share-service.yml` are removed later.
- App: Firebase SDK removed. Ktor client, Google and Apple sign-in, a rewritten sync engine, share and history screens, backdrop compression (Media3 Transformer on Android, AVFoundation on iOS).
- API: a new `/api/v1` contract, not compatible with the undeployed share API. Deep link paths `/e/{token}` and `/i/{token}`.
- Infrastructure: Cloudflare adds R2 and a Durable Object namespace. Self-host ships a Docker image. Vercel needs libSQL (Turso) and Vercel Blob. Firebase needs the Blaze plan.
- Docs: new `docs/architecture/BACKEND.md`. Sync, auth, sharing, events, customization, media, memos, testing and CI docs updated. Share service docs marked as superseded.

## Out of Scope

- Comments on shared events, including anonymous comments visible only to the owner (future phase; the data model leaves room, see design.md).
- Email sign-in with one-time codes.
- Push notifications for collaborator edits.
- Memo sync across devices, collaborative memos and memos in shares. Memos stay on the device.
- Desktop and web apps (the share web page is in scope).
- Tooling to move data from one provider to another.
- Android Motion Photos and converting GIFs larger than 4 MB to video.
