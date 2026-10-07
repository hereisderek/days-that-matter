# Days That Matter — Design System & Figma Specification

## 1. System Philosophy
This design system is engineered for long-term maintainability, multiplatform consistency, and instant global theming.

**Single Source of Truth Principle:**
- **Zero hardcoded values:** All colors, radii, spacing, and typography are bound to centralized **Figma Variables** and **Text Styles**.
- **Component Instantiation:** All screens are constructed strictly from **Component Instances**, never detached frames.
- When any token (e.g. brand primary color, card corner radius, or typography family) is updated in Figma, the entire set of screens and components updates automatically across the file.

---

## 2. Token Architecture (Figma Variables)

### 2.1 Collection: `Days That Matter / Tokens`

#### Colors (`resolvedType: COLOR`)
| Variable Name | Hex Code | Semantic Role |
| :--- | :--- | :--- |
| `color/brand/primary` | `#2563EB` | Primary brand accent & call-to-actions |
| `color/brand/primary-light` | `#DBEAFE` | Subtle primary container / chip tint |
| `color/brand/on-primary` | `#FFFFFF` | Text and icons over primary brand surfaces |
| `color/surface/background` | `#0F172A` | Deep sleek dark background surface |
| `color/surface/card` | `#1E293B` | Elevated card surfaces |
| `color/surface/card-subtle` | `#334155` | Secondary card fills & search inputs |
| `color/surface/card-glass` | `#1E293BCC` | Frosted glassmorphism overlay |
| `color/text/primary` | `#F8FAFC` | High-contrast body and title typography |
| `color/text/secondary` | `#94A3B8` | Muted secondary metadata & dates |
| `color/text/tertiary` | `#64748B` | Subtle watermark & hints |
| `color/border/subtle` | `#334155` | Card dividers & component borders |
| `color/border/strong` | `#475569` | Interactive input borders |
| `color/status/rose` | `#F43F5E` | Anniversaries & romantic milestones |
| `color/status/emerald` | `#10B981` | Completed goals & positive streaks |
| `color/status/amber` | `#F59E0B` | Birthdays & celebratory alerts |
| `color/status/violet` | `#8B5CF6` | Life events & trips |

#### Corner Radii (`resolvedType: FLOAT`, Scoped to `CORNER_RADIUS`)
| Variable Name | Value | Usage |
| :--- | :--- | :--- |
| `radius/sm` | `8px` | Badges, tags, and small controls |
| `radius/md` | `16px` | Standard event list cards & countdown boxes |
| `radius/lg` | `24px` | Hero featured cards & bottom sheets |
| `radius/pill` | `9999px` | Buttons, action chips, and status pills |

#### Spacing (`resolvedType: FLOAT`, Scoped to `GAP`)
- `space/4`: 4px
- `space/8`: 8px
- `space/12`: 12px
- `space/16`: 16px
- `space/24`: 24px
- `space/32`: 32px

---

## 3. Typography Styles

| Style Name | Font Family | Weight | Size / Line-Height | Role |
| :--- | :--- | :--- | :--- | :--- |
| `Display/Hero` | Inter | Bold | 48px / 56px | Hero countdown counters |
| `Display/Medium` | Inter | Bold | 32px / 40px | Card countdown numbers |
| `Headline/Screen`| Inter | Bold | 22px / 28px | Screen headers & app bar |
| `Title/Card` | Inter | SemiBold | 17px / 24px | Event title in cards |
| `Body/Medium` | Inter | Medium | 14px / 20px | Navigation items, chip labels |
| `Body/Regular` | Inter | Regular | 14px / 20px | Notes, memos, descriptions |
| `Label/Button` | Inter | SemiBold | 14px / 20px | Button labels |
| `Label/Small` | Inter | Medium | 11px / 16px | Unit labels (DAYS), timestamps |

---

## 4. Shared Component Library

All components live in the **🎨 Component Library** frame:

1. **`Component / Button-Primary`:**
   - Auto-layout pill button, fill bound to `color/brand/primary`, text bound to `Label/Button` and `color/brand/on-primary`.
2. **`Component / Button-Secondary`:**
   - Auto-layout pill button, fill bound to `color/surface/card-subtle`, stroke bound to `color/border/subtle`.
3. **`Component / Category-Chip`:**
   - Compact pill filter chip with icon and label.
4. **`Component / Countdown-Unit-Box`:**
   - Stacked digit and unit card (e.g. `42` in `Display/Medium` + `DAYS` in `Label/Small`).
5. **`Component / Event-List-Item`:**
   - Complete horizontal event card with title, date, and days-remaining badge.
6. **`Component / Top-App-Bar`:**
   - Header with app title, search action, and settings toggle.
7. **`Component / Bottom-Nav-Bar`:**
   - 4-tab bar (Events, Milestones, Add, Memos) with active indicator.

---

## 5. Screen Layouts in Figma File

Located on **Page 1** of `days that matter`:

1. **`📱 Screen 1: Home Dashboard` (393 × 852):**
   - Top App Bar instance
   - Category Pills row (instances of `Category-Chip`)
   - Hero Featured Card (Tokyo & Kyoto trip with live countdown ticker)
   - Upcoming Events list (instances of `Event-List-Item`)
   - Bottom Navigation Bar instance
2. **`📱 Screen 2: Event Detail` (393 × 852):**
   - Navigation header with back button and share action
   - Large hero card with 48px countdown digits
   - Lo-Fi audio playback controller bar
   - Milestone memory card with author avatar and note
   - Primary action button
3. **`📱 Screen 3: Event Editor & Themer` (393 × 852):**
   - Save / Cancel navigation bar
   - Live real-time card preview (instance of `Event-List-Item`)
   - Event title text field
   - Accent color palette selector (5 color circles)
   - Primary and secondary buttons
4. **`📱 Screen 4: Share & Export` (393 × 852):**
   - 9:16 Social Story export frame with rich gradient and typography
   - Share to Instagram / Copy Link action buttons
