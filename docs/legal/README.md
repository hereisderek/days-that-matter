# Legal Documents: Terms of Service, Privacy Policy, Disclaimer

Status: **drafts written, awaiting owner inputs and legal review.** [`TERMS.md`](TERMS.md), [`PRIVACY.md`](PRIVACY.md) and [`DISCLAIMER.md`](DISCLAIMER.md) are version 1.0.0 drafts, last reviewed 2026-10-12. Before launch: fill in the owner inputs (section 5), answer the open questions (section 4), and have a lawyer review all three. Nothing in this repository is legal advice.

This file says which legal documents exist, what they must cover, and when they must be updated. **Any change that touches a trigger in section 3 updates the affected document in the same PR.**

---

## 1. Documents

| File | Published at | Purpose |
| :--- | :--- | :--- |
| [`docs/legal/TERMS.md`](TERMS.md) | `https://<domain>/terms`, linked on the sign-in screen, in settings and in page footers | Terms of service. Users agree to them when creating an account. |
| [`docs/legal/PRIVACY.md`](PRIVACY.md) | `https://<domain>/privacy`, same places | Privacy policy. Also required by the App Store and Google Play listings. |
| [`docs/legal/DISCLAIMER.md`](DISCLAIMER.md) | `https://<domain>/terms#content`, linked from every share page footer next to "Report" | Content and copyright disclaimer, and the notice-and-takedown process. |

Each document starts with a header: `Version`, `Effective date`, `Last reviewed`. A change that needs users to agree again raises the major version; the app asks signed-in users to agree again (accounts spec, "Terms of service and privacy policy").

Each region gets its own set. The China region needs documents under Chinese law (see [`CHINA.md`](../architecture/CHINA.md)).

---

## 2. Must cover (from the current design)

Sources: [`BACKEND.md`](../architecture/BACKEND.md), [`premium/SPEC.md`](../features/premium/SPEC.md), [`sharing/SPEC.md`](../features/sharing/SPEC.md), [`media/SPEC.md`](../features/media/SPEC.md), [`notifications/SPEC.md`](../features/notifications/SPEC.md) and the OpenSpec changes [`pluggable-backend-live-sharing`](../../openspec/changes/pluggable-backend-live-sharing/) and [`design-v2-features`](../../openspec/changes/design-v2-features/).

### Terms of service
- [x] Accounts: sign-in with Google, Apple or email codes; one account per verified email; in local mode data stays on the device only.
- [x] User content: users keep ownership; they give us a licence to store, process (compress, convert, remove photo metadata) and show it to the people they share it with.
- [x] **Users may only upload photos and audio they own or have the rights to use.** No per-upload prompt asks this; the terms are the only place.
- [x] Prohibited content (illegal content, abuse, content that infringes others' rights).
- [x] Sharing: public links can be opened by anyone with the link; invite links add members with viewer or editor roles; owners decide what they share and with whom.
- [x] Copyright: notice-and-takedown, counter-notice, DMCA designated agent contact, repeat-infringer policy (audio uploads blocked, then account termination).
- [x] Built-in audio: public domain recordings; Premium tracks for subscribers.
- [x] Spotify links: links to a third-party service; we do not host Spotify content. Where Spotify allows it, the app plays a short preview through Spotify's own player; full tracks play in Spotify.
- [x] Subscriptions: billed by Apple or Google, auto-renewal, cancelling in the store, refunds handled by the store, plan limits, what happens when a plan ends (existing content stays).
- [x] Promotions: we may grant Premium for a period without a purchase (for example, free Premium for a month); when it ends, content added during it stays and only adding more above the free limits is blocked.
- [x] Custom audio library: removing a file from the library does not stop it playing on days that use it; it is deleted once no day uses it.
- [x] Account deletion and what it removes.
- [x] Inactive accounts: accounts unused for 24 months (placeholder, owner to confirm) may be deleted after two emails 3 months apart, each with a data download link; deletion 3 months after the second email. Accounts with an active subscription or promotion are never deleted for inactivity. What happens when the emails do not arrive (open point; proposal: the schedule still applies).
- [x] Offers and news notifications: opt-in only, at most 2 per month, can be turned off in Settings.
- [x] Service availability, maintenance, limitation of liability, governing law and venue (owner input).
- [x] Changes to the terms and how users are told.
- [x] Minimum age (owner input).

### Local mode, import and export (the policy text needs the owner's review)
- [ ] Local mode stores every event, memo and setting on the device only and makes one request: the public remote configuration (`GET /api/v1/remote-config`), with no token and no identifier. A server still sees an IP address for that request, so the copy says what stays on the device and never claims the app is untraceable.
- [ ] Import moves events permanently into the account (they leave local mode on that device); the terms and privacy policy must say what the account then holds and how deletion works.
- [ ] Export files (.zip with events, memos and media) leave the app's control once saved; the user is responsible for where the file goes.
- [ ] `TERMS.md`, `PRIVACY.md` and `DISCLAIMER.md` still describe the old guest and automatic first-sign-in upload wording. This task did not edit them; the owner reviews and updates the policy text.

### Privacy policy
- [x] Data collected: account (email, display name, sign-in provider ids), last activity date, events, memos, edit history, photos (location and camera metadata removed), audio files and the audio library list, Spotify links, purchase records and plan grants, and per device for notifications: push token, locale, time zone and the enabled kinds. The web sets no cookies.
- [x] Notifications: reminders are scheduled on the device; push notifications go through Apple (APNs) and Google (FCM) and carry a day's title, an editor's display name and the changed field, never notes or memo text. Offers and news only with opt-in.
- [x] Spotify previews play through Spotify's own player, which may set its own cookies or collect data under Spotify's privacy policy.
- [x] Not collected: no analytics, no third-party trackers on share pages, raw IP addresses not stored (hashed daily for rate limits), no content in logs.
- [x] Where data is stored and who processes it: the hosting provider per region (Cloudflare for the global region), the email provider, Apple and Google for sign-in, purchases and push notifications, Spotify for previews.
- [x] Who sees what: public link visitors see shared fields only; members see shared fields and display names; notes and memos stay with the owner.
- [x] Retention: deleted events and memos 30 days, unused uploads 24 hours (a removed library audio file stays while a day uses it), sessions 90 days after last use, push tokens until sign-out or 90 days unused, data export links 30 days (or until the deletion date for inactive accounts), inactive accounts deleted after 24 months without use and two notices, provider backups (D1 Time Travel 7 days).
- [x] User rights: access and portability ("Download my data" in the app: a `data.json` file and the uploaded files, at most once per day), correction, deletion (account deletion in the app), and rights under GDPR, CCPA and other applicable laws; contact address.
- [x] Children (owner input on minimum age).
- [x] Changes to the policy.

### Disclaimer
- [x] Content on share pages is created by users and is their responsibility; we do not review it before it is shared.
- [x] How to report content ("Report" link) and how takedown works.
- [x] Countdown results are provided as is.
- [x] Third-party links (Spotify, app stores).

Placeholders the owner must fill in are listed in section 5; design points that are unclear are in section 4.

---

## 3. When to update

Update the affected document in the same PR when a change:
- collects, stores or shows new kinds of data, or changes who can see data (sharing, roles, comments);
- adds or changes uploads, file types or processing;
- adds a third-party service (sign-in method, mail, storage, purchases, music links);
- changes plans, prices, limits or what happens when a plan ends;
- changes retention, deletion or backups;
- adds a region or moves data to another provider or country.

Process:
1. Every OpenSpec proposal states its legal impact in **Impact**: `none`, or which documents change (rule in `openspec/config.yaml`).
2. The PR updates the documents here, raises the version and date, and ticks the checklist in section 2 for anything new.
3. A change that needs new consent raises the major version; the app asks for consent again.
4. Legal review before the release that ships the change.

---

## 4. Open questions

Design points that are unclear or contradictory. The drafts do not guess; where they had to say something, the entry says what they say now.

1. **How reports arrive.** Every share page has a Report link and every custom audio file a Report button, but no design doc says what they send or where. There is no report endpoint in `BACKEND.md`, share pages allow no forms (`form-action 'none'`), and the superseded share service used a `mailto:` link. The drafts assume reports reach the abuse address.
2. **Takedown steps the drafts promise.** `BACKEND.md` section 14 removes content but has no step to tell the user who added it. The disclaimer and terms promise to tell them what was removed and why (EU Digital Services Act Art. 17 statement of reasons; a counter-notice also needs the user to know). Takedown deletes the file, so a valid counter-notice cannot restore it; the drafts say "we let you add the content again". Legal review: whether that meets DMCA section 512(g), or whether removed files should stay hidden instead of deleted until the counter-notice period ends; and which DSA obligations apply (hosting service or online platform, micro or small enterprise exemption, complaint handling).
3. **Repeat-infringer threshold.** "Repeated valid notices" has no number. `accounts.audio_blocked` covers audio only; closing an account for photos would be a deletion with the provider's tools. The threshold can stay internal, but should be written down in the takedown runbook.
4. **Built-in audio source.** `BACKEND.md` section 15 lists "Licensed audio tracks" as an owner input, while section 10.2, design D15 and `media/SPEC.md` say the tracks are public domain recordings. The drafts say public domain. Fix section 15, or the drafts if tracks will be licensed.
5. **Spotify previews are an assumption** (design D15, task 7.9). If no supported preview method exists, remove the preview sentences from `TERMS.md` section 7, `PRIVACY.md` section 9 and `DISCLAIMER.md` section 7.
6. **Inactive accounts.** 24 months is a placeholder. When a notice email bounces, the drafts follow the proposal: the schedule still applies (`TERMS.md` section 12). Also unclear: which address gets the notices when an account's sign-in methods have different email addresses.
7. **Purchase records after account deletion.** The deletion list in `BACKEND.md` section 8 does not include `purchases`, and no retention period is set for purchase records, including guest purchases that are never attached. `PRIVACY.md` section 11 has no row for them yet.
8. **When account deletion removes data.** It is not stated whether owned days are removed at once or kept as tombstones for 30 days like a day the user deletes. `PRIVACY.md` section 11 says deleted days are removed after 30 days and backups after 7 more; the account deletion path must fit that.
9. **Local mode and "send nothing".** The local-mode spec allows only the remote configuration request (no identifier); local-mode users can also buy Premium (the purchase proof goes to `/purchases/*` without a session, premium spec), and the app may fetch `/config`, the audio catalog and holiday sets. The privacy policy mentions guest purchases only. Reconcile the spec, then the policy.
10. **"Save a copy" of a public link** (`sharing/SPEC.md` section 3) is not in the OpenSpec specs. Unclear whether the copy keeps the backdrop photo and audio (as references to the original uploader's files, or as new uploads), and what takedown or deletion of the original does to copies. The drafts only say that revoking a link does not remove saved copies.
11. **Terms for local-mode users and link visitors.** Users accept the terms when they create an account; local-mode users and link visitors never see them. `TERMS.md` section 1 says sections 5 and 14 to 17 apply to their use. Legal review: whether that binds them, or whether "Use on this device" should show the same notice as the sign-in buttons.
12. **Cloudflare's own processing.** "No analytics" and "raw IP addresses not stored" describe our code. Check that the Cloudflare account matches: Web Analytics off, and Workers Logs, Logpush and observability settings keep no IP addresses or URLs with tokens beyond what `PRIVACY.md` says; find out how long Cloudflare keeps its own request logs.
13. **Adult content.** Whether legal sexual content is allowed on public links (App Store Review Guideline 1.2 on user-generated content). The drafts prohibit illegal, abusive and infringing content only.

---

## 5. Owner inputs needed

Every `[[OWNER: ...]]` placeholder in the three drafts. Replace each one everywhere it appears (`grep -n '\[\[OWNER' docs/legal/*.md`).

| Placeholder | Used in | What to supply |
| :--- | :--- | :--- |
| `[[OWNER: date]]` | TERMS, PRIVACY, DISCLAIMER | Effective date of version 1.0.0 |
| `[[OWNER: legal entity name]]` | TERMS, PRIVACY, DISCLAIMER | Legal name of the company or person running the service |
| `[[OWNER: legal entity address]]` | TERMS, PRIVACY, DISCLAIMER | Postal address of that entity |
| `[[OWNER: contact email]]` | TERMS, DISCLAIMER | General contact, also for contesting removals |
| `[[OWNER: privacy email]]` | PRIVACY | Address for privacy requests |
| `[[OWNER: abuse email]]` | TERMS, DISCLAIMER | Address for content reports (see open question 1) |
| `[[OWNER: DMCA agent name]]` | DISCLAIMER | Designated agent, registered with the US Copyright Office before launch |
| `[[OWNER: DMCA agent address]]` | DISCLAIMER | Agent's postal address, as registered |
| `[[OWNER: DMCA agent phone]]` | DISCLAIMER | Agent's phone number, as registered |
| `[[OWNER: DMCA agent email]]` | DISCLAIMER | Agent's email address, as registered |
| `[[OWNER: DMCA agent registration number]]` | DISCLAIMER | Registration number from the US Copyright Office |
| `[[OWNER: minimum age]]` | TERMS, PRIVACY | Minimum age to create an account |
| `[[OWNER: governing law]]` | TERMS | Law that governs the terms |
| `[[OWNER: courts]]` | TERMS | Courts for disputes (venue) |
| `[[OWNER: liability cap]]` | TERMS | Cap on total liability, for example the amount paid for Premium in the 12 months before the claim |
| `[[OWNER: confirm 24 months]]` | TERMS, PRIVACY | Confirm the inactivity period, then remove the placeholder (also in `BACKEND.md` section 17 and the accounts spec) |
| `[[OWNER: email provider]]` | PRIVACY | Transactional email provider (`BACKEND.md` section 12 names Resend or Postmark as candidates) |
| `[[OWNER: data location]]` | PRIVACY | Where the global region's D1 database and R2 bucket are located (location hint or jurisdiction) |
| `[[OWNER: transfer safeguard]]` | PRIVACY | Legal basis for transfers abroad, for example the EU Standard Contractual Clauses |
| `[[OWNER: EU and UK representative, if required]]` | PRIVACY | GDPR Art. 27 representative, needed when the entity has no establishment in the EU or the UK; remove the line otherwise |
