# Days That Matter — UI/UX Design System V1 (Interactive HTML Prototype)

## 1. Overview
The **V1 Design Prototype** is a high-craft, anti-slop, token-driven interactive HTML/CSS/JavaScript experience located in [`design/v1/`](file:///workspace/myapp/days-that-matter/design/v1/).

It replaces static mockups with a live, tactile, responsive digital prototype that runs directly in any modern web browser.

---

## 2. Viewing the Prototype
Open [`design/v1/index.html`](file:///workspace/myapp/days-that-matter/design/v1/index.html) in your browser:
- Or serve locally using Python:
  ```bash
  python3 -m http.server 8080 --directory /workspace/myapp/days-that-matter/design/v1
  ```
  Then open `http://localhost:8080`.

---

## 3. Key Design Features & Craft

### 3.1 Two Studio Modes
1. **📱 Interactive Device Frame:**
   - Features an iPhone 16 Pro hardware double-bezel shell with Dynamic Island and status bar.
   - Interactive screen tabs at the top allow seamless switching between all 4 core app flows.
   - Live interactive deep links within cards navigate between screens.
2. **🖼️ All Screens Gallery:**
   - Expands the studio canvas to display all 4 screens simultaneously side-by-side with architectural annotations.

### 3.2 The 4 Master Screens
1. **Screen 1: Home Dashboard (`#screen-home`)**
   - **Category Pill Scroller:** Filter by *All Events*, *Milestones*, *Birthdays*, *Anniversaries*, *Goals*.
   - **Featured Hero Card:** Radial gradient card with **live ticking countdown ticker** (updating Days, Hours, Minutes, and Seconds every second).
   - **Upcoming Milestones:** Concentric list items with category icons, title, target date, and days-remaining badges.
   - **Docked Navigation Bar:** Custom bottom navigation bar with elevated gradient FAB.

2. **Screen 2: Event Detail View (`#screen-detail`)**
   - **Massive 56px Hero Number:** High-impact countdown typography with soft text glow.
   - **Interactive Lo-Fi Soundscape Player:** Vinyl turntable animation with live play/pause toggle.
   - **Journey Progress Card:** Visual progress bar toward target milestone.
   - **Reflections & Memos Feed:** Collaborative timestamped notes with author avatars.

3. **Screen 3: Event Editor & Customizer (`#screen-edit`)**
   - **Real-Time Reactive Card Preview:** Typing into the "Event Title" input field updates the preview card instantaneously.
   - **Interactive Color Palette:** Tapping the Royal Blue, Rose, Emerald, Amber, or Violet color swatches transforms the card's gradient aura live.
   - **Aesthetic Style Presets:** Glassmorphic, Minimalist, Full Bleed toggles.

4. **Screen 4: Social Share & Story Export (`#screen-share`)**
   - **9:16 Instagram Story Canvas:** Full-bleed social poster card with bold typography and custom branding.
   - **QR Code Invite Tag:** Direct deep link preview for sharing with friends.
   - **One-Tap Actions:** Export Story image or copy web link to clipboard.

---

## 4. Centralized Token Architecture (`css/styles.css`)

All tokens are declared at the `:root` level. To change the theme, typography, or styling for the entire product, edit the variables in one place:

```css
:root {
  /* Brand Color */
  --brand-primary: #3B82F6;
  --brand-primary-glow: rgba(59, 130, 246, 0.35);

  /* Surfaces */
  --bg-canvas: #030712;
  --bg-surface: #0B1120;
  --bg-surface-elevated: #111827;

  /* Typography */
  --font-sans: 'Plus Jakarta Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Radii */
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-pill: 9999px;
}
```
