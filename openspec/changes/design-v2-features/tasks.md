# Tasks

Order: groups 1 and 2 need only `:core:model` and the app; groups 3 and 4 need the backend of the active change [`pluggable-backend-live-sharing`](../pluggable-backend-live-sharing/tasks.md) (groups 2 and 3 there). Paths and names refer to [`docs/architecture/BACKEND.md`](../../../docs/architecture/BACKEND.md).

## 1. Countdown units

- [ ] 1.1 Add the six `UnitMode` values and workday counting to the countdown engine in `:core:model`; verify unit tests for each unit, including workdays across a weekend, a target on a Saturday, a count-up started on a Friday, the target day itself, and Auto at 48 hours.
- [ ] 1.2 Add every unit to the countdown vector generator (task 2.7 of the active change); verify `countdown.js` passes the new vectors and CI fails when the committed file differs from a fresh generation.
- [ ] 1.3 Accept the six API values in `unitMode` validation and reject a viewer's change; verify `:core:model` validation tests, a core test for `403 forbidden` from a viewer, and a conformance suite run on the cloudflare and selfhost variants.
- [ ] 1.4 Day page: tap the number to switch to the next unit, a list of all six, no control for viewers, and a note that public holidays are not skipped; verify ViewModel tests for owner, editor and viewer.

## 2. Home screen

- [ ] 2.1 Add `CardSize` to `EventCustomization` and `theme.size` to the API types and validation; verify JSON round-trip tests and that a missing `size` reads as Medium.
- [ ] 2.2 Draw list rows at 64, 84 and 132 pt, Large spanning two grid columns, and size ignored in the carousel, day page, widgets and share images; verify Compose UI tests for each size in list and grid.
- [ ] 2.3 Add the memo badge (icon and count, "9+" above 9) to owned cards in list, grid and carousel, positioned from cached `GET /config` `ui.memoBadge` with the default `top-right`; verify UI tests for both positions, a member's card without a badge, and offline first start with the default.
- [ ] 2.4 Add `ui.memoBadge` to `GET /config` from deployment config; verify a core test and a conformance suite run on the variants touched.
- [ ] 2.5 Add `archivedAt` (owner-only, clears `pinnedAt` in the same write), `members.archived_at`, `PATCH /events/{id}/membership` and `archived` in the member projection; verify core tests for owner and member archive, unpinning on archive, no pin on unarchive, archived days counting toward the owned-event limit, and a conformance suite run on every variant.
- [ ] 2.6 Hide archived days from Home, filters, search and widget choices; add the "Archived · N" row and the Archived screen with Unarchive and Delete (Leave for shared days); verify ViewModel tests and a UI test for the row.
- [ ] 2.7 Replace `pinned` with `pinnedAt` in `:core:model`, the API and Room, with no pin option on days shared with the user; verify projection tests (no `pinnedAt` or `archivedAt` outside the owner's projection) and DAO tests ordering pins newest first.
- [ ] 2.8 Build the pinned carousel (focus card, 16 pt edges at 92% and 60%, one card per swipe, dots, tap to centre or open), the list that follows and outlines the centred day, the fixed header, the 96 pt collapsed strip, hiding while searching or filtering, and the Settings switch; verify UI tests for each behavior and a manual run with reduce motion on both platforms.
- [ ] 2.9 Add `pinned_at`, `archived_at` and `reminders_json` to the Room schema with a migration; verify migration and DAO tests with an in-memory database.

## 3. Notifications

- [ ] 3.1 Spike: send one APNs notification from a Workers preview with `fetch` over HTTP/2, and measure CPU per send and the subrequest count for 100 recipients; verify a notification arrives on a real iPhone, or record the failure and switch design D7 to FCM for both platforms.
- [ ] 3.2 Add reminder choices (on the day, 1 day before, 1 week before; 9:00 local) per day, stored as the owner-only `reminders` field or on the membership; verify `:core:model` validation tests and a core test that `reminders` never reaches another account.
- [ ] 3.3 Schedule reminders as local notifications on iOS and Android, nearest first, at most 64 pending on iOS with refill on app start and background refresh, none for archived days or passed one-time days; verify scheduler unit tests with a fake clock (100 reminders keep the nearest 64) and a manual offline check on both platforms.
- [ ] 3.4 Ask for the notification permission when the user first sets a reminder or first shares a day, never at launch; verify a UI test on a fresh install for each path.
- [ ] 3.5 Add `PUT` and `DELETE /me/devices/{installId}` and the `devices` table, with token removal on sign-out, on an invalid-token answer and after 90 days unused (daily job); verify core tests for each removal path and a conformance suite run on every variant.
- [ ] 3.6 Implement the push sender in the core (APNs provider token, FCM HTTP v1 access token, per-kind filtering by device, the hourly limit per person and day, Durable Object fan-out on Cloudflare) and the change and added-to-a-day messages; verify core tests against fake APNs and FCM endpoints (no notes or memo text in any payload, one message for three edits in an hour, none for the author or archived days) and a conformance suite run on every variant.
- [ ] 3.7 Add offers and news: opt-in switch off by default, at most 2 per month per device, the operator command in each variant's runbook; verify a core test for the monthly cap and for devices without the kind.
- [ ] 3.8 Add Settings › Notifications with one switch per kind, sent as `kinds` on device registration; verify ViewModel tests.

## 4. Smart days (draft)

- [ ] 4.1 Answer the smart day open questions in design.md and turn the draft spec into final requirements; verify the owner approves the updated spec in the PR.
- [ ] 4.2 Add `Event.kind`, the four rules and their tests in `:core:model`; verify unit tests for each rule on 1 January, a leap day and 31 December.
- [ ] 4.3 Add `GET /holidays/{region}/{year}` and the smart day catalog with season windows to the core; verify core tests and a conformance suite run on every variant.

## 5. Docs and legal

- [x] 5.1 Update the privacy policy and terms in `docs/legal/` for push tokens, locale and time zone per device, their retention, and opt-in offers and news; verify the checklist in `docs/legal/README.md`.
- [ ] 5.2 Update `docs/features/*` and BACKEND.md for anything the work changed; verify by review in the PR.

## Workflow follow-up

- Archive the change with `openspec archive design-v2-features` after the active change is archived, so its specs move to `openspec/specs/`.
