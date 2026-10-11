# Legal Documents: Terms of Service, Privacy Policy, Disclaimer

Status: **not written yet.** Composing them is an open agent task ("Compose terms, privacy policy and disclaimer"). They need a legal review before launch. Nothing in this repository is legal advice.

This file says which legal documents exist, what they must cover, and when they must be updated. **Any change that touches a trigger in section 3 updates the affected document in the same PR.**

---

## 1. Documents

| File | Published at | Purpose |
| :--- | :--- | :--- |
| `docs/legal/TERMS.md` | `https://<domain>/terms`, linked on the sign-in screen, in settings and in page footers | Terms of service. Users agree to them when creating an account. |
| `docs/legal/PRIVACY.md` | `https://<domain>/privacy`, same places | Privacy policy. Also required by the App Store and Google Play listings. |
| `docs/legal/DISCLAIMER.md` | `https://<domain>/terms#content`, linked from every share page footer next to "Report" | Content and copyright disclaimer, and the notice-and-takedown process. |

Each document starts with a header: `Version`, `Effective date`, `Last reviewed`. A change that needs users to agree again raises the major version; the app asks signed-in users to agree again (accounts spec, "Terms of service and privacy policy").

Each region gets its own set. The China region needs documents under Chinese law (see [`CHINA.md`](../architecture/CHINA.md)).

---

## 2. Must cover (from the current design)

Sources: [`BACKEND.md`](../architecture/BACKEND.md), [`premium/SPEC.md`](../features/premium/SPEC.md), [`sharing/SPEC.md`](../features/sharing/SPEC.md), [`media/SPEC.md`](../features/media/SPEC.md) and the OpenSpec change [`pluggable-backend-live-sharing`](../../openspec/changes/pluggable-backend-live-sharing/).

### Terms of service
- [ ] Accounts: sign-in with Google, Apple or email codes; one account per verified email; guests keep data on the device only.
- [ ] User content: users keep ownership; they give us a licence to store, process (compress, convert, remove photo metadata) and show it to the people they share it with.
- [ ] **Users may only upload photos and audio they own or have the rights to use.** No per-upload prompt asks this; the terms are the only place.
- [ ] Prohibited content (illegal content, abuse, content that infringes others' rights).
- [ ] Sharing: public links can be opened by anyone with the link; invite links add members with viewer or editor roles; owners decide what they share and with whom.
- [ ] Copyright: notice-and-takedown, counter-notice, DMCA designated agent contact, repeat-infringer policy (audio uploads blocked, then account termination).
- [ ] Built-in audio: public domain recordings; Premium tracks for subscribers.
- [ ] Spotify links: links to a third-party service; we do not host or play Spotify content.
- [ ] Subscriptions: billed by Apple or Google, auto-renewal, cancelling in the store, refunds handled by the store, plan limits, what happens when a plan ends (existing content stays).
- [ ] Account deletion and what it removes.
- [ ] Service availability, maintenance, limitation of liability, governing law and venue (owner input).
- [ ] Changes to the terms and how users are told.
- [ ] Minimum age (owner input).

### Privacy policy
- [ ] Data collected: account (email, display name, sign-in provider ids), events, memos, edit history, photos (location and camera metadata removed), audio files, Spotify links, purchase records, session cookie on the web.
- [ ] Not collected: no analytics, no third-party trackers on share pages, raw IP addresses not stored (hashed daily for rate limits), no content in logs.
- [ ] Where data is stored and who processes it: the hosting provider per region (Cloudflare for the global region), the email provider, Apple and Google for sign-in and purchases.
- [ ] Who sees what: public link visitors see shared fields only; members see shared fields and display names; notes and memos stay with the owner.
- [ ] Retention: deleted events and memos 30 days, unused uploads 24 hours, sessions 90 days after last use, provider backups (D1 Time Travel 7 days).
- [ ] User rights: access, correction, deletion (account deletion in the app), and rights under GDPR, CCPA and other applicable laws; contact address.
- [ ] Children (owner input on minimum age).
- [ ] Changes to the policy.

### Disclaimer
- [ ] Content on share pages is created by users and is their responsibility; we do not review it before it is shared.
- [ ] How to report content ("Report" link) and how takedown works.
- [ ] Countdown results are provided as is.
- [ ] Third-party links (Spotify, app stores).

### Owner inputs needed
Legal entity name and address, jurisdiction, contact and abuse addresses, DMCA agent registration, minimum age.

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
