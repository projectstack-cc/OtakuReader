# OtakuReader — Product Brief v1
**Date:** 2026-09-11
**Status:** Ready for Backend + Frontend agent execution

---

## 1. MVP Scope (v1)

### Ships in v1
- MangaDex chapter reading (proxied via backend)
- MangaDex search + advanced filters (tags, status, demographic, content rating)
- AniList v2 metadata enrichment (description, genres, scores, recommendations, related media)
- Reader with vertical scroll (default) and RTL horizontal toggle
- Personal reading history (localStorage)
- Favorites / reading list (localStorage)
- Reading position persistence per chapter (localStorage + IndexedDB)
- Dark theme, neumorphism design system
- PWA: service worker, offline chapter cache (IndexedDB), install prompt
- Scanlation group credits display
- Content rating filter: safe + suggestive only (erotica and pornographic excluded)

### v2 (post-MVP)
- AniList account sync (OAuth, user lists)
- Cross-device sync (cloud-backed reading state)
- Recommendation engine (AniList recommendations × MangaDex availability)
- Bookmarks within chapters (save specific page positions)
- Double-page reader mode with cover spread
- Zoom / page-fit controls (fit-width, fit-height, fit-page, original)
- Jikan v4 enrichment fallback
- Tag management and custom lists
- Chapter download for offline (beyond PWA cache)
- Notifications for new chapters on followed series
- Multi-language chapter selection UI
- Share / export reading history

---

## 2. Reader Feature Set

### Core (v1)
- **Page navigation:** Arrow keys, swipe (touch), on-screen prev/next buttons
- **Reading mode:** Vertical scroll (webtoon-style, default) and RTL horizontal toggle
- **Page fit:** fit-width (default in horizontal), fit-height
- **Zoom:** pinch-to-zoom (horizontal mode), double-tap zoom
- **Reading position persistence:** chapterId → page index saved to localStorage + IndexedDB
- **Resume prompt:** auto-detect returning to a chapter in-progress; show overlay with "Resume" / "Start over"
- **Bookmark chapters:** add/remove from favorites list; view in dedicated "Favorites" page
- **Scanlation credits:** display group name and chapter timestamp under reader toolbar

### v2 additions
- **Double-page mode:** show two pages side-by-side when chapter images support it
- **Cover spread:** first two pages as a single wide image (if chapter metadata indicates)
- **Page fit modes:** fit-page (contain), original (100%)
- **Zoom controls:** dedicated zoom slider with presets (50%, 75%, 100%, 125%, 150%)
- **In-chapter bookmarks:** save named bookmarks at specific page positions
- **Reading direction toggle:** LTR option for Western readers
- **Auto-advance:** auto-scroll in vertical mode, auto-page in horizontal mode
- **Fullscreen:** enter fullscreen from reader

---

## 3. Browsing / Search Features

### Core (v1)
- **Global search bar** (header): queries MangaDex title API directly
- **MangaDex advanced filters:**
  - Content rating: safe, suggestive (default; erotica/pornographic blocked)
  - Status: ongoing, completed, cancelled, hiatus
  - Demographic: shounen, shoujo, josei, seinen, none
  - Tags: genre, theme, format (multi-select)
  - Sort: relevance, latest chapter, newest, oldest, title, rating
  - Language: English (default), configurable
- **Result cards:** cover art, title, rating (AniList score), chapter count, status badge, tags
- **Manga detail page:** synopsis (AniList), genres (AniList), chapters list, cover art, authors, scanlation groups, recommendations
- **Reading history:** chronological list of chapters read, with progress bars; sortable by date
- **Favorites list:** pinned manga with last-read chapter, unread count, quick-read button
- **Continue reading:** hero section on home page showing last 3 series in-progress

### v2 additions
- AniList OAuth sync for user lists (reading, planning, completed, dropped)
- Custom reading lists (named collections beyond favorites)
- Tag preference learning (suggest tags based on reading history)
- "New chapters" notification for favorited series
- Related manga discovery (AniList recommendations + MangaDex relations)

---

## 4. PWA Features

### Core (v1)
- **Web App Manifest:** name, short name, theme color, icons (192px, 512px), display standalone, orientation portrait
- **Service Worker (Vite PWA plugin):**
  - Cache strategy: Stale-while-revalidate for app shell assets (CSS, JS)
  - Cache strategy: Cache-first for static images served through proxy
  - Network-first for API calls (with fallback to cached responses)
  - Offline fallback page
- **Install prompt:** custom in-app banner (not browser-native) when `beforeinstallprompt` fires
- **Offline chapter reading:** chapter pages stored in IndexedDB via service worker background sync
- **Offline indicator:** toolbar badge showing online/offline state

### v2 additions
- Background sync for reading history when connection resumes
- Offline chapter download queue (explicit user-initiated)
- Push notifications for new chapters
- Periodic background sync for metadata refresh

---

## 5. Neumorphism Design System Tokens

### Color Palette (Dark Neumorphism)
```css
/* Base surfaces */
--surface-0: #0d0d16;      /* deepest background */
--surface-1: #13131f;      /* page background */
--surface-2: #1a1a28;      /* card background */
--surface-3: #22223a;      /* raised/elevated surface */
--surface-4: #2c2c48;      /* highest elevation / inputs */

/* Text */
--text-primary: #e8e8f0;   /* headings, body */
--text-secondary: #9090b0; /* meta, captions */
--text-muted: #555577;     /* disabled, placeholders */

/* Accent */
--accent: #7c5cfc;         /* primary accent (violet — manga identity) */
--accent-hover: #947fff;
--accent-muted: rgba(124, 92, 252, 0.15);

/* Semantic */
--success: #4caf50;
--warning: #ff9800;
--error: #e94560;

/* Borders */
--border: #2a2a44;
--border-light: #333355;

/* Shadows — neumorphism (same color as surface, offset) */
--shadow-sm: 2px 2px 4px #08081a, -2px -2px 4px #1e1e2e;
--shadow-md: 4px 4px 8px #08081a, -4px -4px 8px #1e1e2e;
--shadow-lg: 8px 8px 16px #08081a, -8px -8px 16px #1e1e2e;
--shadow-inset: inset 2px 2px 4px #08081a, inset -2px -2px 4px #1e1e2e;

/* Spacing scale */
--sp-1: 4px;
--sp-2: 8px;
--sp-3: 12px;
--sp-4: 16px;
--sp-5: 20px;
--sp-6: 24px;
--sp-8: 32px;
--sp-10: 40px;
--sp-12: 48px;

/* Typography */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'JetBrains Mono', 'Courier New', monospace;

--text-xs: 11px;
--text-sm: 13px;
--text-base: 15px;
--text-lg: 18px;
--text-xl: 22px;
--text-2xl: 28px;
--text-3xl: 36px;

--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;

/* Radius */
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 16px;
--radius-xl: 24px;
--radius-full: 9999px;

/* Transitions */
--transition-fast: 150ms ease;
--transition-base: 250ms ease;
--transition-slow: 400ms ease;
```

### Component Tokens
```css
/* Buttons — neumorphic press */
.btn {
  background: var(--surface-2);
  box-shadow: var(--shadow-sm);
  border: none;
  border-radius: var(--radius-md);
  padding: var(--sp-3) var(--sp-5);
  color: var(--text-primary);
  font-weight: 600;
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.btn:hover { background: var(--surface-3); }
.btn:active {
  box-shadow: var(--shadow-inset);
  background: var(--surface-2);
}
.btn-accent {
  background: var(--accent);
  color: #fff;
}
.btn-accent:hover { background: var(--accent-hover); }

/* Cards */
.card {
  background: var(--surface-2);
  box-shadow: var(--shadow-md);
  border-radius: var(--radius-lg);
  padding: var(--sp-5);
}

/* Inputs */
.input {
  background: var(--surface-2);
  box-shadow: var(--shadow-inset);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--sp-3) var(--sp-4);
  color: var(--text-primary);
  font-size: var(--text-base);
  outline: none;
}
.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-muted);
}

/* Reader page image */
.reader-page {
  background: var(--surface-0);
  box-shadow: var(--shadow-lg);
  border-radius: var(--radius-sm);
  max-width: 100%;
  margin: 0 auto;
}
```

---

## 6. Content Rating Policy

| Rating | MangaDex value | Behavior in v1 |
|--------|---------------|----------------|
| Safe | `safe` | ✅ Shown by default |
| Suggestive | `suggestive` | ✅ Shown by default |
| Erotica | `erotica` | ❌ Filtered — not in v1 |
| Pornographic | `pornographic` | ❌ Blocked entirely |

- Default filter at API layer: `contentRating[]=safe&contentRating[]=suggestive`
- All MangaDex API calls must include content rating filter
- AniList results: filter out `isAdult: true` entries at application level
- User cannot override this filter in v1 (no accounts, no settings persistence)

---

## 7. Legal / ToS Requirements

### MangaDex ToS Compliance
- **Attribution:** Display "Powered by MangaDex" + link to mangadex.org in footer and detail pages
- **Scanlation credits:** Display scanlation group name for every chapter in reader; link to group page when available
- **No ads / no monetization:** Enforced by spec — no ad injection, no premium tiers
- **Donations:** Allowed per MangaDex AUP; optional donate link in footer (not required for v1)
- **DMCA / takedown:** Backend must implement takedown endpoint; remove cached content on valid request
- **Rate limiting:** Respect MangaDex rate limits; never retry on 429 without respecting `Retry-After`
- **User-Agent:** Backend must send `User-Agent` header identifying this app
- **Image proxying:** All MangaDex images served through backend proxy (no direct CDN links from browser)
- **Attribution header:** Include `X-Requested-With` or custom header identifying proxy source (per MangaDex API policy)

### API Terms
- **AniList v2:** Public read-only API; no monetization restrictions; filter adult content at app level
- **Jikan v4:** Unofficial MAL wrapper; use as fallback only; respect 60/min rate limit

### Copyright
- MangaDex content may include non-licensed fan translations
- OtakuReader is a personal-use tool aggregating publicly available content
- No content redistribution beyond what the reader displays in real-time
- If images are cached by PWA service worker, they are temporary and device-local

---

## 8. Project Folder Structure

```
OtakuReader/
├── src/
│   ├── components/
│   │   ├── reader/
│   │   │   ├── Reader.tsx              # main reader shell
│   │   │   ├── ReaderPage.tsx          # individual page image
│   │   │   ├── PageNav.tsx             # prev/next buttons
│   │   │   ├── ReaderToolbar.tsx       # settings, credits, chapter nav
│   │   │   ├── ReadingModeToggle.tsx   # vertical/horizontal switch
│   │   │   └── ResumePrompt.tsx        # resume dialog
│   │   ├── browse/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── MediaGrid.tsx
│   │   │   ├── MediaCard.tsx
│   │   │   ├── FilterPanel.tsx         # tag/status/demographic filters
│   │   │   ├── SortSelect.tsx
│   │   │   └── RatingBadge.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Nav.tsx
│   │   │   └── InstallPrompt.tsx
│   │   └── common/
│   │       ├── Loading.tsx
│   │       ├── Error.tsx
│   │       └── EmptyState.tsx
│   ├── pages/
│   │   ├── index.tsx                   # home / continue reading
│   │   ├── search/
│   │   │   └── [query].tsx
│   │   ├── browse/
│   │   │   └── index.tsx               # advanced browse with filters
│   │   ├── manga/
│   │   │   └── [id].tsx               # manga detail + chapter list
│   │   ├── reader/
│   │   │   └── [mangaId]/[chapterId].tsx
│   │   ├── history/
│   │   │   └── index.tsx
│   │   └── favorites/
│   │       └── index.tsx
│   ├── server/
│   │   ├── api/
│   │   │   ├── proxy.ts                # MangaDex proxy handler
│   │   │   ├── chapter/
│   │   │   │   └── [id].ts             # at-home server + pages
│   │   │   ├── manga/
│   │   │   │   └── [id].ts             # manga detail + feed
│   │   │   ├── search/
│   │   │   │   └── index.ts            # proxy MangaDex search
│   │   │   └── cover.ts                # cover image proxy
│   │   └── middleware/
│   │       ├── rate-limit.ts
│   │       ├── cors.ts
│   │       └── content-rating.ts
│   ├── lib/
│   │   ├── api/
│   │   │   ├── mangadex.ts            # MangaDex client (calls server proxy)
│   │   │   ├── anilist.ts             # AniList GraphQL client (direct fetch)
│   │   │   └── jikan.ts               # Jikan REST client (direct fetch)
│   │   ├── store/
│   │   │   ├── history.ts             # reading history (localStorage + IDB)
│   │   │   ├── favorites.ts           # favorites list
│   │   │   ├── reader-settings.ts     # reading mode, zoom, preferences
│   │   │   └── reading-position.ts     # chapter position persistence
│   │   ├── utils/
│   │   │   ├── idb.ts                 # IndexedDB wrapper
│   │   │   ├── rate-limit.ts
│   │   │   ├── dedupe.ts              # AniList/MangaDex ID matching
│   │   │   └── formatters.ts
│   │   └── types/
│   │       ├── manga.ts
│   │       ├── chapter.ts
│   │       ├── reader.ts
│   │       └── common.ts
│   ├── styles/
│   │   ├── global.css                 # design tokens, resets, utility classes
│   │   ├── reader.css
│   │   └── components.css
│   ├── app.tsx                        # SolidStart app root
│   └── app.css                        # app-level styles
├── public/
│   ├── manifest.json                  # PWA manifest
│   ├── icons/
│   │   ├── icon-192x192.png
│   │   ├── icon-512x512.png
│   │   └── favicon.ico
│   └── offline.html                   # offline fallback
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── vercel.json
├── tsconfig.json
├── vite.config.ts
├── package.json
└── README.md
```

### SolidStart Conventions
- File-based routing in `src/pages/` (SolidStart convention)
- Server endpoints in `src/server/api/` (route handlers)
- Server proxy endpoints mirror MangaDex v5 API structure
- AniList/Jikan calls made from client via `fetch` (CORS-safe)

---

## 9. External Dependencies (npm packages)

### Core Framework
```
solid-js
solid-start
solid-js/store
solid-js/web
solid-js/router
@solidjs/meta
@solidjs/primitives
```

### Data Fetching / State
```
@tanstack/solid-query          # server state, caching, deduplication
solid-zustand                  # lightweight client state (reader settings, history)
```

### Styling
```
vite-plugin-solid-css          # or use plain CSS with CSS modules
# No CSS framework — custom neumorphism tokens in global.css
```

### PWA
```
vite-plugin-pwa                # @vite-pwa/solid plugin (workbox-based)
```

### Utilities
```
dexie                          # IndexedDB wrapper (for offline chapter cache + reading state)
date-fns                       # date formatting (history, chapter timestamps)
```

### Dev Dependencies
```
typescript
@types/node
@types/dexie
vite
@solidjs/testing-library       # testing
vitest                         # test runner
@vitest/coverage-v8            # coverage
```

### Not Included (Deliberate)
- No UI component library — build custom neumorphic components
- No CSS-in-JS — use CSS modules or scoped classes
- No state management library beyond solid-zustand — keep it minimal
- No image optimization library — MangaDex CDN serves WebP/JPEG directly through proxy
- No animation library — CSS transitions for neumorphism effects

---

## 10. Backend Requirements (SolidStart Server Functions)

### Rate Limiting
- Global: 5 req/s per IP
- MangaDex `at-home/server`: 40 req/min
- Middleware: token bucket algorithm, return `429` + `Retry-After` header
- Never retry on 429 without waiting for `Retry-After`

### CORS
- Backend proxy sends `Access-Control-Allow-Origin: *`
- Backend proxy sends `Access-Control-Allow-Headers: Authorization, Content-Type`
- MangaDex API calls include `User-Agent: OtakuReader/1.0`

### Caching
- Chapter metadata: cache 5 min (stale-while-revalidate)
- Cover images: cache 24h (cache-first)
- Chapter page lists: cache 2 min
- AniList metadata: no server cache (direct from client, CORS-safe)

### Content Filtering
- All MangaDex search/feed requests include `contentRating[]=safe&contentRating[]=suggestive`
- Backend rejects any request that attempts to override content rating filter

---

## 11. Vercel Deployment Notes

- SolidStart SSR on Vercel Edge Runtime (or Node.js runtime)
- Backend proxy runs as SolidStart server endpoints (no separate backend service)
- Vercel Edge Functions have 50MB memory limit — keep proxy lightweight
- Image proxy caching via Vercel Edge Cache headers
- PWA service worker works with SolidStart static asset handling
- No database required — all state in browser (localStorage + IndexedDB)
