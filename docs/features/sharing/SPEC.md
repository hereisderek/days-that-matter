# Feature Specification: Sharing, Deep Linking & Social Export

## 1. Overview & Goals
Allows users to share their milestone events with friends, family, or social media followers through multiple rich formats: deep links, interactive web pages, exportable high-resolution images, and QR codes.

---

## 2. Deep Linking Architecture

### 2.1 URL Structure
- **Primary Universal / App Link:** `https://daysthatmatter.app/e/{shareToken}`
- **Fallback Custom Scheme:** `daysthatmatter://event?token={shareToken}`

### 2.2 Deep Link Interception & Resolution
1. **App Installed:**
   - Android App Links & iOS Universal Links intercept the URL directly without browser bounce.
   - App queries `/shared_events/{shareToken}` on Firestore.
   - Presents a bottom sheet preview of the shared event.
   - User can tap **"Import to My Events"** to clone a local copy, or simply view the live countdown.
2. **App Not Installed (Web Fallback):**
   - The link navigates to a lightweight web page (hosted on Firebase Hosting).
   - Renders the interactive countdown card in the browser with live ticking seconds.
   - Displays smart banners: "Open in App" or "Download for iOS / Android".

---

## 3. Image & Social Export

### 3.1 High-Resolution Card Export
- Offscreen rendering of the event card at 1080x1920 (9:16 Instagram Story aspect ratio) or 1200x630 (horizontal social banner).
- Includes the event title, countdown counter, custom typography, and optional subtle watermark ("Tracked with Days That Matter").
- Native system share sheet invokes with image attachment for direct sharing to Instagram, WhatsApp, X/Twitter, or saving to Camera Roll.

### 3.2 QR Code Sharing
- In-app QR code generator encoding `https://daysthatmatter.app/e/{shareToken}`.
- Allows instant in-person sharing from device to device using camera scanner.

---

## 4. Security & Permissions

```javascript
// Firestore Security Rules for Shared Events
match /shared_events/{shareToken} {
  // Anyone with the secret token can read
  allow read: if true;
  // Authenticated users can create shared links
  allow create: if request.auth != null;
  // Only the creator can revoke or update the share link
  allow update, delete: if request.auth != null && request.auth.uid == resource.data.ownerId;
}
```

- Passwords / Private notes in memos are **excluded** by default from shared payloads unless the user explicitly enables "Include Memos in Share".
