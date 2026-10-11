# Feature Specification: Sharing, Deep Linking & Social Export

## 1. Overview & Goals
Users share milestone events with friends, family or followers through live links, a web page, exported images and QR codes. A shared event is the event itself, not a copy: when the owner or an editor changes it, every open link page and app shows the change.

Normative requirements (OpenSpec change [`pluggable-backend-live-sharing`](../../../openspec/changes/pluggable-backend-live-sharing/)):
- [`event-sharing`](../../../openspec/changes/pluggable-backend-live-sharing/specs/event-sharing/spec.md): links, people link, invites, roles, allow-list, deep links.
- [`share-web`](../../../openspec/changes/pluggable-backend-live-sharing/specs/share-web/spec.md): web page states, live changes, web sign-in, web editing.
- [`event-history`](../../../openspec/changes/pluggable-backend-live-sharing/specs/event-history/spec.md): revisions and restore.
- [`event-backdrops`](../../../openspec/changes/pluggable-backend-live-sharing/specs/event-backdrops/spec.md): photo and animated backdrops.
- [`event-audio`](../../../openspec/changes/pluggable-backend-live-sharing/specs/event-audio/spec.md): built-in tracks and Spotify links.

Backend API and data model: [`docs/architecture/BACKEND.md`](../../architecture/BACKEND.md).

---

## 2. Links

### 2.1 Link Types
| Type | Per event | Who can open | Can edit | Sign-in |
| :--- | :--- | :--- | :--- | :--- |
| Public link | up to 10 active, each with an optional label and expiry (1 to 365 days) | anyone with the URL | no | not needed |
| People link | at most 1 | people the owner invited | editors only | needed |

- Both use `https://daysthatmatter.app/e/{token}`. The token is 22 base64url characters (128 bits). There is no way to list or search links.
- Sharing needs an account: the owner must be signed in to create links or invites, and the receiver must be signed in to accept an invite. Public links open without an account.
- People join through invites: `https://daysthatmatter.app/i/{token}`, a one-time URL with the role viewer or editor. Opening it consumes nothing; it is consumed when it is linked to an account. Unused invites can be cancelled and expire after 30 days. The owner sees who accepted and can change roles or remove people. People can leave.
- Roles: **viewer** sees the event live. **editor** also edits the shared fields and backdrop and sees history. **owner** also manages links and people, edits notes, pin and category, and deletes the event. At most 50 people per event.
- Custom scheme fallback: `daysthatmatter://e/{token}` and `daysthatmatter://i/{token}`.

### 2.2 Share Flow in the App
1. **Public link:** Share sheet → "Public link" → optional label and expiry → link created and copied. A guest first sees the sign-in prompt; after sign-in their events upload and the flow continues.
2. **People:** Share sheet → "People" → "Invite" with a role → the invite URL is handed to the system share sheet.
3. **Receiving an invite:** the URL opens the app when installed, otherwise the web page. If the receiver is not signed in, they sign in or create an account (Apple or Google) in the app or on the web. They then see the event name, the owner's name and the role, and tap "Accept". Accepting links their account and consumes the invite. If they already have access, or are the owner, the event opens and the invite stays unused.
4. **Manage:** the share screen lists links (copy, rename, change expiry, revoke), people (role, remove) and pending invites (cancel). It loads from the backend, so it is the same on every signed-in device.
5. **Offline:** link, invite and people actions need a connection and are disabled offline. Event edits work offline and sync later (see [`PERSISTENCE_AND_SYNC.md`](../../architecture/PERSISTENCE_AND_SYNC.md)).

### 2.3 What Is Shared
Shared fields: title, emoji, date, time, time zone, unit mode, recurrence, theme, backdrop, audio. Never shared: notes, pin state, category, memos. Viewers see Premium content (animated backdrops, Premium tracks) whatever their own plan. Public links carry no names or account data. People links show the display names of the owner and the people with access.

### 2.4 Time Zone Semantics
`timeZone` is an IANA name or null. A fixed zone means everyone sees the same instant. Null means "floating": each viewer's local zone is used (New Year, birthdays). An event with no time counts to 00:00 in that zone. See [`docs/features/events/SPEC.md`](../events/SPEC.md).

---

## 3. Deep Link Resolution
1. **App installed:** App Links (Android) and Universal Links (iOS) open `/e/` and `/i/` URLs in the app. The app calls `GET /api/v1/links/{token}` and shows the event, live. For a people link it uses the signed-in session; without one it offers sign-in. A signed-in user can add a public-link event to their own events as a copy ("Save a copy").
2. **App not installed:** the URL opens the web page (section 4).
3. **Errors:** `404` "Link not found"; `410` "This link is no longer available"; `401` sign in; `403` "Ask the owner for an invite"; network error "Needs a connection", with the last seen version if cached.

### 3.1 Association Files
- `https://daysthatmatter.app/.well-known/assetlinks.json` (Android) and `https://daysthatmatter.app/.well-known/apple-app-site-association` (iOS, no file extension).
- Served as static files with `Content-Type: application/json`, no redirects, no authentication.
- iOS matches the paths `/e/*` and `/i/*`. Android verifies the same host with the Play App Signing and upload key fingerprints.
- Team ID, bundle id, package name and fingerprints are placeholders until the apps are published.
- Deep links are testable only on the production domain.

---

## 4. Web Page
- Server-rendered countdown card with live ticking seconds, same rules as the app's engine (shared test vectors).
- Live changes: WebSocket notices or polling every 20 seconds, depending on the backend provider. Revoking a link or removing a person switches open pages to the right state.
- People link and invite pages offer Sign in with Google and Sign in with Apple through redirects. No third-party scripts.
- Editors get an Edit button (shared fields, backdrop) and a History panel with restore.
- Backdrop: still photo, or an animated photo that plays once and rests on its key photo; key photo only under reduced motion.
- Audio: a play button for built-in tracks (never autoplay), a "Listen on Spotify" link for Spotify links.
- The web editor changes text, date, time, zone, recurrence, theme, still backdrop and dim. Animated photos and audio are changed in the app.
- Smart banners on iOS and Android, none on desktop. Desktop shows the card without a QR code.
- Not indexed by search engines. Public link previews show title, countdown text and the backdrop still; people links show a generic preview.

| State | HTTP | Page |
| :--- | :--- | :--- |
| Visible | 200 | Countdown card, banners, Edit and History for editors |
| People link, not signed in | 401 | Sign-in options, no event details |
| Signed in without access | 403 | "Ask the owner for an invite", no event details |
| Revoked, expired or event deleted | 410 | "This link is no longer available" |
| Unknown or malformed token | 404 | "Link not found" |
| Service error or provider limit | 503 | Short message; app link buttons still work |

---

## 5. Image & Social Export

### 5.1 High-Resolution Card Export
- Offscreen rendering of the event card at 1080x1920 (9:16 Instagram Story aspect ratio) or 1200x630 (horizontal social banner).
- Includes the event title, countdown counter, custom typography, the backdrop (key photo for animated photos) and an optional subtle watermark ("Tracked with Days That Matter").
- Native system share sheet invokes with image attachment for direct sharing to Instagram, WhatsApp, X/Twitter, or saving to Camera Roll.

### 5.2 QR Code Sharing
- In-app QR code generator encoding a link URL. Generated on the device, so it works offline once a link exists. The backend does not generate QR codes.

---

## 6. Security & Privacy Summary
- Read access to a public link: possession of its token. Read access through the people link: a signed-in account with a grant. Write access: owner or editor session.
- Link tokens are stored in clear so owners can copy them on any device; invite and session tokens are stored hashed (see `BACKEND.md` sections 8 and 14).
- Unknown, malformed and purged tokens give identical `404` responses.
- Shared content is an allow-list (section 2.3). Backdrop files have location and camera metadata removed.
- Every page has a report link. Takedown revokes the link and deletes the media.

## 7. Out of Scope (this change)
- Comments, including anonymous comments visible only to the owner (planned; see the change's design D12).
- Memos in shares and collaborative memos.
- Push notifications for changes.
- Email invites (invites are URLs the owner sends).
