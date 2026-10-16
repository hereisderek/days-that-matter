# Days That Matter: Shared Web View (Design v2)

An interactive, responsive design demo of the **Days That Matter** shared web experience (`/e/:token`, `/i/:token`, and `/s/:id`), built to reflect the v2 design language of the mobile application.

---

## 1. Design Direction & Core Experience

The shared web view is designed as a direct, immersive extension of the mobile app:

* **Card-Centric Floating Experience**: The event is framed as a floating card with 28–36px rounded corners, delicate frosted glass borders (`rgba(255, 255, 255, 0.18)`), and deep multi-layer elevation box-shadows (`0 24px 60px -12px rgba(0,0,0,0.5)`).
* **Atmospheric Ambient Aura**: The page background provides a smooth ambient aura reflecting the card's backdrop and dominant palette colors with deep blur and subtle vignette.
* **Fluid Viewport Responsiveness**:
  * **Mobile (< 480px)**: Fills the viewport with edge-to-edge card feeling, safe-area padding (`env(safe-area-inset-top)` / `bottom`), and dynamic viewport height (`100dvh`).
  * **Tablet & Desktop (> 480px)**: Elegantly centered card with comfortable padding and maximum width of ~480px–520px, keeping the tactile proportions of a physical milestone keepsake.
* **Soft Motion & Animations**:
  * Smooth card entrance animation on load (`@keyframes cardEntrance`: subtle scale up from 0.98 + opacity fade-in).
  * Smooth transitions for interactive elements, hover states, and button presses.
  * Live ticking seconds with subtle transitions.
  * Audio visualizer animated wave bars during playback.
* **Branding & App Entry**:
  * Subtle and tasteful "Created with Days That Matter" / "by Days That Matter" badge.
  * Clear deep-link CTA: "Open in Days That Matter" / "Get the App" (`daysthatmatter://e/{token}`) with smart store redirects.

---

## 2. Event Styles & Customization Showcased

| Sample Event | Card Style | Typeface | Backdrop | Audio / Link |
| :--- | :--- | :--- | :--- | :--- |
| **Our Wedding Day** | Glassmorphic | Modern Sans | Still Photo (scaled dim & blur) | Built-in Track (with Wave Visualizer) |
| **Northern Lights Expedition** | Full-Bleed Poster | Modern Sans | Animated Motion Photo Video Loop | Live Seconds Ticker |
| **Years Together** | Glassmorphic | Classic Serif | Still Photo (Amber glow) | Milestone Anniversary Count-Up |
| **Days That Matter v1.0 Launch** | Minimalist Clean | Monospace Tech | Flat Surface | Workdays Unit Mode |
| **Live in Concert** | Glassmorphic | Playful Rounded | Blurred Scrim | Spotify Music Link ("Listen on Spotify") |
| **Kyoto in Autumn** | Glassmorphic | Editorial Condensed | Multi-Stop Linear Gradient | Plum Palette |
| **Sunday Long Run** | Card Outlined | Modern Sans | High Contrast Outline | Weeks & Days Mode |
| **Flight Departs** | Glassmorphic | Modern Sans | Nature Wallpaper | Total Hours Countdown Mode |

---

## 3. How to Run the Demo

### Standalone (Zero Dependencies)
You can open `index.html` directly in any web browser, or serve it with Python:
```bash
python3 -m http.server 8768 --directory design/v2/share
```
Then visit: `http://localhost:8768`

### Live Core Backend Preview Server
The backend core includes a live preview server serving these pages directly with strict security headers:
```bash
node backend/core/scripts/preview-server.ts
```
Then visit: `http://localhost:8080` (or `http://172.16.2.26:8080`)
