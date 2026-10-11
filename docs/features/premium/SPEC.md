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

## 2. Feature and Limit Table (initial values)

Counts are per account. "Owned events" counts the owner's events. Every other count is what that account added, on its own events or as an editor of someone else's. Events shared with you never count.

| Feature or limit | Key | Free | Premium | Premium Plus |
| :--- | :--- | :--- | :--- | :--- |
| Owned events | `events` | 10 | 500 | as Premium until decided |
| Photo backdrops in use (still or animated) | `photos` | 5 | 300 | |
| Animated photos in use (iPhone Live Photo, Google Motion Photo) | `animated_backdrop` | 0: preview only, paywall on save, "Use still photo" offered | 30 | |
| Built-in audio tracks | `premium_audio` | free tracks only (initial catalog: 5) | all tracks | |
| Custom audio files in use (AAC, at most 4 MB each) | `custom_audio` | 0: preview only, paywall on save | 20 | |
| Spotify links (events where the account set one) | `spotify_events` | 3 | no separate limit | |
| Sync, sharing, invites, history, memos | - | yes (needs an account) | yes | yes |
| Still photo backdrops | - | within `photos` | within `photos` | |

Fixed limits for every plan (file sizes, links per event, members per event, rate limits) are in `BACKEND.md` section 11.2.

---

## 3. Rules

1. **Gating follows the writer's own plan.** Only an account whose plan includes a feature can add it, on its own events or as an editor of someone else's. A free editor on a Premium owner's event sees the paywall. The backend enforces the same rule (`402 premium_required`).
2. **Viewing is never gated.** Members and link visitors see animated photos animated and hear Premium tracks whatever their plan. Custom audio plays for members only, never on public links (copyright).
3. **Try before buying:** picking and previewing a paid feature is free. The paywall appears on Save and offers a free alternative where one exists ("Use still photo").
4. **Paid plans have limits** to prevent abuse. Over a paid limit the app says the limit is reached; the backend returns `429 quota_exceeded`.
5. **Limits never delete anything.** Reaching a limit or ending a plan only blocks adding more. Existing animated photos, tracks, audio files and Spotify links keep working. A free user whose first sign-in brings them above the event limit keeps all events.
6. **Guests** follow the free plan on the device and can buy Premium; the purchase attaches to the account at sign-in.

---

## 4. Purchases

- In the app only: StoreKit 2 on iOS (through a Swift bridge), Play Billing Library on Android. No purchases on the web.
- Verified by our backend directly with Apple (signed transactions, App Store Server Notifications V2, App Store Server API) and Google (Play Developer API). No RevenueCat: no 1% fee, no extra vendor in every purchase, and it works from a China-hosted backend (design D14).
- "Restore purchases" on every paywall and in settings resends the device's current entitlements.

---

## 5. Premium Plus Candidates (not decided)

Ideas to evaluate, not commitments: higher counts than Premium, more members per event, more public links per event, comment settings (anonymous comments) when comments ship.
