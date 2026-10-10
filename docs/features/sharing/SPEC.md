# Feature Specification: Sharing, Deep Linking & Social Export

## 1. Overview & Goals
Allows users to share their milestone events with friends, family, or social media followers through multiple rich formats: deep links, interactive web pages, exportable high-resolution images, and QR codes.

Links are backed by the share service (Cloudflare Worker + D1 + Static Assets, free tier), not by Firebase. Architecture, data model and the REST API contract are in [`docs/architecture/SHARE_SERVICE.md`](../../architecture/SHARE_SERVICE.md). Implementation plan: [`docs/plans/SHARE_SERVICE_IMPLEMENTATION_PLAN.md`](../../plans/SHARE_SERVICE_IMPLEMENTATION_PLAN.md).

---

## 2. Deep Linking Architecture

### 2.1 URL Structure
- **Primary Universal / App Link:** `https://daysthatmatter.app/e/{shareToken}`
- **Fallback Custom Scheme:** `daysthatmatter://event?token={shareToken}`
- `{shareToken}` is 22 base64url characters (128 bits of randomness). Anyone with the link can view the shared snapshot. There is no way to list or search shares.

### 2.2 Share Lifecycle (in the app)
1. **Create:** the app sends a snapshot of the event (title, emoji, date, time, time zone, recurrence, theme) to `POST /api/v1/shares`. The service returns the link and a one-time `manageToken`.
2. **Store:** the app stores the `manageToken` per shared event in secure storage (Keychain / EncryptedSharedPreferences / Secure Storage) and records the share in a local `shares` table so the owner can see active links.
3. **Update:** after the owner edits the event, the app can republish the snapshot with `PUT` (shares are snapshots, not live sync).
4. **Revoke:** the owner can revoke a link at any time with `DELETE`. The link then shows "no longer available". Revocation is permanent; a new link must be created to share again.
5. **Expiry:** the owner can set an expiry of 1 to 365 days. Default is no expiry.
6. **Lost token:** if the manage token is lost (for example guest data is cleared), the link cannot be updated or revoked. The share UI warns about this. There is no recovery in v1.
7. **Offline:** creating, updating and revoking need the network. They are queued as pending operations in the sync engine and the link is shown only after the service confirms. A queued revoke shows as "Revoking" until confirmed.

### 2.3 Deep Link Interception & Resolution
1. **App Installed:**
   - Android App Links & iOS Universal Links intercept the URL directly without browser bounce.
   - The app validates the token format (22 base64url chars), then calls `GET https://daysthatmatter.app/api/v1/shares/{shareToken}`.
   - Presents a bottom sheet preview of the shared event.
   - User can tap **"Import to My Events"** to clone a local copy (new id, new owner, same time zone), or simply view the live countdown.
   - A 404 shows "Link not found". A 410 shows "This link is no longer available". A network error shows "Needs a connection", with the last seen snapshot if cached.
2. **App Not Installed (Web Fallback):**
   - The link opens the share page served by the service (`GET /e/{shareToken}`).
   - Renders the interactive countdown card in the browser with live ticking seconds, using the same rules as the app's countdown engine.
   - Displays smart banners: iOS Smart App Banner (`apple-itunes-app` meta tag), and on Android an in-page "Open in App" / "Get it on Google Play" banner. Desktop shows the card and a QR code of the same URL.
   - The page is not indexed by search engines (`noindex`).

### 2.4 Association Files
- `https://daysthatmatter.app/.well-known/assetlinks.json` (Android) and `https://daysthatmatter.app/.well-known/apple-app-site-association` (iOS, no file extension).
- Served as static files with `Content-Type: application/json`, no redirects, no authentication.
- iOS matches the path pattern `/e/*`. Android verifies the same host with the Play App Signing and upload key fingerprints.
- Team ID, bundle id, package name and fingerprints are placeholders until the apps are published (see the share service doc, section 11).
- Deep links are only testable on the production domain. `workers.dev` hosts cannot be verified.

### 2.5 Web Page States
| State | HTTP | Page |
| :--- | :--- | :--- |
| Active | 200 | Countdown card, banners |
| Unknown or malformed token | 404 | "Link not found" |
| Revoked or expired | 410 | "This link is no longer available", no event details |
| Service error or free-tier limit reached | 503 or static fallback | Short message; the app link buttons still work |

### 2.6 Time Zone Semantics
The share payload carries `timeZone` (IANA name, or null) and an optional `targetTime`. A fixed zone means everyone sees the same instant. Null means "floating": each viewer's local zone is used (New Year, birthdays). An event with no time counts to 00:00 in that zone. The app chooses the value when sharing; the default is the owner's zone at share time. The `Event` model has no time zone field today, so the events spec needs a matching update when the client work starts.

---

## 3. Image & Social Export

### 3.1 High-Resolution Card Export
- Offscreen rendering of the event card at 1080x1920 (9:16 Instagram Story aspect ratio) or 1200x630 (horizontal social banner).
- Includes the event title, countdown counter, custom typography, and optional subtle watermark ("Tracked with Days That Matter").
- Native system share sheet invokes with image attachment for direct sharing to Instagram, WhatsApp, X/Twitter, or saving to Camera Roll.

### 3.2 QR Code Sharing
- In-app QR code generator encoding `https://daysthatmatter.app/e/{shareToken}`.
- The QR code is generated on the device from the URL, so it works offline once a link exists. The service does not generate QR codes.
- Allows instant in-person sharing from device to device using camera scanner.

---

## 4. Security & Permissions

The service replaces the former Firestore security rules (`shared_events`, `allow read: if true`), which would have allowed listing all shares. Authorization model:

| Action | Requirement |
| :--- | :--- |
| Read (`GET /shares/{token}`, `GET /e/{token}`) | The unguessable share token. No list or search endpoint. |
| Create (`POST /shares`) | None beyond rate limits: per IP, 50 active shares per install id, and a global daily cap (10,000 creates per day). No account needed, so guests can share. |
| Update, revoke | The `manageToken` returned at creation (Bearer). Only its SHA-256 hash is stored. Wrong token and unknown share give the same 404. |

Data rules:
- Shared payload is an allow-list: title, emoji, date, time, time zone, unit mode, recurrence, theme ids and gradient. Maximum 8 KB.
- **Memos are not shared in v1.** The "Include Memos in Share" option and collaborative memos (`AccessMode.CollaborativeMemos`) are deferred, because they need authenticated writes and carry spam and PII risk. Notes, owner id, email, names, wallpapers and audio are never shared.
- Raw tokens are not stored. IP addresses and install ids are not logged.
- Revoking a share clears its data immediately. Expired shares have their data cleared by the nightly job. The row is removed 30 days later. D1 Time Travel can keep deleted data recoverable for 7 days.
- The service runs on Cloudflare's free plan. The request cap (100,000 per day) is a known availability limit, see the share service doc, section 10.

## 5. Out of Scope (v1)
- Live sync of owner edits to existing links beyond manual republish.
- Memos and collaboration on shared events.
- Images or audio in shares.
- Recovering a lost manage token.
