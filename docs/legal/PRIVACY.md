# Privacy Policy

- Version: 1.0.0
- Effective date: [[OWNER: date]]
- Last reviewed: 2026-10-12

> Draft. It needs legal review before publication and is not legal advice.

> Scope: the global region. The China region needs separate documents under Chinese law (see [CHINA.md](../architecture/CHINA.md)).

---

## 1. Who we are

[[OWNER: legal entity name]], [[OWNER: legal entity address]] ("we", "us") runs Days That Matter: the iOS and Android apps, the share web pages and the servers behind them ("the service"). We are the controller of the personal data described here.

Privacy questions and requests: [[OWNER: privacy email]].
EU and UK representative: [[OWNER: EU and UK representative, if required]].

## 2. Summary

- Without an account, your days and memos stay on your device. We have no copy.
- With an account, we store what you put in the app so it syncs and so you can share it.
- Notes and memos are visible only to you.
- Photos are stored without location or camera metadata.
- No analytics, no third-party trackers, no ads. Share pages set no cookies.
- We do not store raw IP addresses.
- We do not sell your personal data.
- You can download your data and delete your account in the app.

## 3. Guests

If you use the app without an account, your days and memos are stored only on your device. The app does not send them to us. If you delete the app, they are gone.

If you buy Premium as a guest, the app sends the store's purchase proof to us so we can verify it. We store the purchase record without an account until you sign in.

## 4. Data we collect

With an account, we store:

| Data | What it includes |
| :--- | :--- |
| Account | Display name, plan, the date of your last signed-in use, the dates of any inactive account notices, when the account was created. |
| Sign-in methods | For each method: the provider (Google, Apple or email), the provider's id for you, and your email address and whether the provider verified it. Your email address is shown only to you. |
| Sign-in codes | When you sign in with email: a keyed hash of the 6-digit code, valid for 10 minutes. We never store the code itself. |
| Sessions | A hash of each device's session token, and when it was created and last used. |
| Days | Everything you enter for a day you own: shared fields (title, emoji, date, time, time zone, unit display, repeat setting, theme, backdrop, audio choice) and private fields (notes, pin state, category, archive state, reminder choices). |
| Memos | The text and milestone tag of your memos, and when you wrote them. |
| Edit history | For each change to a day: who made it, when, and the old and new values of each changed field. |
| Sharing | Your public links (with labels and expiry dates), invites (role, number of uses, expiry), members and their roles, and people you removed. For days shared with you: your role, and your own archive and reminder choices. |
| Photos | Backdrop photos and the moving part of animated photos, with size, dimensions and duration. Location, camera and other metadata are removed; a moving part with location data or a sound track is rejected. |
| Audio | Your custom audio files, their titles, sizes and durations, and your audio library list. |
| Spotify links | The link, and the title and artist the app looked up. |
| Purchases and promotions | For each store purchase: the store, the store's transaction or purchase token id, the product, the plan, status and expiry. Promotions we gave your account: plan and dates. We never receive your payment card details. |
| Devices for push notifications | Per device: platform (iOS or Android), push token, language and region setting (locale), time zone, the notification kinds you turned on, and when the device last contacted us. |
| Data export links | A hash of each link's token and its expiry date. |
| Rate limit counters | Short-lived counters keyed by your account id, a hash of an email address, or a hash of your IP address that changes every day. |

## 5. What we do not collect

- We use no analytics and no third-party trackers or ads, in the app or on share pages.
- Share pages set no cookies, load no third-party scripts, fonts or frames, and send no referrer.
- We do not store raw IP addresses. Rate limits use a hash of the IP address combined with the date and a secret, so it changes every day.
- Our server logs record only the time, the type of request, the result and a request id. They never contain the content of your days or memos, titles, emails, codes, tokens, push tokens, IP addresses or Spotify links.
- Apple and Google may give us aggregated statistics and crash reports about the app, under their own settings and policies.

## 6. Why we use your data, and our legal bases

| Purpose | Data | Legal basis (GDPR) |
| :--- | :--- | :--- |
| Run your account, sync your days and memos, share them, show history, play audio | Account, sign-in methods, sessions, days, memos, history, sharing, photos, audio, Spotify links | Contract |
| Apply your plan and verify purchases | Purchases and promotions | Contract |
| Send change notifications | Devices | Contract |
| Send offers and news | Devices (only if you turned offers and news on) | Consent |
| Send sign-in codes, data export links and inactive account notices | Email address | Contract |
| Prevent abuse, keep the service secure, rate limits | Rate limit counters, sessions | Legitimate interests |
| Handle reports and copyright notices | The reported content and the account that added it | Legitimate interests, legal obligation |
| Delete inactive accounts | Date of last signed-in use | Legitimate interests (not keeping data longer than needed) |

## 7. Notifications

- **Reminders** are scheduled by the app on your device. We only sync your reminder choices between your devices.
- **Push notifications** (changes to shared days, being added to a day) are sent through Apple Push Notification service (APNs) and Firebase Cloud Messaging (FCM). A notification carries the day's title, the editor's display name and the name of the changed field. It never carries notes or memo text.
- **Offers and news** are sent only if you turn them on in Settings › Notifications, at most 2 per month per device.
- We remove a device's push token when you sign out on it, when Apple or Google says the token is no longer valid, or after 90 days without contact from the device.

## 8. Who sees your data

| Who | What they see |
| :--- | :--- |
| You | Everything in your account, on every device where you are signed in. |
| Anyone with a public link | The day's shared fields only. No names, no account details, no custom audio. |
| Messaging apps where a public link is pasted | The preview: title, countdown and backdrop photo. |
| A signed-in person who opens an invite link | The day's title, the owner's display name and the role, before joining. |
| Members (viewers and editors) | The day's shared fields, and the display names and roles of the owner and other members. Custom audio files on the day. |
| Editors | Also the day's edit history, without changes to private fields. |
| People who receive change notifications | The day's title, the editor's display name and the changed field. |

Notes, memos, your audio library, your email address and your account id are never shown to other users.

A signed-in person who opens a public link in the app can save a copy of the day's shared fields to their own account.

## 9. Service providers

We share data only with the providers that run parts of the service for us:

| Provider | What they do | Data they process |
| :--- | :--- | :--- |
| Cloudflare | Hosts the service: servers, database, file storage, live updates. Checks images served from our media domain against known child sexual abuse material (CSAM Scanning Tool). | All data in section 4. Cloudflare handles your IP address to deliver each request. |
| [[OWNER: email provider]] | Sends sign-in codes, data export links and inactive account notices. | Your email address and the email text. |
| Apple | Sign in with Apple, App Store purchases, push notifications (APNs). | Sign-in data, purchase records, push tokens and notification text. On iOS, the app attaches your account id to a purchase so Apple's records match ours. |
| Google | Google sign-in, Google Play purchases, push notifications (FCM). | Sign-in data, purchase records, push tokens and notification text. |
| Spotify | When you add a Spotify link, the app asks Spotify for the title and artist. Where Spotify allows it, a preview plays through Spotify's own player, which may set its own cookies or collect data under Spotify's privacy policy. "Open in Spotify" opens Spotify. | The link, and what Spotify collects from your device. |

We may also disclose data when the law requires it, or to protect people's safety or our rights.

We do not sell your personal data and do not share it for cross-context behavioral advertising.

## 10. Where your data is stored

Each region is a separate deployment, and accounts and data stay in their region. The global region runs on Cloudflare. Its database and file storage are located in [[OWNER: data location]]. Cloudflare's network handles requests in data centers around the world. When data moves to a country without an adequate level of protection under your law, we use [[OWNER: transfer safeguard]].

## 11. How long we keep data

| Data | How long |
| :--- | :--- |
| Account, days, memos, photos, audio, sharing | Until you delete them or your account, or the account is deleted for inactivity. |
| Edit history | At least the latest 200 changes per day; older changes can be removed. Deleted with the day. |
| Deleted days | 30 days, then removed with their history and memos. |
| Deleted memos | The text is removed at once. A record that the memo existed is kept for 30 days, so your other devices learn about the deletion. |
| Photos and audio files that nothing uses | 24 hours. A custom audio file removed from your library stays while any day uses it, then 24 hours. |
| Revoked or expired links and invites | 30 days. |
| Sessions | Until you sign out, or 90 days after last use. |
| Push tokens and device settings | Until you sign out on the device, the token becomes invalid, or 90 days without contact. |
| Sign-in codes | 10 minutes; removed at the next daily cleanup. |
| Rate limit counters | 2 days. |
| Data export links | 30 days after the request, or until the deletion date for an inactive account. |
| Inactive accounts | Deleted after 24 months [[OWNER: confirm 24 months]] without signed-in use and two email notices; see the [Terms](TERMS.md), section 12. |
| Database backups | 7 days (Cloudflare D1 Time Travel). |
| Removed photos in caches | Up to 1 day. |

When you delete your account, we delete the data listed in the [Terms](TERMS.md), section 11. Deleted data is gone from backups within 7 days. Text changes you made to other people's days stay in their history, shown as "Deleted user".

## 12. Security

- Data travels over HTTPS only.
- Session tokens, invite tokens, data export tokens and sign-in codes are stored only as hashes. Invite links are also stored encrypted, so owners can copy them on any device.
- On your device, the session token is stored in the iOS Keychain or Android encrypted storage.
- Data export links work for anyone who has them until they expire. Do not forward them.

## 13. Your rights

You can do most of this in the app:
- **Access and portability:** Settings › Account › "Download my data". We email you a link to a page with a `data.json` file (your account, your days, days shared with you, memos, the history you wrote, sharing settings, your audio library list) and each file you uploaded. Once per day; the link works for 30 days.
- **Correction:** edit your days, memos and display name in the app.
- **Deletion:** delete days, memos, photos and audio in the app, or delete your account (Settings › Account › Delete Account).
- **Withdraw consent:** turn off offers and news in Settings › Notifications.

You also have rights under the GDPR, the UK GDPR, the California Consumer Privacy Act (CCPA) and other laws that apply to you, such as the right to object to processing based on legitimate interests and the right to restrict processing. Write to [[OWNER: privacy email]]. We may ask you to send the request from the email address of your account, so we know it is you. We answer within the time the law sets. We do not treat you differently for using your rights.

You can complain to the data protection authority where you live.

## 14. Children

The service is not for children under [[OWNER: minimum age]]. We do not knowingly collect personal data from them. If you think a child under that age has an account, write to [[OWNER: privacy email]] and we will delete it.

## 15. Changes to this policy

The version and effective date at the top change with every update. If a change needs your agreement, the app asks you to agree again before you continue using your account.

## 16. Contact

[[OWNER: legal entity name]], [[OWNER: legal entity address]]. Privacy: [[OWNER: privacy email]].
