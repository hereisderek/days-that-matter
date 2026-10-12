# Proposal: Design v2 features

## Why

The design v2 prototype (`design/v2/`) shows features that no spec covers yet: more countdown units, card sizes, a memo badge, archiving, the pinned carousel, smart days and notifications. They need requirements before the app is built. They build on the backend, sync and owner-only fields of the active change `pluggable-backend-live-sharing`.

## What Changes

- Countdown units: six unit modes, Auto, Days, Weeks, Hours, Calendar (shown "Y·M·D") and Workdays (Monday to Friday; public holidays not skipped yet). The unit is a shared field. The engine in `:core:model` and its test vectors cover all six.
- Home: a card size per day (Small, Medium, Large; part of the shared look), a memo badge on the owner's cards with its position set by remote config, a personal archive for owners and members with an Archived screen, and the pinned carousel with a list that follows it.
- Notifications: local reminders (on the day, 1 day and 1 week before), push notifications for changes to shared days and for being added to a day, and opt-in offers and news. Devices register with the backend; delivery through APNs and FCM.
- Smart days (draft): days computed from a rule (days, weekends, public holidays and workdays left this year), seasonal templates from a backend catalog, and public holiday sets per region.
- API (additive, no version change): `GET /config` gains `ui.memoBadge`; `theme.size`; new `unitMode` values; owner-only fields `pinnedAt` (replaces `pinned`), `archivedAt` and `reminders`; `PATCH /events/{id}/membership`; `PUT` and `DELETE /me/devices/{installId}`; draft routes for holiday sets and the smart day catalog.

## Capabilities

### New Capabilities

- `countdown-units`: the six unit modes, workday counting, who changes the unit, the unit switch on the day page, one engine with shared test vectors.
- `home-screen`: card sizes, the memo badge and its remote position, archive and the Archived screen, pinning, the pinned carousel, the list that follows it, the collapsing carousel.
- `notifications`: notification kinds and their switches, reminders, the iOS pending limit, changes to shared days, added to a day, offers and news, the permission prompt, quiet archived days, private content, device registration.
- `smart-days` (draft): smart day rules, seasonal templates, holiday sets per region, what smart days can do.

### Modified Capabilities

None. `openspec/specs/` is empty. The capabilities this change touches in the active change `pluggable-backend-live-sharing` (nothing has shipped) are edited there directly: its `event-sync` spec lists `pinnedAt` and `archivedAt` as owner-only fields.

## Impact

- Code: `:core:model` (unit modes and workday counting, card size, reminders, archive and pin fields; smart day rules later); app Home, day page, customization, settings and notification scheduling; backend core (membership patch, devices, push sender, config); Room schema.
- API: as listed in What Changes. Reference: `docs/architecture/BACKEND.md` sections 6, 7 and 18.
- Infrastructure: an APNs auth key from Apple and a Firebase project with a service account for FCM HTTP v1 (owner inputs, BACKEND.md section 15).
- Plans: none of these features is gated; every plan has them, and `docs/features/premium/SPEC.md` does not change. Archived owned days still count toward the owned-event limit.
- Legal: the privacy policy changes (push tokens, locale and time zone per device, kept until sign-out or 90 days unused; offers and news are opt-in). The terms change (offers and news). The disclaimer does not change. Checklist: `docs/legal/README.md`.
- Docs: new `docs/features/notifications/SPEC.md`; events, customization, memos, widgets and sharing specs, BACKEND.md, PERSISTENCE_AND_SYNC.md, CHINA.md and the legal checklist updated.

## Out of Scope

- Public holidays in the Workdays unit (later, with the region holiday sets of smart days).
- Sharing smart days.
- Adding people to a day by typing their name (under consideration; design.md open questions).
- Push notifications in mainland China (no FCM; open point in `docs/architecture/CHINA.md`).
- Dragging to reorder pinned days (pins are ordered newest first).
- Pins and categories for days shared with you.
- Notifications on the web and on desktop.
- Live Activities and ongoing notifications.
