# Design: Design v2 features

Reference architecture: [`docs/architecture/BACKEND.md`](../../../docs/architecture/BACKEND.md). UI source: [`design/v2/README.md`](../../../design/v2/README.md). This change builds on the active change [`pluggable-backend-live-sharing`](../pluggable-backend-live-sharing/) (backend core and variants, sync, owner-only fields, `GET /config`, plan table). Motivation: see proposal.md, Why.

## Context

- The owner decided the unit modes, card size, memo badge, archive, pinned carousel and notifications on 2026-10-12. Smart days are a draft ("don't need to be thorough"). Adding people by name is under consideration, not decided.
- Platform facts that shape the design:
  - iOS keeps at most 64 pending local notifications per app.
  - Android 13 and later need the `POST_NOTIFICATIONS` runtime permission. Exact alarms need a separate permission that Android 14 denies by default.
  - App Store Review Guideline 4.5.4: push notifications for promotions need the user's explicit opt-in and a way to opt out in the app.
  - APNs takes requests over HTTP/2 only, with a provider token (ES256 JWT) valid for up to 1 hour. FCM HTTP v1 takes OAuth 2 access tokens from a service account.
  - FCM is not available in mainland China.
  - Cloudflare Workers Free: 10 ms CPU and 50 subrequests per invocation.

## Goals / Non-Goals

**Goals:**
- Every rule that changes a number (units, workdays) lives in `:core:model`, so the app and the share page agree.
- Personal choices (archive, reminders) never change what other people see.
- Notifications work without a network where they can (reminders), and cost little on the backend where they cannot (push).

**Non-Goals:**
- Public holidays in the Workdays unit.
- Sharing smart days.
- Push in China.
- Notifications on the web.

## Decisions

### D1. Six unit modes in the shared engine

- `UnitMode { Auto, Days, Weeks, Hours, Calendar, Workdays }`, API values `auto`, `days`, `weeks`, `hours`, `calendar`, `workdays`.
- Auto: days, then hours and minutes when less than 48 hours remain. Days: total days. Weeks: weeks and days ("22 w 4 d"). Hours: whole hours to the exact time. Calendar, shown "Y·M·D": years, months and days.
- Workdays: Monday to Friday only. Countdowns count the days after today up to and including the target day. Count-ups count from the day after the start up to and including today. Public holidays are not skipped yet; region holiday sets come later (D7).
- `unitMode` stays a shared field: owners and editors change it, viewers cannot.
- The countdown vectors (task 2.7 of the active change) cover every unit, so `countdown.js` on the share page matches the app.

Alternatives: a unit chosen per person on their device (lost: the owner chooses how the day reads for everyone, and the web page needs one value); workdays with public holidays now (lost: needs region holiday sets, which come with smart days); a configurable work week (lost for now: Monday to Friday covers the typical uses, deadlines, leave and retirement).

### D2. Card size is part of the shared look

- `CardSize { Small, Medium, Large }` in `EventCustomization`, shared as `theme.size`, default Medium.
- Home list heights: Small 64 pt (emoji, title, number), Medium 84 pt (adds the date line and unit), Large 132 pt (a 44 pt number, the date and repeat line, a live ticker). In the grid, Large spans two columns.
- The pinned carousel, the day page, widgets, share images and the web page ignore size.

Alternatives: a personal size per device (lost: the owner wants size to be part of the day's look); one density setting for the whole list (lost: one day cannot stand out).

### D3. The memo badge position comes from remote config

- An owner's card shows a badge with the memo icon and count ("9+" above 9) when the day has memos: on list rows, grid tiles and pinned cards. Never for members, on web pages, on widgets or in share images, because memos are owner-only.
- Position: `GET /config` returns `"ui": {"memoBadge": "top-left" | "top-right"}`, default `top-right`. `top-left` hangs from the top edge, 24 pt from the left edge; `top-right` sits flush with the right edge, 10 pt from the top (on pinned cards below the emoji). The operator sets it per deployment without an app release. The app caches the last config and uses the defaults offline.

Alternatives: a user setting (lost: one more setting for a small detail); fixed in the app (lost: changing it would need a release).

Effect on providers: none; `ui` is part of each deployment's config.

### D4. Archive is personal

- Owners: `archivedAt` is an owner-only field on the event. It syncs to the owner's devices and is never shared.
- Members: `members.archived_at`, set with `PATCH /events/{id}/membership` `{"archived": true}`. The member projection includes `archived`. Archiving a day shared with you affects only you.
- Archiving hides the day from Home (list, grid, pinned carousel, filters, search) and from widget choices. A row at the bottom of the Home list ("Archived · 3") opens the Archived screen, where days open normally and offer Unarchive and Delete (Leave for days shared with you).
- Archiving a pinned day unpins it: the core clears `pinnedAt` in the same write. Unarchiving does not pin it again.
- Reminders and change notifications are off for archived days. Archived owned days still count toward the owned-event limit.

Alternatives: a shared archive flag (lost: archiving would hide the day for everyone); a device-only archive (lost: does not follow the user to other devices); deleting instead (lost: users want to keep past days).

### D5. Pinned days are ordered newest pin first

- `pinnedAt` (owner-only, null = not pinned) replaces the boolean `pinned`. Any number of owned days can be pinned. The carousel shows them newest pin first.
- Members cannot pin days shared with them, because pin state is owner-only.
- Carousel behavior (focus, edges, dots, the list that follows, collapse to a 96 pt strip) is in the `home-screen` spec; Compose notes are in `design/v2/README.md` section 8.

Alternatives: `pinOrder` with drag to reorder (later, if users ask); one pinned day (dropped in design v2 revision 3); `pinned` and `pinnedAt` side by side (two fields that can disagree).

### D6. Reminders are local notifications; reminder choices are personal and synced

- Choices per day: on the day, 1 day before, 1 week before. Delivered at 9:00 local time by default. Reminders apply to the next occurrence of a repeating day; a one-time day that has passed sends none.
- Stored like archive: owners keep `reminders` as an owner-only field; members keep `members.reminders`. They sync to the person's devices, and each device schedules its own local notifications: iOS `UNUserNotificationCenter`, Android `AlarmManager.setAndAllowWhileIdle` (no exact alarm permission; delivery can be a few minutes late).
- iOS: at most 64 pending. The app schedules the nearest reminders and refills on app start and on background refresh (`BGAppRefreshTask`).
- The permission prompt appears when the user first sets a reminder or first shares a day, never at launch.

Alternatives: reminders sent as push from the backend (lost: needs a network and a server job per reminder, and costs requests on every provider); reminder choices kept on one device only (lost: a new device loses them).

### D7. Push notifications from the core: APNs and FCM HTTP v1

- Kinds sent by the backend: changes to shared days, added to a day, and offers and news. Reminders never use push.
- Changes: after an accepted write, the core notifies the owner and members except the author, skipping people who archived the day and devices without the `changes` kind. At most one notification per day per person per hour (a `rate_counters` key per person and event, 1-hour window); later changes in that hour send nothing and show in history. Text names the editor and the changed field, for example "Mum changed the date of Grandma's 90th". Never notes or memo text.
- Added to a day: sent when another person adds the account to a day. Today people join only through invites they open themselves, so this kind has no trigger until adding people by name is decided (open question).
- Offers and news: opt-in, off by default, at most 2 per month per device. The operator sends them with a command in each variant's runbook, like takedowns; there is no admin API for it.
- Delivery: APNs for iOS (`POST https://api.push.apple.com/3/device/{token}` over HTTP/2, provider token cached up to 1 hour) and FCM HTTP v1 for Android (`POST https://fcm.googleapis.com/v1/projects/{project}/messages:send`, access token from the service account cached 1 hour, as for the Play Developer API). Both are outbound `fetch` from the core, enabled by configuration.
- Devices: `PUT /me/devices/{installId}` `{platform, pushToken, locale, timeZone, kinds}` after sign-in and on app start when something changed; `DELETE` on sign-out. Tokens are removed on sign-out, when APNs or FCM reports them invalid, or after 90 days unused.
- Sending runs after the write's response (`waitUntil` on Cloudflare). Fan-out above the Workers Free limit of 50 subrequests per invocation continues in the event's Durable Object, at most 40 sends per alarm.

Effect on providers:
- cloudflare: whether Workers `fetch` reaches APNs over HTTP/2 needs a spike (task 3.1). Fan-out through the `EventRoom` Durable Object alarm.
- selfhost, vercel, firebase: Node can speak HTTP/2 to APNs (`node:http2`); no subrequest limit to work around.
- China: no FCM. Chinese Android builds need vendor push services or a domestic aggregator; iOS keeps APNs. Open point in `docs/architecture/CHINA.md`.

Alternatives: FCM for both platforms (FCM forwards to APNs; adds the Firebase Messaging SDK to the iOS app and Google to every iOS notification; the fallback if the APNs spike fails on Workers); a hosted push service such as OneSignal (another vendor and cost in every send; not usable in China); no push (lost: the owner wants change notifications).

### D8. Smart days (draft)

- A smart day is computed from a rule instead of one date. Model idea: `Event.kind = Date | Smart(ruleId, params)`.
- Initial rules: days left this year (with progress through the year), weekends left this year, public holidays left this year (region holiday set), workdays left this year (Monday to Friday minus public holidays).
- Seasonal templates are limited-time days offered only inside a season window, for example a Christmas countdown offered 1 November to 25 December, Lunar New Year, exam season. They come from a backend catalog like the audio catalog (`backend/core/smart/catalog.json`, `GET /smart/catalog`), so they change without an app release.
- Holiday sets come from the backend per region and year (`GET /holidays/{region}/{year}`), cached by the app.
- Smart days show under a "Smart" category and can be pinned, customized and archived. They cannot be shared yet.

Alternatives: holiday data bundled in the app (lost: fixing a holiday needs a release); a third-party holiday API called by the app (cost, privacy, and not reachable in every region).

## Risks / Trade-offs

- [APNs needs HTTP/2, which Workers `fetch` may not offer] → Spike first (task 3.1); FCM for both platforms is the fallback.
- [A change on a day with 100 members fans out to more than 50 subrequests on Workers Free] → Durable Object alarm batches of 40.
- [Change notifications feel noisy] → One per day per person per hour, a switch per kind, archive silences a day.
- [iOS drops reminders past 64 pending] → Nearest first, refill on start and background refresh.
- [App Review rejects promotional push] → Opt-in, off by default, at most 2 per month, a switch in Settings (guideline 4.5.4).
- [Workdays without public holidays read one day off around holidays] → The day page says public holidays are not skipped yet.
- [Reminders alert on every signed-in device] → Settings switches are per device.

## Migration Plan

Nothing has shipped. The fields and tables are added to the first migration of the active change (`0001_init.sql`) while it is unreleased, or as additive columns after it ships. Rollback: the app ignores unknown fields; the backend keeps the columns.

## Open Questions

- **Adding people by name** (under consideration, not decided): for people you already share a day with, add them to another day by typing their name; they get an "added to a day" notification. To decide: whether the person must accept first, how names are matched (display names are not unique), and whether this weakens the invite model. Until decided, the "added to a day" kind has no trigger.
- Reminders: should a setting change the 9:00 delivery time for all reminders?
- Offers and news: who writes them, and the exact runbook command per variant.
- Smart days:
  - Does a smart day count toward the owned-event limit (proposal: yes)?
  - Which regions' holiday sets come first, from which source, under which licence?
  - Does "weekends left" count weekends or weekend days?
  - How do smart days look on widgets and share images, and on the public page if sharing comes later?
  - Are seasonal templates free or Premium?
  - Do holiday sets later feed the Workdays unit, and how does the user pick a region?
