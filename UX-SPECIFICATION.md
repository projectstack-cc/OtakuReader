# OtakuReader — UX Specification
**Version:** 1.0.0  
**Date:** 2026-09-11  
**Owner:** UX Agent  
**Status:** Draft

> **Framework note:** The existing `ARCHITECTURE.md` specifies Next.js. This spec is framework-agnostic in its UI/UX decisions. If the stack moves to SolidStart (SolidJS), the component models and hooks should be mapped to Solid's reactive primitives; the CSS custom properties and interaction patterns remain identical.

---

## Table of Contents

1. [Reader Interaction Model](#1-reader-interaction-model)
2. [Browsing Experience](#2-browsing-experience)
3. [Neumorphism Design System — Dark Theme](#3-neumorphism-design-system--dark-theme)
4. [PWA Install Flow](#4-pwa-install-flow)
5. [Responsive Breakpoints](#5-responsive-breakpoints)
6. [Edge Cases](#6-edge-cases)
7. [Appendix: CSS Custom Properties Reference](#appendix-css-custom-properties-reference)

---

## 1. Reader Interaction Model

### 1.1 Vertical Scroll Mode (Default)

| Aspect | Decision |
|---|---|
| **Scroll model** | Continuous vertical scroll within a chapter (infinite scroll). No per-page snapping by default; images flow naturally like a webtoon. |
| **Rationale** | Natural reading rhythm, no forced pauses between pages. Works well for both Japanese manga (single-page) and webtoon (long-strip) formats. |
| **Pre-fetch** | Images within ±2 viewport heights are pre-loaded with `loading="lazy"` + IntersectionObserver. Never more than 10 images in DOM beyond visible range to protect memory. |
| **Progress tracking** | Reading position saved as a percentage (0–100) of the chapter, debounced every 1 second. On return, scroll to saved position. |
| **Chapter navigation** | Swipe up past last image → "End of Chapter" interstitial with **Previous Chapter** / **Next Chapter** buttons. No automatic advance. |
| **Tap zones** | Tap top-third: toggle toolbar. Tap middle: no-op (prevents accidental toolbar dismiss). Tap bottom-third: toggle toolbar. |

### 1.2 RTL Horizontal Mode (Optional)

| Aspect | Decision |
|---|---|
| **Layout** | `flex-direction: row-reverse`, `overflow-x: auto`, `scroll-snap-type: x mandatory`. Each page fills the viewport width (`object-fit: contain`). |
| **Swipe behavior** | Single-page swipe with magnetic snap. Flick velocity > 0.4 triggers page-turn; slow drag always snaps to nearest page. |
| **Double-page spread** | Optional. When enabled and screen width ≥ 800px, two pages are shown side-by-side (mirrored for RTL). Single-page mode on smaller screens or when zoomed. |
| **Keyboard** | Left/Right arrow keys navigate pages (RTL: left = forward, right = back). |
| **Page indicator** | Bottom bar shows `X / Y` with a thin progress bar. |

### 1.3 Page Fit Modes

Three modes, persisted per-manga in `settings`:

| Mode | CSS | Behavior |
|---|---|---|
| **Fit Width (default)** | `object-fit: contain; width: 100%; height: auto;` | Image width = viewport width; height scales proportionally. Pages may not fill screen vertically. |
| **Fit Height** | `object-fit: contain; height: 100%; width: auto;` | Image height = viewport height; width scales proportionally. In horizontal mode, crops sides if aspect ratio differs. |
| **Original Size** | `object-fit: none;` | Image renders at intrinsic pixel dimensions. Horizontal scroll enables panning if image > viewport. Pinch-to-zoom also active. |

### 1.4 Zoom

| Gesture | Action |
|---|---|
| **Pinch-to-zoom** | `transform: scale()` with `touch-action: pan-x pan-y` on container. Min scale: 0.5×; max: 4×. Smooth 60fps via `will-change: transform` on the active image only. |
| **Double-tap** | Toggle between **Fit Width** and **100%** (original size at viewport center). If already at 100%, returns to Fit Width. |
| **Pinch release** | If scale < 1.0: spring back to Fit Width. If 1.0–4.0: stay at current scale. If > 4.0: clamp to 4.0 with resistance curve. |

### 1.5 Navigation

| Input | Action |
|---|---|
| **Swipe (vertical)** | Scroll reader in vertical mode. |
| **Swipe (horizontal)** | Page turn in horizontal mode. |
| **Volume keys** | Hardcoded listener: volume-up = previous page, volume-down = next page. Disabled during media playback (audio books, if applicable). |
| **Bottom bar** | Persistent neumorphic strip: chapter progress bar, page counter, fit-mode toggle, RTL/LTR toggle, settings gear. Auto-hides after 3s of inactivity; reappears on tap. |
| **Edge swipe (iOS/Android)** | From left edge (LTR) or right edge (RTL): navigate back/forward. Does not interfere with horizontal reader swipes (only active on home/detail pages). |

### 1.6 Chapter Transitions

```
End of Chapter Interstitial
┌─────────────────────────────────┐
│  ✓ Chapter 5 complete            │
│                                  │
│  ◀ Previous Chapter              │
│  Next Chapter ▶                   │
│                                  │
│  [Continue Reading]               │
└─────────────────────────────────┘
```

- **Trigger:** User scrolls to the final image in vertical mode, or swipes past the last page in horizontal mode.
- **Behavior:** A neumorphic card slides up from the bottom (or fades in for horizontal). It does not auto-dismiss; user must choose an action.
- **Auto-advance:** Never automatic. Prevents accidental spoiler reveals and respects reading pacing.
- **Progress bridge:** If "Next Chapter" is tapped, the reader loads chapter 6 and scrolls to 0%. "Previous Chapter" similarly resets to 0%.

---

## 2. Browsing Experience

### 2.1 Home Screen

**Wireframe (Mobile — 375px wide):**

```
┌─────────────────────────────┐
│ ≡  OtakuReader        🔍    │  ← Sticky header, neumorphic flat
├─────────────────────────────┤
│ Continue Reading             │  ← Section label, muted
│ ┌─────────────────────────┐ │
│ │  [Cover]   One Piece     │ │  ← Large neumorphic card
│ │           Ch. 1053 72%   │ │  ← Progress bar, pressed channel
│ └─────────────────────────┘ │
│                             │
│ Featured                     │  ← Horizontal scroll carousel
│ ┌───────┐ ┌───────┐ ┌────┐ │
│ │ Cov1  │ │ Cov2  │ │Cov3│ │  ← Cards with raised elevation
│ └───────┘ └───────┘ └────┘ │
│                             │
│ Recent Updates               │
│ ┌─────┐ ┌─────┐ ┌─────┐   │
│ │  1  │ │  2  │ │  3  │   │  ← 2-column grid, square covers
│ └─────┘ └─────┘ └─────┘   │
│ ┌─────┐ ┌─────┐ ┌─────┐   │
│ │  4  │ │  5  │ │  6  │   │
│ └─────┘ └─────┘ └─────┘   │
└─────────────────────────────┘
```

**Behavior:**
- **Continue Reading:** Top priority. If user has reading history, show one card with the most recently read manga. Tapping opens the reader at the saved position. Pull down to refresh.
- **Featured:** Auto-play carousel (3s intervals) of trending manga from AniList. Manual swipe override. Dots indicator.
- **Recent Updates:** 2-column grid of recently updated chapters. Infinite scroll. Tap opens manga detail.

### 2.2 Search UX

**Wireframe (Mobile):**

```
┌─────────────────────────────┐
│ ◀  Search          ✕       │  ← Back button, search input
├─────────────────────────────┤
│ 🔍 Search manga...          │  ← Active state: raised input
├─────────────────────────────┤
│ Filters                      │
│ [Safe ✓] [Suggestive ✗]     │  ← Toggle chips
│ [Japanese] [English] [All]   │
│                             │
│ Results (12)                 │
│ ┌─────────────────────────┐ │
│ │ [Cover]  Title           │ │
│ │          Author • Score  │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ [Cover]  Title           │ │
│ │          Author • Score  │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**Behavior:**
- Search is **debounced 300ms** on input. Results replace the home content; no dedicated results page navigation.
- **Unified search:** Parallel calls to AniList GraphQL (primary) + Jikan (fallback). Results are deduplicated by title similarity.
- **Filters:** Applied as URL query params so they survive refresh. Default: `Safe` + `Suggestive` both enabled; language `All`.
- **Empty state:** If no results, show a neumorphic empty state card: "No manga found. Try a different search term."

### 2.3 Detail Page Layout

**Wireframe (Mobile):**

```
┌─────────────────────────────┐
│ ◀  One Piece                │
├─────────────────────────────┤
│  ┌────────┐                  │
│  │ Cover  │  One Piece       │
│  │        │  by Eiichiro Oda │
│  │        │  ★ 9.2           │
│  └────────┘  Action, Adventure│
│             Drama, Fantasy    │
│                             │
│ [Add to Library] [Share]     │  ← Neumorphic buttons
├─────────────────────────────┤
│ Synopsis                     │
│ Gold Roger was known as the  │
│ "Pirate King,"...            │  ← 3-line clamp, expandable
├─────────────────────────────┤
│ Chapters (1053)              │
│ ┌─────────────────────────┐ │
│ │ English                 │ │  ← Collapsible group header
│ │  Ch. 1053 — "Luffy vs..."│ │
│ │  Ch. 1052 — "The Island" │ │  ← Tappable rows
│ │  Ch. 1051 — "Kouzuki"    │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Japanese                 │ │  ← Collapsed by default
│ │  Ch. 1053 ...            │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**Behavior:**
- Cover image: 40% of screen width on mobile, constrained to maintain aspect ratio.
- **Add to Library:** Toggles local favorite. Stored in IndexedDB. Button state: raised (add) / pressed (remove).
- Chapter groups are collapsible (language-based from MangaDex). Expanded by default if fewer than 20 chapters; collapsed otherwise.
- Tap on a chapter opens the reader immediately at page 1.
- Share button uses Web Share API (`navigator.share`) to share the manga detail URL.

### 2.4 Library / Favorites

**Wireframe (Mobile):**

```
┌─────────────────────────────┐
│ Library    [♡ Fav] [↺ History]│  ← Segmented control, neumorphic
├─────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐   │
│ │  1  │ │  2  │ │  3  │   │  ← Grid of manga cards
│ └─────┘ └─────┘ └─────┘   │
│ ┌─────┐ ┌─────┐ ┌─────┐   │
│ │  4  │ │  5  │ │  6  │   │
│ └─────┘ └─────┘ └─────┘   │
│                             │
│ Long-press for actions       │
└─────────────────────────────┘
```

**Behavior:**
- **Favorites tab:** 2-column grid of favorited manga. Tap opens detail. Long-press (or swipe on iOS) shows context menu: "Remove from library", "Mark as read", "Share".
- **History tab:** Reverse-chronological list of recently read chapters. Shows manga cover + chapter number + reading timestamp. "Clear history" button in header.
- **Local only:** All data in IndexedDB. No account required. Data persists across sessions.
- **Empty state:** "Your library is empty. Browse manga and add them here."

---

## 3. Neumorphism Design System — Dark Theme

### 3.1 Color Palette

```css
--neu-base: #1a1a2e;           /* Background */
--neu-raised: #22223a;         /* Elevated surface */
--neu-pressed: #12121f;        /* Inset / pressed state */
--neu-text-primary: #e0e0e0;   /* Headings, body */
--neu-text-secondary: #9090a8; /* Muted, labels */
--neu-accent: #7c6fff;         /* Primary accent (purple) */
--neu-accent-hover: #9580ff;   /* Hover state */
--neu-danger: #ff5f6d;         /* Remove, errors */
--neu-success: #4ade80;        /* Success states */
--neu-border: #2a2a40;         /* Subtle borders for focus */
```

### 3.2 Shadow Directions

Light source: **top-left** (consistent across all elements).

| Elevation | Outer Shadow (Raised) | Inner Shadow (Pressed) |
|---|---|---|
| **L0 — Flat** | `none` | `none` |
| **L1 — Raised (default)** | `4px 4px 8px #0a0a16, -4px -4px 8px #2e2e48` | `inset 4px 4px 8px #0a0a16, inset -4px -4px 8px #2e2e48` |
| **L2 — Elevated** | `8px 8px 16px #0a0a16, -8px -8px 16px #2e2e48` | `inset 8px 8px 16px #0a0a16, inset -8px -8px 16px #2e2e48` |
| **L3 — Modal / Overlay** | `12px 12px 24px #0a0a16, -12px -12px 24px #2e2e48` | `inset 12px 12px 24px #0a0a16, inset -12px -12px 24px #2e2e48` |

**Formula:** Dark shadow = `base - 20%` lightness; light shadow = `base + 20%` lightness.  
For `--neu-raised: #22223a`: dark = `#0a0a16`, light = `#2e2e48`.

### 3.3 Component Examples

#### 3.3.1 Button (Raised)

```css
.neu-btn {
  background: var(--neu-raised);
  color: var(--neu-text-primary);
  border: none;
  border-radius: 12px;
  padding: 12px 24px;
  box-shadow: 6px 6px 12px #0a0a16, -6px -6px 12px #2e2e48;
  transition: box-shadow 0.15s ease, transform 0.1s ease;
  cursor: pointer;
  font-weight: 600;
}

.neu-btn:hover {
  box-shadow: 8px 8px 16px #0a0a16, -8px -8px 16px #2e2e48;
}

.neu-btn:active {
  box-shadow: inset 4px 4px 8px #0a0a16, inset -4px -4px 8px #2e2e48;
  transform: scale(0.98);
}
```

**Accent variant:** Background uses `var(--neu-accent)`, shadows adapt via opacity mix or precomputed dark/light variants.

#### 3.3.2 Card (Raised)

```css
.neu-card {
  background: var(--neu-raised);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 6px 6px 12px #0a0a16, -6px -6px 12px #2e2e48;
}

.neu-card--flat {
  background: var(--neu-base);
  box-shadow: none;
}
```

#### 3.3.3 Input (Inset)

```css
.neu-input {
  background: var(--neu-base);
  border: none;
  border-radius: 12px;
  padding: 14px 16px;
  color: var(--neu-text-primary);
  box-shadow: inset 3px 3px 6px #0a0a16, inset -3px -3px 6px #2e2e48;
  outline: none;
  transition: box-shadow 0.15s ease;
}

.neu-input:focus {
  box-shadow: inset 3px 3px 6px #0a0a16, inset -3px -3px 6px #2e2e48,
              0 0 0 2px var(--neu-accent);
}
```

#### 3.3.4 Toggle Switch

```css
.neu-toggle {
  width: 52px;
  height: 28px;
  background: var(--neu-base);
  border-radius: 28px;
  box-shadow: inset 3px 3px 6px #0a0a16, inset -3px -3px 6px #2e2e48;
  position: relative;
  cursor: pointer;
  transition: background 0.2s ease;
}

.neu-toggle[aria-checked="true"] {
  background: var(--neu-accent);
}

.neu-toggle::after {
  content: '';
  position: absolute;
  width: 22px;
  height: 22px;
  background: var(--neu-raised);
  border-radius: 50%;
  top: 3px;
  left: 3px;
  box-shadow: 2px 2px 4px #0a0a16, -2px -2px 4px #2e2e48;
  transition: transform 0.2s ease;
}

.neu-toggle[aria-checked="true"]::after {
  transform: translateX(24px);
}
```

#### 3.3.5 Bottom Bar (Reader)

```css
.neu-bottom-bar {
  background: var(--neu-raised);
  border-radius: 20px 20px 0 0;
  padding: 12px 16px;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.4);
  /* No neumorphic inset on the bar itself — flat surface for controls */
}

.neu-bottom-bar__btn {
  background: var(--neu-base);
  border: none;
  border-radius: 10px;
  width: 40px;
  height: 40px;
  box-shadow: 3px 3px 6px #0a0a16, -3px -3px 6px #2e2e48;
  color: var(--neu-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.neu-bottom-bar__btn:active {
  box-shadow: inset 2px 2px 4px #0a0a16, inset -2px -2px 4px #2e2e48;
}
```

### 3.4 Accessibility Considerations

| Requirement | Implementation |
|---|---|
| **Contrast** | Text on raised surfaces: `#e0e0e0` on `#22223a` = 10.2:1 ratio (passes WCAG AAA). Secondary text `#9090a8` on `#22223a` = 5.5:1 (passes AA). |
| **Focus states** | Never rely on shadow alone for focus. All interactive elements show a 2px solid `var(--neu-accent)` ring (`outline-offset: 2px`) when focused via keyboard. |
| **Touch targets** | Minimum 44×44px (HIG standard). Buttons are 40px minimum with padding; total tap area ≥ 44px. |
| **Reduced motion** | `prefers-reduced-motion: reduce` disables spring animations, scale transforms, and auto-play carousels. Transitions are instant. |
| **Screen reader labels** | All icon-only buttons have `aria-label`. Toggle states use `aria-checked`. Progress bars use `aria-valuenow`. |
| **Color independence** | Error states combine `var(--neu-danger)` color with an icon (⚠ or ✕). Success states combine green with ✓. No info conveyed by color alone. |

---

## 4. PWA Install Flow

### 4.1 Install Prompt

**Trigger conditions:**
1. App is served over HTTPS.
2. Service worker is registered and activated.
3. User has interacted with the domain (visited at least 2 pages in the last 30 seconds).
4. `beforeinstallprompt` event fires (Chrome/Edge Android) or user manually accesses the browser menu (iOS Safari).

**Flow (Android — Chrome):**

```
┌─────────────────────────────┐
│  ◀  One Piece               │
│                             │
│  [Cover art]                │
│  One Piece                  │
│  by Eiichiro Oda            │
│                             │
│  ┌─────────────────────────┐│
│  │  Install OtakuReader    ││  ← Neumorphic card
│  │                         ││
│  │  Add to home screen for ││
│  │  quick, offline access. ││
│  │                         ││
│  │  [Install]    [Not now] ││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

- The install banner is **not** an intrusive system modal. It appears as a neumorphic card in the app itself, positioned 20px from the bottom, dismissible by tapping outside or "Not now."
- On iOS, a subtle banner appears below the header: "Install OtakuReader: Tap Share → Add to Home Screen" with an animated arrow icon.
- After successful install, show a confirmation toast: "OtakuReader installed! Find it on your home screen."

### 4.2 PWA Manifest

```json
{
  "name": "OtakuReader",
  "short_name": "OtakuReader",
  "start_url": "/",
  "display": "standalone",
  "orientation": "any",
  "theme_color": "#1a1a2e",
  "background_color": "#1a1a2e",
  "description": "Personal manga reader",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- `orientation: any` allows landscape reading on tablets.
- `theme_color` matches `--neu-base`.

### 4.3 Offline Caching Strategy

| Asset | Strategy | TTL |
|---|---|---|
| Static (JS/CSS) | Precache manifest | Immutable |
| API responses | Stale-while-revalidate | 5 min |
| Chapter images | Cache-first | 7 days |
| Cover images | Cache-first | 30 days |

- Max 50MB total cache. LRU eviction.
- Offline indicator: When network is unavailable, a small neumorphic chip appears in the header: "Offline — showing cached content."

---

## 5. Responsive Breakpoints

### 5.1 Breakpoint Definitions

| Name | Range | Primary Device |
|---|---|---|
| **xs** | < 360px | Small phones (iPhone SE, older Android) |
| **sm** | 360px – 639px | Standard phones |
| **md** | 640px – 1023px | Large phones / small tablets |
| **lg** | 1024px – 1279px | Tablets (iPad, Android tablets) |
| **xl** | ≥ 1280px | Desktop (secondary) |

### 5.2 Layout Adaptations

| Screen | Home | Search | Detail | Reader |
|---|---|---|---|---|
| **xs / sm** | Single column, large CTAs, full-width cards | Full-width search, stacked filters | Stacked cover + info | Full-bleed reader, bottom bar |
| **md** | 2-column grid for recent updates | 2-column results | Side-by-side cover (40%) + info (60%) | Same as mobile, larger touch targets |
| **lg** | 3-column grid, featured carousel wider | Sidebar filters + results grid | Cover left, info center, chapter list right | Optional: double-page spread on wide screens |
| **xl** | 4-column grid, persistent sidebar nav | 3-column results grid | Same as lg | Double-page spread default if RTL mode + screen ≥ 1400px |

### 5.3 Safe Area & Notch Handling

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}

/* Apply to sticky elements */
.neu-header {
  padding-top: var(--safe-top);
}

.neu-bottom-bar {
  padding-bottom: var(--safe-bottom);
  margin-bottom: var(--safe-bottom); /* On iOS, content doesn't go into home indicator area */
}
```

- All fixed-position UI respects `env(safe-area-inset-*)`.
- Reader content extends edge-to-edge behind the notch; controls float within safe areas.
- Landscape: header and bottom bar collapse to minimal height (40px) to maximize reading area.

---

## 6. Edge Cases

### 6.1 Slow Networks

| Scenario | Handling |
|---|---|
| **Initial load** | Show neumorphic skeleton cards (shimmer animation on `--neu-raised` background). No blank screens. |
| **Image load failure** | Show a neumorphic placeholder with a retry button: "Tap to retry". Retry uses exponential backoff (1s, 2s, 4s). |
| **Chapter page timeout** | If a page image takes > 15s to load, show a lightweight spinner below the placeholder. Background loading continues; user can scroll past. |
| **Search timeout** | If unified search takes > 8s, show "Search is taking longer than expected" with a retry button. Partial results (if any) are displayed with a banner. |

### 6.2 Long Chapters (> 100 pages)

| Scenario | Handling |
|---|---|
| **Memory pressure** | Virtualize: only 10 page images in the DOM at a time. Use IntersectionObserver to mount/unmount images as they enter/leave a buffer zone of 5 images above/below the viewport. |
| **Scroll position recovery** | Reading position saved as `{ chapterId, scrollOffset, timestamp }`. On re-entry, scroll to offset within 100ms of load. If cached images haven't loaded yet, wait for the first image to render before applying scroll (to avoid layout shift). |
| **Progress bar accuracy** | Progress bar uses the tallest rendered image as a proxy for total chapter height until all images load. Refines on full load. |

### 6.3 Landscape Orientation

| Scenario | Handling |
|---|---|
| **Reader** | Content fills full width. Double-page spread is preferred on screens ≥ 1024px wide. Bottom bar collapses to icon-only (no labels) to save vertical space. |
| **Home / Detail** | Side-by-side layouts where possible. On phones, header stays at top; bottom nav collapses to tab bar. |
| **Keyboard** | Physical keyboard navigation (arrow keys, space) is active in landscape on tablets/desktops. |
| **Fullscreen** | Reader enters fullscreen automatically on landscape orientation change via Fullscreen API. Dismissed on portrait return. |

### 6.4 Notch & System UI

| Scenario | Handling |
|---|---|
| **Reader in notch area** | Images extend edge-to-edge. Controls use `safe-area-inset-*` to avoid overlap. No letterboxing. |
| **System bars (Android)** | Reader uses `display: fullscreen` intent via PWA manifest. System bars overlay; reader content is behind them. Controls float above. |
| **iOS Safari bottom bar** | Bottom bar is elevated above `safe-area-inset-bottom`. On iPhone X+, this is 34px. Tapping the home indicator area (within safe area) does NOT dismiss the reader bar. |
| **Foldables / Dual screens** | Treat as a single continuous viewport unless `window.screen.orientation` reports a split. If split, show cover on left screen, content on right. |

### 6.5 Other Edge Cases

| Scenario | Handling |
|---|---|
| **Very tall images (webtoon strips)** | If a single image exceeds 2x viewport height, constrain it to 1.5× viewport height with `max-height` and allow pan via touch. Prevent overscroll from propagating to the page. |
| **Tab switching / backgrounding** | Save reading position on `visibilitychange` (document becomes hidden). Debounced to avoid excessive writes. |
| **Screen rotation mid-chapter** | Reader reflows. If Fit Height was active and rotation makes the image taller than the new viewport, automatically downgrade to Fit Width. |
| **Font scaling (accessibility)** | Reader UI text respects `rem` units. Buttons and labels scale with system font size. Reader images do NOT scale with font size (they are images, not text). |

---

## 7. Component Library Map

| Component | Use Case | Elevation |
|---|---|---|
| `NeuButton` | CTAs, navigation | L1 (raised) / L0 (flat, icon-only) |
| `NeuCard` | Manga cards, chapter rows | L1 |
| `NeuInput` | Search bar, settings inputs | L0 (inset) |
| `NeuToggle` | RTL mode, dark mode, content filters | L0 (inset container + raised thumb) |
| `NeuBottomBar` | Reader controls | L0 (flat with shadow-only top edge) |
| `NeuModal` | Settings panel, chapter end interstitial | L3 |
| `NeuSkeleton` | Loading placeholders | L1 (animated shimmer) |
| `NeuToast` | Notifications (install success, errors) | L2 |

---

## 8. Interaction Glossary

| Term | Definition |
|---|---|
| **Page turn** | Transition from one manga page to the next in horizontal mode. |
| **Scroll** | Continuous vertical movement in vertical reader mode. |
| **Chapter end** | State triggered when user reaches the final image of a chapter. |
| **Interstitial** | The "End of Chapter" card presented after chapter end. |
| **Fit mode** | One of: Fit Width, Fit Height, Original Size. |
| **Reader mode** | One of: Vertical Scroll, RTL Horizontal, LTR Horizontal. |
| **Double-page spread** | Two manga pages displayed side-by-side in horizontal mode. |

---

## Appendix: CSS Custom Properties Reference

```css
:root {
  /* === Colors === */
  --neu-base: #1a1a2e;
  --neu-raised: #22223a;
  --neu-pressed: #12121f;
  --neu-text-primary: #e0e0e0;
  --neu-text-secondary: #9090a8;
  --neu-accent: #7c6fff;
  --neu-accent-hover: #9580ff;
  --neu-danger: #ff5f6d;
  --neu-success: #4ade80;
  --neu-border: #2a2a40;
  
  /* === Shadows (precomputed for --neu-base) === */
  --neu-shadow-l1: 4px 4px 8px #0a0a16, -4px -4px 8px #2e2e48;
  --neu-shadow-l1-inset: inset 4px 4px 8px #0a0a16, inset -4px -4px 8px #2e2e48;
  --neu-shadow-l2: 8px 8px 16px #0a0a16, -8px -8px 16px #2e2e48;
  --neu-shadow-l2-inset: inset 8px 8px 16px #0a0a16, inset -8px -8px 16px #2e2e48;
  --neu-shadow-l3: 12px 12px 24px #0a0a16, -12px -12px 24px #2e2e48;
  --neu-shadow-l3-inset: inset 12px 12px 24px #0a0a16, inset -12px -12px 24px #2e2e48;
  
  /* === Spacing === */
  --neu-radius-sm: 8px;
  --neu-radius-md: 12px;
  --neu-radius-lg: 16px;
  --neu-radius-xl: 20px;
  
  /* === Safe Areas === */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}
```

*End of specification. Awaiting implementation.*
