# Feature Specification: Sharing, Deep Linking & Social Export

## 1. Overview & Goals
Users share milestone events with friends, family or followers through live links, a web page, exported images and QR codes. A shared event is the event itself, not a copy: when the owner or an editor changes it, every open link page and app shows the change.

Normative requirements (OpenSpec change [`pluggable-backend-live-sharing`](../../../openspec/changes/pluggable-backend-live-sharing/)):
- [`event-sharing`](../../../openspec/changes/pluggable-backend-live-sharing/specs/event-sharing/spec.md): public links, invite links, members, roles, allow-list, deep links.
- [`share-web`](../../../openspec/changes/pluggable-backend-live-sharing/specs/share-web/spec.md): web page states, live changes, web sign-in and joining, web editing.
- [`event-history`](../../../openspec/changes/pluggable-backend-live-sharing/specs/event-history/spec.md): revisions and restore.
- [`event-backdrops`](../../../openspec/changes/pluggable-backend-live-sharing/specs/event-backdrops/spec.md): photo and animated backdrops.
- [`event-audio`](../../../openspec/changes/pluggable-backend-live-sharing/specs/event-audio/spec.md): built-in tracks, custom audio and Spotify links.

Backend API and data model: [`docs/architecture/BACKEND.md`](../../architecture/BACKEND.md).

---

## 2. Links

### 2.1 Two Kinds of Links
| | Public link | Invite link |
| :--- | :--- | :--- |
| URL | `https://daysthatmatter.app/e/{token}` | `https://daysthatmatter.app/i/{token}` |
| Per event | up to 10 active, optional label | up to 20 active |
| Who can open | anyone with the URL, no account | signed-in people; opening asks guests to sign in or create an account |
| Result | view the event in a browser or the app | the event is added to the receiver's account as a **member** |
| Role | view only | viewer or editor, set per invite |
| Use count | - | 1, 5, 10, unlimited, or custom (1 to 100); each new member takes one use, opening takes none |
| Expiry | 5 days, 30 days, never (default), or custom up to 5 years | 5 days, 30 days (default), never, or custom up to 5 years |

- Tokens are 22 base64url characters (128 bits). There is no way to list or search links.
- Creating links and invites needs the owner to be signed in. Joining needs the receiver to be signed in.
- **Members** see the event on their home screen, marked as shared, editable or not by role, and on the web at `https://daysthatmatter.app/s/{eventId}` (sign-in and membership needed). At most 100 members per event.
- Roles: **viewer** sees the event live. **editor** also edits the shared fields, backdrop and audio, and sees history. **owner** also manages links, invites and members, edits notes, pin, category and memos, and deletes the event.
- The owner can change a member's role, remove them, or change an invite's expiry or use count. A removed member cannot rejoin through any invite until the owner taps "Allow again". Members can leave.
- Custom scheme fallback: `daysthatmatter://e/{token}`, `daysthatmatter://i/{token}`, `daysthatmatter://s/{eventId}`.

### 2.2 Share Flow in the App
1. **Public link:** Share sheet → "Public link" → optional label, expiry → link created and copied. A guest first sees the sign-in prompt; after sign-in their events upload and the flow continues.
2. **Invite:** Share sheet → "Invite people" → role (viewer or editor), use count (1, 5, 10, unlimited, custom) and expiry → the invite URL goes to the system share sheet.
3. **Receiving an invite:** the URL opens the app when installed, otherwise the web page. If the receiver is not signed in, they sign in or create an account (Apple, Google or email code) in the app or on the web. They then see the event name, the owner's name and the role, and tap "Join". The event appears on their home screen. Owners and existing members who open an invite just see the event; no use is taken.
4. **Manage:** the share screen lists public links (copy, rename, change expiry, revoke), invites (copy, uses left, change expiry or count, revoke), members (role, remove) and removed people (allow again). It loads from the backend, so it is the same on every signed-in device.
5. **Offline:** link, invite and member actions, and joining, need a connection and are disabled offline. Event edits work offline and sync later (see [`PERSISTENCE_AND_SYNC.md`](../../architecture/PERSISTENCE_AND_SYNC.md)).

### 2.3 What Is Shared
Shared fields: title, emoji, date, time, time zone, unit mode, recurrence, theme, backdrop, audio. Never shared: notes, pin state, category, memos. Custom audio files play for members only, never on public links. Viewers see paid content (animated photos, Premium tracks) whatever their own plan. Public links carry no names or account data. Members see the display names of the owner and other members.

### 2.4 Time Zone Semantics
`timeZone` is an IANA name or null. A fixed zone means everyone sees the same instant. Null means "floating": each viewer's local zone is used (New Year, birthdays). An event with no time counts to 00:00 in that zone. See [`docs/features/events/SPEC.md`](../events/SPEC.md).

---

## 3. Deep Link Resolution
1. **App installed:** App Links (Android) and Universal Links (iOS) open `/e/`, `/i/` and `/s/` URLs in the app. Public links call `GET /api/v1/links/{token}` and show the event live; a signed-in user can "Save a copy" to their own events. Invites show the join screen. Member pages open the event if the user is a member.
2. **App not installed:** the URL opens the web page (section 4).
3. **Errors:** `404` "Link not found"; `410` "This link is no longer available" (or "This invite is full / expired"); `401` sign in; `403` "Ask the owner for an invite"; network error "Needs a connection", with the last seen version if cached.

### 3.1 Association Files
- `https://daysthatmatter.app/.well-known/assetlinks.json` (Android) and `https://daysthatmatter.app/.well-known/apple-app-site-association` (iOS, no file extension).
- Served as static files with `Content-Type: application/json`, no redirects, no authentication.
- iOS matches the paths `/e/*`, `/i/*` and `/s/*`. Android verifies the same host with the Play App Signing and upload key fingerprints.
- Team ID, bundle id, package name and fingerprints are placeholders until the apps are published.
- Deep links are testable only on the production domain.

---

## 4. Web Page
- Server-rendered countdown card with live ticking seconds, same rules as the app's engine (shared test vectors).
- Live changes: WebSocket notices or polling every 20 seconds, depending on the backend provider. Revoking a link or removing a member switches open pages to the right state.
- Invite and member pages offer the region's sign-in methods (Google and Apple through redirects, email code form). No third-party scripts.
- Member pages: editors get an Edit button and a History panel with restore. The web editor changes text, date, time, zone, recurrence, theme, still backdrop and dim; animated photos and audio are changed in the app.
- Backdrop: still photo, or an animated photo that plays once and rests on its key photo; key photo only under reduced motion.
- Audio: a play button for built-in tracks (never autoplay), custom audio on member pages only, a "Listen on Spotify" link for Spotify links.
- Smart banners on iOS and Android, none on desktop. Desktop shows the card without a QR code.
- Not indexed by search engines. Public link previews show title, countdown text and the backdrop still; invite and member pages show a generic preview.

| State | HTTP | Page |
| :--- | :--- | :--- |
| Visible | 200 | Countdown card, banners; Edit and History for editors on member pages |
| Invite or member page, not signed in | 401 | Sign-in options, no event details |
| Signed in, not a member (member page) or removed | 403 | "Ask the owner for an invite", no event details |
| Link revoked or expired, event deleted, invite full, expired or revoked | 410 | "This link is no longer available" or the invite's state |
| Unknown or malformed token | 404 | "Link not found" |
| Service error or provider limit | 503 | Short message; app link buttons still work |

---

## 5. Image & Social Export

### 5.1 High-Resolution Card Export
- Offscreen rendering of the event card at 1080x1920 (9:16 Instagram Story aspect ratio) or 1200x630 (horizontal social banner).
- Includes the event title, countdown counter, custom typography, the backdrop (key photo for animated photos) and an optional subtle watermark ("Tracked with Days That Matter").
- Native system share sheet invokes with image attachment for direct sharing to Instagram, WhatsApp, X/Twitter, or saving to Camera Roll.

### 5.2 QR Code Sharing
- In-app QR code generator encoding a public link or invite URL. Generated on the device, so it works offline once a link exists. The backend does not generate QR codes.

---

## 6. Security & Privacy Summary
- Read access to a public link: possession of its token. Member access: a signed-in account that joined through an invite and was not removed. Write access: owner or editor session.
- Public link tokens are stored in clear so owners can copy them on any device. Invite tokens are stored hashed plus encrypted with a server key, so owners can copy them but a database copy alone cannot be used to join. Session tokens are stored hashed (see `BACKEND.md` section 14).
- Unknown, malformed and purged tokens give identical `404` responses.
- Shared content is an allow-list (section 2.3). Backdrop files have location and camera metadata removed.
- Every page has a report link. Takedown revokes the link and deletes the media.

## 7. Comments (later change)
Rules decided so far (design D12): comments have the same visibility as the event; the owner can hide or remove any comment; an owner setting allows anonymous comments, which only the owner sees. Comments sync like memos.

## 8. Out of Scope (this change)
- Comments (section 7).
- Memos in shares and collaborative memos.
- Push notifications for changes.
- Email invites (invites are URLs the owner sends).
