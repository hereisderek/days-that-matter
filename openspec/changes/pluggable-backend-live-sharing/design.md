# Design: Pluggable backend and live shared events

Reference architecture (directories, ports, variants, schema, API table, limits): [`docs/architecture/BACKEND.md`](../../../docs/architecture/BACKEND.md). China: [`docs/architecture/CHINA.md`](../../../docs/architecture/CHINA.md). This file records the decisions behind them. Motivation: see proposal.md, Why.

## Context

- The repo has no app code yet. `services/share/` is a working TypeScript service (Hono, D1, Static Assets, 179 tests) for snapshot links with manage tokens. Nothing is deployed.
- Priorities set by the project owner: performance and low running cost come before code sharing. The backend is one core with all functionality and one directory per provider variant.
- Hard platform limits that shape the design:
  - Cloudflare Workers Free: 10 ms CPU per request, 100,000 requests per day, D1 100,000 rows written per day, 3 MB compressed script.
  - Durable Objects Free: SQLite-backed objects only, 100,000 requests and 13,000 GB-s per day.
  - Vercel Functions: 4.5 MB request body. Hobby plan is for non-commercial use only.
  - Firebase Cloud Functions: need the Blaze (pay as you go) plan.
  - Spotify: since 15 May 2025, Web API extended access only goes to registered businesses with at least 250,000 monthly active users. Development mode allows a handful of allowlisted users. Starting a track on demand through the mobile SDKs needs Spotify Premium. The Web API stopped returning `preview_url` for new apps in November 2024. Spotify's embed player (iFrame) plays previews to listeners who are not logged in.
  - Mainland China: Google services and Google Play are unavailable; RevenueCat's API host has been reported DNS-blocked; apps in Apple's China storefront need an MIIT filing, in practice a Chinese entity or local publisher with a backend hosted in China (see CHINA.md).

## Goals / Non-Goals

**Goals:**
- Low CPU per request and low cost at small scale; free on Cloudflare and self-host.
- One backend core with all behavior. Changing provider means choosing another variant directory, never changing the core or the app.
- One source of truth for rules shared by app and backend: `:core:model`.
- One plan table for free and paid limits, used by the app, the backend and the docs.
- Nothing in the global design blocks a later China deployment.

**Non-Goals:**
- Running one deployment across several providers at once.
- Launching in mainland China in this change (separate change, see D16).
- Moving live data between providers.
- Real-time co-editing of text.
- Full-track Spotify playback in the app (see D15).
- Sign-in, editing and history on the web (see D17).

## Decisions

### D1. Backend language: TypeScript now, Kotlin/JS kept open

Decided by the owner on 2026-10-14 without the planned spike: `backend/core` is written in **TypeScript**. Rules still come from `:core:model`, the shared Kotlin module, as generated contract files (JSON Schema of the API types, the plan table as JSON, test vectors for validation, merge and countdown), checked in CI (task 2.8).

Why TypeScript first:
- Smaller bundles and faster start, which matters under the Workers Free limit of 10 ms CPU per request.
- `services/share/` is a head start (Hono, D1, 179 tests); see D13.
- Kotlin/JS cold starts on Workers are reported at 100 to 200 ms, and cost matters more than sharing code.

What Kotlin/JS would give us, and what we accept losing for now:
- One implementation of validation, patch and merge, role projections, the plan table and the countdown engine. No second copy to keep in step and no generated contract.
- The app tests and the backend tests exercise the same code.
- One language across app and backend.

How TypeScript covers the gap: the generated `backend/core/contract/` is regenerated in CI and fails on any difference; the countdown vectors are generated from `:core:model` and `countdown.js` must pass them; validation and merge vectors do the same for those rules.

Revisit and move to Kotlin/JS (a new change) when any of these holds:
- Rules drift between the model and the core causes repeated bugs.
- Keeping the contract and vectors in step costs more than it saves.
- The core has grown so large that two copies of the rules are a real burden.
- A measurement of the same two routes (link read, event patch) on a Workers preview shows Kotlin/JS with warm CPU at most 1.25 times TypeScript, startup at most 100 ms and a gzip bundle at most 1 MB.

Keeping a later move cheap: handlers stay thin and call the ports; no web framework beyond a tiny router; the HTTP conformance suite is black-box, so a Kotlin/JS core can replace the TypeScript one route by route against the same suite. Every other decision here holds for either language.

Alternatives: run the spike first (rejected by the owner for now; it stays available under the revisit triggers); Ktor on the JVM (no JVM on Workers or Vercel); Kotlin/Wasm (less proven on Workers).

### D2. One core directory, one directory per variant, small ports

```
backend/core/          all behavior: API, auth, sync, sharing, history, media checks, plans, purchases, audio, pages, purge
                       + migrations/, web/, audio/catalog.json, conformance/
backend/cloudflare/    variant: entry, D1, R2, Durable Object, cron, wrangler config
backend/selfhost/      variant: Node entry, SQLite file, disk storage, WebSocket hub, SMTP mailer, Dockerfile
backend/vercel/        variant: handler, Turso (libSQL), Vercel Blob, cron
backend/firebase/      variant: function entry, Firestore, Cloud Storage, Hosting config
```

Ports: `Store` (use-case level; `SqlStore` over a tiny `SqlDriver` for D1, `node:sqlite` and libSQL; `FirestoreStore`), `BlobStore` (put, get, delete, public URL), `LiveHub` (publish; mode `ws` or `poll`), `Mailer` (send one email; HTTP API by default, SMTP on self-host), plus `Clock`, `Random`, `Config`. A variant holds only port implementations, an entry file and deploy config. All SQL variants use the SQLite dialect.

Outbound HTTP integrations that do not depend on the host (Google and Apple keys, App Store and Google Play APIs, the email API) live in the core and are switched on by configuration.

Alternatives: Postgres for Vercel (second dialect); an ORM (bundle size and CPU); a port per table (Firestore needs transactions inside one call).

### D3. The backend stores events and memos; sharing grants access to the stored event

An event lives on the backend as one document with a revision number. Sync, live links, members and history work on that document. Memos live next to it (D6). A public link is a capability to read a projection of the event.

### D4. Accounts: Google, Apple and email codes; sign-in methods are plug-ins

- Anything online needs an account: sync, creating links and invites, joining through an invite. Viewing a public link does not. Guests keep full local use and get a sign-in prompt on Sync, Share, Invite and once after their first saved event.
- Methods: Sign in with Google, Sign in with Apple, and email with a 6-digit one-time code. First sign-in creates the account. Each method is an `IdentityProvider` in the core (verify a credential, return a subject, verified email and name); the deployment config lists the enabled ones and `GET /config` tells the app which buttons to show. WeChat or phone codes can be added the same way (needed for China).
- An identity whose verified email matches an existing identity's verified email joins that account. Users can also add methods from account settings.
- Email codes: stored as an HMAC with a server secret, valid 10 minutes, 5 attempts, rate limited per address and IP. No passwords: hashing does not fit 10 ms CPU on Workers Free, and there is no reset flow to build.
- Sessions are opaque tokens stored hashed, held by the app. The web has no sessions (D17).
- Sign in with Apple on Android runs Apple's web flow in an in-app browser tab. Apple posts the result to `POST /auth/apple/callback`, which redirects it to the app; the app then signs in with the ID token like iOS. The callback sets no cookie.

Alternatives: anonymous accounts (removed: the owner wants an account for anything online); Firebase Auth (ties every provider to Google, blocked in China); email and password (CPU and reset flows).

### D5. Field-level last-write-wins plus a revision log

A write is `{baseRev, patch}` with new values for top-level fields. The server applies it in arrival order, appends a revision `{patch, inverse}`, and returns the fields where the write replaced a change made after `baseRev` by someone else. Nested objects (theme, recurrence, backdrop, audio) are replaced whole. Memos use the same patch rule without revisions.

Alternatives: reject stale writes (bad offline UX); CRDTs (overkill for about 12 small fields).

### D6. Sync: event manifest plus a per-event child sequence

- `GET /sync` returns `[{id, rev, role, childSeq}]` with an ETag; an idle sync is one `304`. Changed events are fetched in batches of 100. An event missing from the manifest was deleted or access was lost.
- Children (memos now, comments later) carry `seq` from a counter on their event. `GET /events/{id}/children?after=seq` returns changes and deletions; tombstones live 30 days, a client further behind gets `reset: true`.
- Auto sync runs within 2 seconds of each saved edit, on start and on foreground. The Sync button runs it at once and says edits sync automatically.

Alternatives: one cursor-based change feed per account (needs removed-access records and clock-safe cursors on every store).

### D7. Live updates are change notices over WebSocket or conditional polling

Messages carry no data: `{"type":"rev"}`, `{"type":"children"}` (owner only), `{"type":"access"}`. Clients refetch with `If-None-Match`, so authorization stays in the read path. Cloudflare: one Durable Object per event with the WebSocket Hibernation API. Self-host: in-process hub. Vercel and Firebase: polling every 20 seconds while visible.

Alternatives: Server-Sent Events (keep the Durable Object awake); a hosted realtime service (possible later as another `LiveHub`).

### D8. Share web is server-rendered HTML plus small plain ES modules

Pages: `/e/{token}` (public link: the event, view only, live) and two generic landing pages that open the app, `/i/{token}` (invite) and `/s/{eventId}` (member link) (D17). Scripts: `countdown.js` and `live.js`, on public link pages only. The data export page (`/export/{token}`, D18) and the operator page (`/admin/storage`, D19) share no code with event pages.

Alternatives: Compose Multiplatform for Web (multi-megabyte, canvas); a SPA framework.

### D9. Backdrops: stills for everyone, animated photos for Premium writers

- Sources: any still photo; iPhone Live Photos; Motion Photos in Google's format. Other formats fall back to the still. No GIFs or plain videos.
- The device converts: stills and key photos to JPEG or WebP; motion to H.264 MP4, at most 1280 px and 5 seconds, audio removed. H.264 because not every browser plays HEVC.
- Animated photos exist only when a writer with a plan that includes them saved one. Viewers see them animated whatever their plan. Display: plays once on open and on touch, then rests on the key photo; reduced motion shows the key photo.
- Per-plan counts limit photos in use (D14). With count limits and per-file size limits, total storage is bounded, so there is no separate storage quota.
- The core checks types from magic bytes, reads dimensions and duration from headers, strips EXIF and XMP, rejects MP4 with audio or a location atom. No server transcoding. Uploads go through the API with a 4 MB cap (fits Vercel's 4.5 MB body limit).
- Each backdrop has a shared `dim` (0 to 0.8) and `blur` (0 to 16, a radius at a 390 pt card width, scaled with the card; photo and art backdrops). The app and the public link page render both; the server never blurs. Compose `Modifier.blur` needs Android 12; below that the app draws a pre-blurred, downscaled bitmap. Blur was dropped once because the web editor would have needed it; with no web editor (D17) it is back.

Alternatives: presigned direct uploads (four mechanisms); server transcoding (CPU and cost); storing original HEIC and MOV (HEVC not playable in every browser); a pre-blurred copy made on the server (CPU and a second file per backdrop).

### D10. Tokens

Public link tokens are read capabilities for data in the same database, so they are stored in clear and owners can copy links on any device. Invite tokens, session tokens, data export tokens and email codes grant access or prove identity, so they are stored hashed. The operator token (`ADMIN_TOKEN`, D19) is a deployment secret; it is never stored in the database or shipped in the apps.

### D11. Members join through invite links with a role, a use count and an expiry

- Two kinds of sharing: **public links** (view only, no account, up to 10 per event) and **invite links** (sign-in in the app required, the receiver joins the event as a member with the invite's role, viewer or editor).
- The owner sets each link's expiry: 5 days, 30 days, never, or a custom date up to 5 years ahead. Invites also have a use count: 1, 5, 10, unlimited, or a custom number from 1 to 100. Opening an invite uses nothing; each new member who joins uses one. Defaults: public link never expires; invite 30 days, 1 use.
- Members see the event in their app (editable or not by role). `/s/{eventId}` opens the event in the app; in a browser it is a generic landing page (D17). Joining through an invite happens in the app only. The owner can change a member's role, remove them or cancel an invite. A removed member cannot rejoin through any invite until the owner allows them again.
- At most 100 members per event; owners and existing members opening an invite use nothing.

Alternatives: one-time invites only (the owner asked for counts); one shared people-link token (an extra secret with no benefit once membership is checked); invite by email address (needs delivery; Apple private relay addresses do not match).

### D12. Comments come later; rules recorded now

Not built in this change. Rules from the owner: comments have the same visibility as the event (members see members' comments; on public links, comments are shown to visitors only if the owner allows comments there); the owner can hide or remove any comment; an owner setting allows anonymous comments, which only the owner sees. Comments will be event children (D6), so they sync like memos. Memos stay owner-only.

### D13. Retire the TypeScript share service

`services/share/` is frozen. TypeScript is the chosen core language (D1), so its code is the starting point of `backend/core`, and its tests become the reference. When the Cloudflare variant passes conformance, it is deleted.

### D14. Plans, limits and native store purchases

- Plans: `free`, `premium`, `premium_plus` (reserved). One plan table in `:core:model` holds every limit; [`docs/features/premium/SPEC.md`](../../../docs/features/premium/SPEC.md) lists the same values.
- **Gating uses the writer's own plan.** Only an account whose plan includes a feature can add it, on its own events or as an editor on someone else's. Counted limits (photos, animated photos, audio files, Spotify events) count what that account added. Owned-event limits count the owner's events. Viewing is never gated.
- Paid plans have limits too, to prevent abuse (for example 30 animated photos in use).
- Going over a limit never deletes anything; it blocks adding more. When a plan ends, existing content stays.
- **Promotions:** the operator can grant a plan to an account for a period without a store purchase (`grants` table; for example one month of Premium), with the provider's own tools, like takedowns. The plan is the highest of active store purchases and active grants. When a grant ends, the lapsed-plan rule applies: content added and quota used during the grant stay and keep working; only adding more above the free limits is blocked. Alternatives: store offer codes (Apple offer codes, Google Play promo codes) are tied to one store and need a redeem step in the store; they stay possible next to grants.
- Free users can pick and preview a paid feature; Save shows the paywall with a free alternative where one exists.
- **Purchases are verified with Apple and Google directly, not through RevenueCat.**
  - iOS: StoreKit 2 through a small Swift bridge. The app sends the signed transaction (JWS); the core checks the certificate chain to Apple's root, bundle id and expiry. App Store Server Notifications V2 report renewals, refunds and expiry. `appAccountToken` carries the account id.
  - Android: Play Billing Library. The app sends the purchase token; the core calls the Google Play Developer API (`purchases.subscriptionsv2.get`) with a service account, acknowledges the purchase and stores the expiry.
  - Re-check: daily for expired plans, and on a gated write whose plan looks expired. Google real-time notifications (Pub/Sub) can be added later.
  - Guests can buy; the app sends its current entitlements after sign-in to attach them to the account. "Restore purchases" does the same.

| | RevenueCat | Native (chosen) |
| :--- | :--- | :--- |
| Cost | free up to 2,500 USD monthly tracked revenue, then 1% | none beyond the store fee |
| Work | one KMP SDK, dashboard, paywall tools; little server code | Swift bridge for StoreKit 2, Play Billing, JWS checks, Play API, notifications, edge cases (grace period, billing retry, refunds, upgrades) |
| China | API host reported DNS-blocked; no Huawei or other Chinese Android stores | Apple verification works from a China-hosted backend; Chinese stores can be added as more verifiers |
| Dependency | another vendor in every purchase and plan check | none |

Native is chosen because cost comes first and China matters. RevenueCat would ship faster; it remains the fallback if the native work slips.

### D15. Background audio: built-in catalog, custom files for Premium, Spotify links

- Built-in tracks: `backend/core/audio/catalog.json`, files in the blob store (AAC, at most 4 MB). A few free, the rest need the writer's plan to include them. Anyone who can see an event can play its track.
- Built-in tracks are public domain recordings chosen by the project owner.
- Custom audio files (Premium): the app converts the file to AAC at most 4 MB (about 5 minutes; longer files are trimmed to a section the user picks) and uploads it to the account's library (`POST /me/library`), not to one event. A day then references a library file of the writer. Served only through the access-checked audio route: to the uploader, and to the owner and members of days that use it. Not played on any web page, because publishing user-uploaded music to anyone with a link is a copyright risk.
- Library: the audio picker's "My library" tab lists the account's files, newest first, with the number of days using each. Removing a file from the library only hides it; days that use it keep playing it for their owner and members. A file counts toward the plan's custom audio limit while it is in the library or used by a day, and is deleted 24 hours after it is neither. The library belongs to the uploading account and syncs across its devices; members never see it. Alternatives: files tied to one event (the same song is uploaded again for each day, and each copy counts); deleting the file on removal (silences days without warning, including other people's).
- User uploads remain a copyright risk even for members: most user audio is commercial music, and playing it to up to 100 members is distribution, on a paid feature. Mitigations, so the service can rely on hosting safe harbours (US DMCA section 512, EU Digital Services Act notice and action):
  - the terms of service and disclaimer say users may only upload photos and audio they own or have the rights to use, and users agree to them when creating an account (no prompt on each upload; see `docs/legal/README.md`);
  - a Report button on every custom audio file, and a takedown runbook that removes the file within 24 hours;
  - a repeat-infringer policy: the operator can block an account from uploading audio;
  - a registered DMCA designated agent (US Copyright Office) before launch;
  - no download button, no search, no public listing of files.
  - A stricter option, if counsel prefers: custom audio plays for the owner only. Not chosen now.
- Spotify links: shared or pasted `open.spotify.com` track, album or playlist links; title from Spotify's public oEmbed endpoint. Free plan: 3 events, counted for the account that set them. Unavailable in China.
- Spotify preview (**assumption, to check in task 7.9**): the owner reports that Spotify lets apps play a short part of a track. The app plays a short preview (about 30 seconds) inside the app where Spotify allows it; for albums and playlists, the first track (also an assumption). "Open in Spotify" plays the full item in Spotify. Known facts for the check: the Web API stopped returning `preview_url` for new apps in November 2024; the embed player (iFrame) plays previews to listeners who are not logged in. If no supported way exists, playing only opens Spotify. The share web page keeps "Listen on Spotify" and loads no Spotify content.

Alternatives: full-track in-app Spotify playback (blocked by Spotify's access rules until 250,000 monthly users, and needs Spotify Premium); public URLs for audio files (anyone could fetch Premium or user-uploaded tracks).

### D16. Regions, and China as a separate deployment

- A **region** is one independent deployment: its own domain, database, blob store, enabled sign-in methods, purchase verifiers and features. Accounts and data stay in their region; there is no cross-region sync.
- The app picks the region once (on iOS from the App Store storefront country; China Android builds are separate builds for Chinese stores) and keeps it.
- `GET /config` reports the region's live mode, sign-in methods, purchase stores and features (Spotify), so the same app hides what a region does not offer.
- China would be the self-host variant on a mainland cloud (Alibaba Cloud or Tencent Cloud), with Apple, email and phone or WeChat sign-in, Apple purchases plus Chinese Android stores, no Spotify and no Google. It also needs a Chinese entity or publisher, ICP and app filings, data kept in China under PIPL, and content review for public pages. Details and open points: CHINA.md. It is a separate OpenSpec change.

Alternatives: one global deployment reachable from China (Cloudflare serves mainland China only through JD Cloud with an ICP licence; Apple's China storefront needs a filed app with a China-hosted backend).

### D17. Web pages are read-only for now

Decided by the project owner on 2026-10-12.

- The share web has one event page: the public link `/e/{token}` (view only, live changes, built-in audio, previews).
- Invite links `/i/{token}` and member links `/s/{eventId}` open the app through App Links and Universal Links. In a browser they show a generic page with an open-in-app button and store links: no event details, no sign-in. The page is the same for every token or id, valid or not, so it reveals nothing. Preview tags are generic. The core renders it from a constant per region, with no store access.
- Joining happens only in the app: the receiver installs the app and opens the invite again.
- Removed from the earlier design: web session and OAuth cookies, the CSRF header rule, `/auth/*` pages for browsers, `401 sign_in_required`, `editor.js`, web history, and custom audio on member pages. Kept: `POST /auth/apple/callback`, which Sign in with Apple on Android needs (D4). It hands Apple's result to the app and creates no browser session.
- Effect on providers: none beyond fewer routes.

Alternatives: web sign-in plus web editing and history, as first designed (D8 before this decision). It lost because it adds auth flows, cookies, CSRF rules, an editor and their tests before launch. Revisit after launch. An invite page with event details for visitors without the app lost too: anyone holding the link would see the title before joining.

### D18. Inactive accounts and data export

- An account is inactive after 24 months (placeholder, owner to confirm) without any signed-in use: any authenticated request from any device. `accounts.last_active_at` is written at most once per day. Accounts with an active or grace store subscription, or an active grant, are never inactive.
- Schedule: email 1 gives a deletion date 6 months later and a data download link. 3 months later, email 2 gives the same date and a fresh link. On that date the account is deleted exactly like a user-requested deletion. Any signed-in use stops the process and clears the notices.
- Data export: `data.json` (account, events with all fields, memos, revisions the account authored, sharing settings, library list) plus the account's uploaded files, listed on `/export/{token}` with one download link each. Valid until the deletion date (inactivity) or 30 days (user request: Settings › Account › "Download my data", at most 1 per day, link sent by email).
- Details, email texts and how to check or pause the job: BACKEND.md section 17.
- Effect on providers: on Workers Free a daily run makes at most 50 subrequests, so it sends at most 40 emails and the rest go out on the following days. Self-host may also offer the export as one ZIP file.

Alternatives: keep accounts forever (storage and retention without end, against the storage limitation principle of the GDPR); delete without notice (users lose data they wanted); one ZIP file on every provider (zipping several MB does not fit 10 ms CPU on Workers; self-host may offer a ZIP); files as email attachments (size limits).

### D19. Operator storage report

- `GET /api/v1/admin/storage` and a minimal page `/admin/storage` show storage per account, highest first, sortable by bytes, files or last activity. Protected by `Authorization: Bearer <ADMIN_TOKEN>`, an operator secret that never ships in the apps; rate limited.
- Counters `accounts.media_bytes` and `accounts.media_files` change in the same write as each media insert and delete. Sorting reads one index on every store, including Firestore, which has no GROUP BY. The default order is by media bytes. Document bytes (event and memo documents) are summed only for the rows on the page, because a documents counter would add a row write to every event and memo write.
- This is the only operator API. Takedowns, upload blocks and grants stay with the provider's own tools.

Alternatives: SQL queries through each provider's console (different per variant; Firestore has no GROUP BY); summing `media` rows on each request (a full scan per page view); a full admin API (not needed yet).

## Risks / Trade-offs

- [Rules drift between the Kotlin model and the TypeScript core] → The generated contract and vectors fail CI on any difference (task 2.8); D1 lists when to revisit Kotlin/JS.
- [Native purchases take longer than RevenueCat and miss edge cases] → Store sandbox tests for renewal, grace period, refund and restore; RevenueCat stays a fallback.
- [Free tier caps on Cloudflare] → Budget in BACKEND.md; Workers Paid past about 30,000 page views per day.
- [Vercel Hobby forbids commercial use; Firebase needs Blaze] → Cloudflare is the primary variant.
- [Photos and audio on shared events raise abuse, copyright and illegal content risk] → Report link on every page, takedown runbook, Cloudflare CSAM Scanning Tool before launch, custom audio never on public pages, members only.
- [User-uploaded photos and audio may be copyrighted] → Rights clause in the terms accepted at sign-up, Report button, 24 hour takedown, repeat-infringer block, DMCA agent (D15). Legal review before launch; this design is not legal advice.
- [A removed backdrop stays reachable through caches for up to 1 day] → Documented.
- [Last-write-wins can overwrite a collaborator's change to the same field] → History, restore, and a notice to the writer.
- [Unlimited invites can spread beyond the intended people] → Default is 1 use; owners see every member, can remove them and cancel the invite; removed members cannot rejoin.
- [Auto-linking identities by verified email] → Only provider-verified emails and email codes count; Apple private relay addresses never match, which is safe.
- [Email delivery costs and spam filtering] → One HTTP mail provider, rate limits per address and IP; self-host can use SMTP.
- [Spotify links depend on the user having Spotify] → Opens Spotify on the web when the app is missing.
- [In-app Spotify previews may not be available to new apps] → Checked in task 7.9 before building; otherwise playing only opens Spotify (D15).
- [Deleting inactive accounts removes data a user still wanted] → Two emails 3 months apart, each with a download link; any sign-in stops it; subscribers and grant holders are never inactive (D18).
- [A large account's `data.json` needs more CPU than one Workers request allows] → Streamed page by page from the store; split into several files if a measured export goes over.
- [The operator token leaks] → It reads the storage report only, is rate limited, and is rotated by changing the secret (D19).
- [China requirements are legal, not technical] → Kept out of this change; the global design only adds region config and pluggable sign-in, mail and purchase verifiers.

## Migration Plan

1. Nothing is deployed, so there is no data migration. Owner setup items from `docs/plans/SHARE_SERVICE_STATUS.md` still apply; R2, a Durable Object namespace, the media domain, store products, an App Store Server API key, a Google Play service account and an email provider are added.
2. Build in the order of tasks.md. `services/share/` stays until task 5.5 removes it.
3. The app ships against Cloudflare (global region) first. Self-host is usable for local development and private installs once its conformance run passes.
4. Rollback per variant: `wrangler rollback`, previous Docker image tag, Vercel instant rollback, previous Cloud Functions revision. Migrations only add tables or columns.

## Open Questions

- Comments: whether public link visitors can comment at all, and how anonymous comments are moderated (decided in the comments change).
- Which features go to Premium Plus.
- China: entity or publisher, cloud provider, Android stores, sign-in methods (CHINA.md).
- Push notifications: planned in change `design-v2-features`; comments add their own kind later.
- Inactive accounts: confirm 24 months. What to do when a notice email bounces or an account has no email address (proposal: keep the schedule; the terms say so).
- Spotify previews: which supported method exists, if any (D15, task 7.9).
- Web sign-in and editing: revisit after launch (D17).
