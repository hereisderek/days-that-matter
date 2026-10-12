# Feature Specification: Plans & Premium Features

This file is the list of what each plan includes. The code source of truth is the plan table in `:core:model` (`Plan`, `Feature`, limits), used by both the app and the backend. **Any change to a plan's features or limits updates the plan table and this file in the same PR.**

Normative requirements: the [`premium`](../../../openspec/changes/pluggable-backend-live-sharing/specs/premium/spec.md) spec. Backend side: [`BACKEND.md`](../../architecture/BACKEND.md) sections 8 and 11.

---

## 1. Plans

| Plan | Key | Status |
| :--- | :--- | :--- |
| Free | `free` | Default for every account and for guests |
| Premium | `premium` | Sold as an App Store and Google Play subscription |
| Premium Plus | `premium_plus` | Reserved. Includes everything in Premium. Not sold until features are assigned |

---

## 2. Feature and Limit Table

Counts are per account. "Owned events" counts the owner's events. Every other count is what that account added, on its own events or as an editor of someone else's. Events shared with you never count.

| Feature or limit | Key | Free | Premium | Premium Plus |
| :--- | :--- | :--- | :--- | :--- |
| Owned events | `events` | 10 | 500 | as Premium until decided |
| Photo backdrops in use (still or animated) | `photos` | 5 | 300 | |
| Animated photos in use (iPhone Live Photo, Google Motion Photo) | `animated_backdrop` | 0: preview only, paywall on save, "Use still photo" offered | 30 | |
| Built-in audio tracks | `premium_audio` | free tracks only (initial catalog: 5) | all tracks | |
| Custom audio files in use (AAC, at most 4 MB each; a file counts while it is in the library or used by a day) | `custom_audio` | 0: preview only, paywall on save, also for a file already in the library | 20 | |
| Spotify links (events where the account set one) | `spotify_events` | 3 | no separate limit | |
| Sync, sharing, invites, history, memos, data export | - | yes (needs an account) | yes | yes |
| Unit modes, card sizes, archive, pinned carousel, reminders and notifications (change `design-v2-features`) | - | yes | yes | yes |
| Still photo backdrops | - | within `photos` | within `photos` | |

File sizes are capped on every plan, to prevent abuse: photos at most 1.5 MB (motion part 4 MB), audio files at most 4 MB. The app compresses photos and converts audio automatically when a file is too big, so users never resize anything themselves. Other fixed limits for every plan (links per event, members per event, rate limits) are in `BACKEND.md` section 11.2.

---

## 3. Rules

1. **Gating follows the writer's own plan.** Only an account whose plan includes a feature can add it, on its own events or as an editor of someone else's. A free editor on a Premium owner's event sees the paywall. The backend enforces the same rule (`402 premium_required`).
2. **Viewing is never gated.** Members and link visitors see animated photos animated and hear Premium tracks whatever their plan. Custom audio plays for members only, never on public links (copyright).
3. **Try before buying:** picking and previewing a paid feature is free. The paywall appears on Save and offers a free alternative where one exists ("Use still photo").
4. **Paid plans have limits** to prevent abuse. Over a paid limit the app says the limit is reached; the backend returns `429 quota_exceeded`.
5. **Limits never delete anything.** Reaching a limit or ending a plan only blocks adding more. Existing animated photos, tracks, audio files and Spotify links keep working. A free user whose first sign-in brings them above the event limit keeps all events.
6. **Guests** follow the free plan on the device and can buy Premium; the purchase attaches to the account at sign-in.
7. **Custom audio counting:** a custom audio file counts toward `custom_audio` while it is in the uploader's library or used by any day. Removing it from the library frees the slot only when no day uses it.
8. **Promotions:** the operator can grant a plan for a period without a store purchase (for example, free Premium for a month). The account's plan is the highest of its store purchases and active grants. When a grant ends, rule 5 applies: content added and quota used during the grant stay and keep working; only adding more above the free limits is blocked.

---

## 4. Purchases

- In the app only: StoreKit 2 on iOS (through a Swift bridge), Play Billing Library on Android. No purchases on the web.
- Verified by our backend directly with Apple (signed transactions, App Store Server Notifications V2, App Store Server API) and Google (Play Developer API). No RevenueCat: no 1% fee, no extra vendor in every purchase, and it works from a China-hosted backend (design D14).
- "Restore purchases" on every paywall and in settings resends the device's current entitlements.
- Plan: the highest of the account's active store purchases and active operator grants (`grants` table, BACKEND.md section 8).

---

## 5. Premium Plus Candidates (not decided)

Ideas to evaluate, not commitments: higher counts than Premium, more members per event, more public links per event, comment settings (anonymous comments) when comments ship.
