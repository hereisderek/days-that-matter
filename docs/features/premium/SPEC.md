# Feature Specification: Plans & Premium Features

This file is the list of what each plan includes. The code source of truth is the plan table in `:core:model` (`Plan`, `Feature`, limits), used by both the app and the backend. **Any change to a plan's features or limits updates the plan table and this file in the same PR.**

Normative requirements: the [`premium`](../../../openspec/changes/pluggable-backend-live-sharing/specs/premium/spec.md) spec. Backend side: [`BACKEND.md`](../../architecture/BACKEND.md) section 8.

---

## 1. Plans

| Plan | Key | Status |
| :--- | :--- | :--- |
| Free | `free` | Default for every account and for guests |
| Premium | `premium` | Sold as an App Store and Google Play subscription |
| Premium Plus | `premium_plus` | Reserved. Includes everything in Premium. Not sold until features are assigned |

---

## 2. Feature Table

| Feature | Feature key | Free | Premium | Premium Plus | Spec |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Events, countdowns, widgets, memos | - | yes | yes | yes | events, memos |
| Sync across devices (needs an account) | - | yes | yes | yes | `event-sync` |
| Public links, people link, invites | - | yes | yes | yes | `event-sharing` |
| History and restore | - | yes | yes | yes | `event-history` |
| Still photo backdrop | - | yes | yes | yes | `event-backdrops` |
| Animated photo backdrop (iPhone Live Photo, Google Motion Photo) | `animated_backdrop` | preview only; paywall on save, "Use still photo" offered | yes | yes | `event-backdrops` |
| Built-in audio tracks | `premium_audio` | free tracks only (initial catalog: 5) | all tracks | all tracks | `event-audio` |
| Spotify links | `spotify_events` | up to 3 owned events | unlimited | unlimited | `event-audio` |
| Backdrop storage | - | 100 MB | 100 MB | 100 MB | `event-backdrops` |

Viewing is never gated: people with access and link visitors see animated backdrops and hear Premium tracks whatever their plan.

---

## 3. Rules

1. **Gating follows the event owner's plan**, for every writer (owner or editor), in the app and on the backend (`402 premium_required`).
2. **Try before buying:** picking and previewing a gated feature is free. The paywall appears on Save and offers a free alternative where one exists.
3. **Ending a plan keeps existing content:** animated backdrops keep playing, Premium tracks keep playing, Spotify links stay. Only new Premium content follows the free plan.
4. **Purchases:** in the app only (StoreKit on iOS, Play Billing on Android, through RevenueCat). Guests can buy; the purchase moves to the account at sign-in. "Restore purchases" on every paywall and in settings. No purchases on the web.
5. **Verification:** the backend reads the plan from RevenueCat (`POST /me/plan/refresh` after purchase and on expiry, daily re-check). It never trusts the plan the app reports.

---

## 4. Premium Plus Candidates (not decided)

Ideas to evaluate, not commitments: larger backdrop storage, more people per event, more public links per event, comments settings (anonymous comments) when comments ship.
