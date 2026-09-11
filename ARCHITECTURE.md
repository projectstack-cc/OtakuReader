# OtakuReader — Architecture Document
**Version:** 0.2.0  
**Date:** 2026-09-11  
**Author:** CTO Agent  
**Status:** Pending CEO review

---

## 1. Confirmed Tech Stack

| Layer | Technology | Version Pin | Rationale |
|---|---|---|---|
| **Framework** | SolidStart | `^0.10.0` | File-based routing, SolidJS 5 runes, Vite-native, SSR + streaming |
| **Runtime / Deployment** | Vercel Node.js Runtime | Node.js 20+ | SolidStart deploy adapter for Vercel; server functions run in Node.js (not Edge) |
| **Language** | TypeScript | `5.6.x` | Strict mode, full type safety across server/client boundary |
| **UI Library** | SolidJS 5 (Runes) | `^1.9.x` | Signals, createMemo, createEffect; no virtual DOM overhead |
| **Styling** | Tailwind CSS v4 + CSS custom properties | `^4.0.0` | Utility-first with `@tailwindcss/vite` plugin; dark theme via CSS vars on `:root` |
| **Theme** | Dark neumorphism | — | CSS custom properties for `--bg-primary`, `--bg-elevated`, `--text-primary`, etc.; soft inset/outset shadows |
| **State (client)** | SolidJS built-in signals/stores | Built-in | No external state library; `createSignal`, `createStore`, `createSelector` cover all needs |
| **State (server)** | SolidStart Server Functions | Built-in | `+server.ts` route handlers; data fetching and mutation at the route level |
| **PWA** | `vite-plugin-pwa` + Workbox `generateSW` | `^0.21.0` | Auto-generated service worker; runtime caching configured in `vite.config.ts` |
| **Offline Storage** | `idb` (IndexedDB) | `^8.0.0` | Typed wrapper; chapter page blobs, reading state, library persistence |
| **Caching (server)** | Vercel KV + in-memory fallback | `@vercel/kv ^3.0.0` | Shared rate-limit state across horizontally-scaled functions; API response TTL cache |
| **Validation** | Runtime checks | Inline | Lightweight guards in `+server.ts` handlers; no heavy validation library in MVP |
| **Lint / Format** | ESLint + Prettier | ESLint `9.x` | `eslint-plugin-solid` for SolidJS-specific rules |

### Stack Rationale vs Alternatives

- **SolidStart over Next.js:** SolidJS has a smaller runtime footprint and true reactivity via signals; SolidStart provides first-class Vite integration and server functions without a separate API layer.
- **Node.js Runtime over Edge:** Required for Vercel KV client (`@vercel/kv`), dynamic `import()` of the KV module, and stable `fetch` with Node.js globals. Edge runtime lacks the KV bindings needed for shared rate limiting.
- **vite-plugin-pwa over next-pwa:** SolidStart uses Vite natively; `vite-plugin-pwa` is the de-facto Vite PWA plugin with Workbox under the hood.
- **No external state library:** SolidJS signals and stores cover client state requirements with less bundle weight than Zustand or Redux.

---

## 2. System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT (PWA)                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ App Shell   │  │  Pages       │  │  Reader Component      │  │
│  │ (SSR shell) │  │  /           │  │  ┌──────────────────┐  │  │
│  └─────────────┘  │  /library    │  │  │ Image Renderer   │  │  │
│                   │  /manga/[id] │  │  │ (img + scroll)   │  │  │
│                   │  /read/[id]  │  │  └──────────────────┘  │  │
│                   │  /search     │  │  Zoom / Fit Toggle    │  │
│                   └──────────────┘  │  RTL/LTR Toggle       │  │
│                                       └────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Service Worker (vite-plugin-pwa / Workbox generateSW)      │ │
│  │  - Static asset precaching                                  │ │
│  │  - Runtime caching: API responses (NetworkFirst, 5min)      │ │
│  │  - Chapter images (CacheFirst, 1h TTL)                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  IndexedDB (idb)                                            │ │
│  │  - chapters: { mangaId, chapterId, pages[], progress }      │ │
│  │  - library: { mangaId, title, cover, lastReadAt }           │ │
│  │  - settings: { readerMode, zoomFit, theme, language }       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│           SOLIDSTART APP (Vercel Node.js Runtime)                │
│                                                                  │
│  src/routes/                                                     │
│  ├── index.tsx              # Home / discovery                    │
│  ├── library.tsx            # Favorites, history                  │
│  ├── search.tsx             # Unified AniList + Jikan search      │
│  ├── manga/[id].tsx         # Manga detail page                   │
│  ├── read/[id].tsx          # Chapter reader                      │
│  └── api/                   # Server function proxies             │
│      ├── manga/[...path]    # MangaDex v5 API proxy               │
│      ├── anilist/query      # AniList GraphQL proxy               │
│      └── jikan/[...path]    # Jikan v4 REST proxy                 │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  src/lib/api/                                             │   │
│  │  ├── rate-limit.ts   # Vercel KV-backed token bucket      │   │
│  │  ├── cache.ts        # KV + memory cache for API responses │   │
│  │  ├── errors.ts       # ProxyError + error response helpers │   │
│  │  ├── constants.ts    # URLs, TTLs, rate-limit config       │   │
│  │  └── types.ts        # MangaDex / AniList / Jikan types   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Vercel KV (Redis)                                       │   │
│  │  - ratelimit:{endpoint}:{ip} — sliding window counters   │   │
│  │  - md:*, al:*, jk:* — API response cache with TTL       │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
          │                          │                      │
          │ HTTPS (proxied)          │ HTTPS (direct)        │ HTTPS (proxied)
          ▼                          ▼                      ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   MangaDex v5    │    │   AniList v2     │    │   Jikan v4       │
│   (API + images) │    │   (GraphQL)      │    │   (REST)         │
│   5 req/s limit  │    │   30 req/min     │    │   3 req/sec      │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## 3. Backend Proxy Design

### 3.1 Why SolidStart Server Functions

**Decision: Use SolidStart file-based server routes (`+server.ts`).**

**Reasoning:**
1. **Single deploy unit:** Server functions, client routes, and Vite config all live in one repo with one build command (`solid-start build`).
2. **Shared utilities:** `src/lib/api/` contains rate limiters, cache helpers, and typed clients shared between all server routes.
3. **KV compatibility:** Node.js runtime is required for `@vercel/kv`; SolidStart server functions run in Node.js by default on Vercel.
4. **No separate Express layer:** The proxy layer is lightweight (header injection + fetch); Express would add operational overhead without benefit in MVP.
5. **Type-safe route params:** SolidStart's `params` typing flows directly from the file-system route (`[...path]`) into the handler.

**When to split later:** If CPU-heavy transcoding or batch processing is added, extract to a separate server on Fly.io/Render. Keep the proxy routes in SolidStart.

### 3.2 Route Specification

| Route | Methods | Purpose |
|---|---|---|
| `src/routes/api/manga/[...path]/+server.ts` | GET/POST/PUT/DELETE | MangaDex v5 API proxy; handles `/manga`, `/feed`, `/at-home/:id`, `/cover/:id`, etc. |
| `src/routes/api/anilist/query/+server.ts` | GET/POST | AniList GraphQL proxy; validates query, applies rate limit, caches responses |
| `src/routes/api/jikan/[...path]/+server.ts` | GET/POST/PUT/DELETE | Jikan v4 REST proxy; rate-limited, cached |

### 3.3 Rate Limit Handling

**Strategy: Vercel KV-backed sliding-window counter + in-memory fallback.**

| Endpoint | Limit | Window | Implementation |
|---|---|---|---|
| MangaDex global | 5 req/s | 1 second sliding window | KV `INCR` with 1s TTL |
| MangaDex at-home | 40 req/min | 1 minute sliding window | KV `INCR` with 60s TTL |
| AniList | 30 req/min | 1 minute sliding window | KV `INCR` with 60s TTL |
| Jikan | 3 req/s | 1 second sliding window | KV `INCR` with 1s TTL |

**Implementation details:**
- `src/lib/api/rate-limit.ts` exports `createRateLimiter(options, kvClient?)`.
- When `kvClient` is provided, state is stored in Vercel KV under keys like `ratelimit:{prefix}:{endpoint}:{ip}` with TTL matching the window.
- When `kvClient` is `null` (local dev, no Vercel KV env), falls back to in-memory `Map` per process.
- Rate limit key is derived from the request URL (endpoint path) so different endpoints share separate buckets.
- On `429` from upstream, propagates `Retry-After` header to the client.

**KV key format:**
```
ratelimit:md-global:/manga?limit=25:192.168.1.1
ratelimit:md-athome:/at-home/server/abc123:192.168.1.1
ratelimit:al:/query/trending:192.168.1.1
ratelimit:jk:/top/manga:192.168.1.1
```

### 3.4 Caching Strategy

| Resource | Cache Location | TTL | Notes |
|---|---|---|---|
| MangaDex search/list | Vercel KV + memory | 60–120s | Keyed by path + query params |
| MangaDex at-home | Vercel KV | 3600s (1h) | Immutable until chapter scanlation changes |
| AniList GraphQL | Vercel KV + memory | 300s (5min) | Cached per normalized query + variables |
| Jikan responses | Vercel KV + memory | 60–86400s | Varies by endpoint; see `JIKAN_CACHE_TTL` in `constants.ts` |
| Chapter images | Service Worker CacheFirst | 1h | Managed by Workbox in `vite.config.ts` |
| Cover images | Service Worker CacheFirst | 7d | Managed by Workbox |

**Cache invalidation:**
- TTL-based expiry; no explicit invalidation in MVP.
- On upstream `5xx`, serve stale cache if available (graceful degradation).
- KV errors fall back to in-memory cache without throwing.

---

## 4. Frontend Architecture

### 4.1 Routing: File-Based (SolidStart)

```
src/
├── routes/
│   ├── index.tsx              # Home / discovery (trending, recent)
│   ├── library.tsx            # Favorites, history, reading lists
│   ├── search.tsx             # Unified search (AniList + Jikan)
│   ├── manga/
│   │   └── [id].tsx           # Manga details (AniList enrichment + MD feed)
│   ├── read/
│   │   └── [id].tsx           # Chapter reader
│   └── api/
│       ├── manga/[...path]/+server.ts   # MangaDex proxy
│       ├── anilist/query/+server.ts      # AniList GraphQL proxy
│       └── jikan/[...path]/+server.ts    # Jikan REST proxy
├── app.tsx                    # Root layout (shell, nav, PWA provider)
├── app.css                    # Tailwind v4 + CSS custom properties + neumorphism
├── entry-client.tsx           # Client hydration entry
├── entry-server.tsx           # SSR entry
├── types.ts                   # Shared global types
└── lib/
    ├── api/                   # Server-side: rate-limit, cache, constants, errors, types
    ├── components/            # Reusable SolidJS components
    ├── stores/                # SolidJS createStore definitions
    └── styles/                # CSS custom properties definitions
```

### 4.2 State Management

| State | Scope | Solution |
|---|---|---|
| Reader settings (mode, zoom, RTL) | Client | `createSignal` + `localStorage` sync |
| Reading library (favorites, history) | Client + offline | `createStore` + `idb` (IndexedDB) |
| Server-side data (manga, search) | Server | Server function fetches; passed as props to client |
| UI theme | Client | CSS custom properties on `:root`; toggled via `data-theme` attribute |

**Why no external state library:** SolidJS signals/stores have minimal overhead, work seamlessly with SSR hydration, and serialize naturally to IndexedDB.

### 4.3 Component Hierarchy

```tsx
<App>
  <Suspense fallback={<LoadingSpinner />}>
    <Outlet />
  </Suspense>
  <Navigation />
  <PWAProvider />

  <!-- / -->
  <HomePage>
    <TrendingSection />     // AniList trending via /api/anilist/query
    <RecentUpdatesSection /> // MangaDex feed via /api/manga/feed
  </HomePage>

  <!-- /manga/[id] -->
  <MangaDetailPage>
    <MangaCover />          // neumorphic card with cover art
    <MangaMetadata />       // synopsis, genres, score (AniList enrichment)
    <ChapterList />         // MangaDex feed, grouped by language
    <AddToLibraryButton />  // local library action
  </MangaDetailPage>

  <!-- /read/[id] -->
  <ReaderPage>
    <ReaderToolbar />       // chapter nav, settings gear
    <ReaderContainer>
      <VerticalReader />    |  <HorizontalReader />
      <PageImage />         // lazy-loaded, with blur-up placeholder
    </ReaderContainer>
    <ZoomControls />        // fit-width / fit-height / 100%
  </ReaderPage>
</App>
```

### 4.4 Reader Component Architecture

**Design goals:** Smooth neumorphic UI, performant on low-end mobile, minimal repaints.

| Mode | Implementation | Notes |
|---|---|---|
| **Vertical scroll (webtoon)** | Single scrollable container, `overflow-y: auto`, images stacked | Default; auto-detect via MangaDex `contentRating` + tag heuristics |
| **RTL horizontal** | `display: flex`, `flex-direction: row-reverse`, `overflow-x: auto`, `scroll-snap-type: x mandatory` | Traditional manga; keyboard + swipe gesture support |
| **LTR horizontal** | Same as RTL but `flex-direction: row` | Western manga readers |

**Zoom / Fit:**
- CSS `object-fit: contain | cover | fill` on `<img>` + container resize observer
- CSS `transform: scale()` with `touch-action: pan-x pan-y` on the container
- Double-tap to toggle 100% / fit-width

**Performance guardrails:**
- Lazy load images with `loading="lazy"` + intersection observer for prefetch on approach
- Virtualize only if chapter > 100 pages; otherwise DOM-only is faster for scroll
- `will-change: transform` only on the active page image
- Neumorphism: use semi-transparent layers + subtle shadows; avoid heavy blur on image containers

---

## 5. PWA Implementation

### 5.1 Tool: `vite-plugin-pwa` + Workbox `generateSW`

**Rationale:**
- SolidStart uses Vite natively; `vite-plugin-pwa` integrates directly into the Vite build.
- `generateSW` strategy auto-generates a service worker with a precache manifest at build time.
- Runtime caching strategies are configured declaratively in `vite.config.ts`.

### 5.2 Service Worker Strategy

| Asset | Strategy | Details |
|---|---|---|
| Static assets (JS/CSS) | Precache | Injected at build time by Workbox |
| MangaDex API responses | NetworkFirst | 5min network timeout, 60s cache |
| AniList GraphQL | NetworkFirst | 5min network timeout, 5min cache |
| Jikan responses | NetworkFirst | 5min network timeout, variable TTL |
| Chapter images (`/at-home/`) | CacheFirst | 1h TTL, max 500 entries |
| Cover images | CacheFirst | 7d TTL |

### 5.3 Offline Chapter Caching (IndexedDB)

**Use `idb` (typed IndexedDB wrapper) for schema + queries.**

```ts
// Schema (conceptual, src/lib/stores/db.ts)
const DB_NAME = 'otakureader';
const STORES = {
  chapters: 'mangaId, chapterId, cachedAt, [mangaId+chapterId]',
  pages: 'chapterId, url, [chapterId+url]',
  library: 'mangaId, addedAt',
  settings: 'key',
};
```

**Caching flow:**
1. User opens chapter → images stream through `/api/manga/at-home/:id` proxy.
2. Service Worker intercepts `fetch` for chapter images → `CacheFirst`, 1h TTL.
3. Background sync (or explicit "Save for offline" button) → blobs migrated to IndexedDB via `idb`.
4. Offline → reader reads from IndexedDB first, falling back to Cache Storage.

**Cache limits:**
- Max 50MB total chapter image cache (enforced in service worker or on write).
- LRU eviction when threshold exceeded.
- Per-chapter "download" action for explicit offline save (user gesture required).

### 5.4 PWA Manifest

- Manifest via `vite-plugin-pwa` `manifest` option (inline or `public/manifest.webmanifest`).
- `display: standalone`, theme color `#1a1a2e` (dark neumorphism background).
- Icons: 192x192 + 512x512 in `public/icons/`.
- Install prompt via `beforeinstallprompt` event in `PWAProvider`.

---

## 6. MVP Feature Scope

### 6.1 In Scope (v1)

| Feature | Description |
|---|---|
| **Home / Discovery** | Trending (AniList), Recent updates (MangaDex feed) |
| **Unified Search** | Search bar → parallel AniList GraphQL + Jikan REST → deduplicated results |
| **Manga Detail** | Metadata (AniList enrichment), chapter list (MangaDex), cover art |
| **Chapter Reader** | Vertical scroll default; RTL/LTR horizontal toggle; page fit; zoom |
| **Reading Progress** | Local progress tracking per chapter (IndexedDB) |
| **Library (local)** | Add/remove favorites, reading history (local + IndexedDB, no accounts) |
| **PWA Install** | Manifest + service worker for add-to-homescreen |
| **Offline Caching** | Static assets + recently read chapters (Cache Storage + IndexedDB) |
| **Dark Theme** | CSS custom properties; system preference detection + manual toggle |
| **Neumorphism UI** | Cards, buttons, reader controls with dark neumorphic styling |

### 6.2 Deferred (Post-MVP)

| Feature | Why deferred |
|---|---|
| User accounts / cloud sync | Personal-use MVP; no auth required |
| AniList list sync | Complexity vs value for solo user |
| Recommendation engine | Medium effort; requires graph traversal |
| Download / export chapters | Legal gray area if redistributed; keep local-only first |
| Multi-language UI | English first; i18n adds significant overhead |
| MangaDex OAuth integration | Only needed for follows, lists, read markers |
| Advanced reader (double-page spread, webtoon auto-detect) | Nice-to-have; MVP covers core modes |
| Image format optimization (WebP/AVIF conversion) | MangaDex@Home already serves optimized images |

---

## 7. Risks and Mitigations

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| **MangaDex CORS / hotlink enforcement changes** | High | Low | Proxy everything through server functions; if ToS changes, switch primary source |
| **Rate limit hit during browsing storms** | High | Medium | Aggressive KV caching (60s–5min TTL); Vercel KV shared state across instances; client-side debounce on search |
| **AniList degraded rate limit (30/min)** | Medium | High (currently) | Cache aggressively; batch queries; fallback to Jikan |
| **Jikan downtime / MAL layout change** | Medium | Medium | Treat as fallback only; graceful degradation with stale cache |
| **PWA offline caching bloat** | Medium | Medium | 50MB cap in service worker; LRU eviction; explicit download button for offline saves |
| **Neumorphism performance on low-end Android** | Low | Medium | CSS-only shadows (no heavy box-shadow blur on image containers); test on 2GB RAM devices |
| **Vercel KV cold start / latency** | Low | Medium | In-memory fallback for dev; KV errors degrade gracefully to memory cache |
| **Image hotlink token expiration** | Medium | Medium | Proxy all images; cache with TTL; re-fetch on 403/404 |
| **SolidStart 0.10 breaking changes** | Low | Low | Pin versions; test on patch updates only |

### Neumorphism Performance Specifics

- Use `bg-[#1a1a2e]` + `shadow-[inset_...]` sparingly; prefer `border` + subtle `shadow-sm` for interactive elements
- Avoid `filter: blur()` on large containers; use semi-transparent overlay divs instead
- Reader image container: flat dark background, no neumorphic inset — prioritize readability

---

## 8. Gaps Between Research Report and MVP

| Gap | Research Report Says | MVP Needs |
|---|---|---|
| **Backend proxy framework** | "Express/FastAPI/Next.js API routes" | Decision: SolidStart server functions (`+server.ts`) |
| **Rate limit implementation** | "Token bucket: 5/s global, 40/min at-home" | Vercel KV-backed sliding window counters; in-memory fallback for local dev |
| **AniList + Jikan deduplication** | Mentioned as opportunity | MVP: simple title match + AniList ID priority; no cross-ID mapping yet |
| **Reading position sync** | "localStorage + optional cloud" | MVP: IndexedDB only; no sync |
| **Content rating filter** | "Filter at API layer" | MVP: default `safe` + `suggestive`; expose toggle in settings |
| **CSP for PWA + images** | Not covered | Need CSP that allows `blob:` for reader images, `connect-src` for proxy origins |
| **MangaDex User-Agent** | "Required, no Via headers" | Injected in proxy; test User-Agent string |

---

## 9. Blockers Before Build Starts

| Blocker | Status | Action Required |
|---|---|---|
| **CEO sign-off on architecture** | Pending | Review this document; approve or flag concerns |
| **Vercel KV provisioning** | Unconfirmed | Provision KV via Vercel Dashboard; add `KV_REST_API_URL` and `KV_REST_API_TOKEN` to env |
| **MangaDex API terms review** | Incomplete | Confirm personal-use project is ToS-compliant; monitor Discord `#api-changelog` |
| **Content rating policy** | Open question | Does CEO want `safe` only, or allow `suggestive`? |
| **AniList GraphQL rate limit** | Currently degraded (30/min) | Plan around 30/min until restored to 90/min; confirm acceptable |
| **PWA distribution method** | Open question | Self-hosted only? Or intend to publish to app stores? |

---

## 10. Open Questions for the CEO

1. **Content policy:** Should OtakuReader default to `safe` only, or include `suggestive` content (ecchi)? MangaDex's default is both.
2. **PWA distribution:** Is this purely self-hosted (Vercel URL), or do you intend to publish to app stores? Store publish would require privacy policy, content rating disclosure, and larger icon sets.
3. **Cloud sync:** No accounts in MVP. Is cloud sync (reading progress across devices) a hard requirement for v2, or is local-only acceptable long-term?
4. **Vercel KV bandwidth:** Vercel KV has usage limits on the free tier. Is aggressive caching acceptable to stay within free tier limits?
5. **Legal review:** Do you want a formal DMCA/takedown policy page, even for a personal project? MangaDex requires honoring takedown requests.

---

## Appendix: Repo Structure (Actual)

```
OtakuReader/
├── .kilo/
├── .vercel/
├── .env.example
├── app.html
├── ARCHITECTURE.md
├── DECISIONS.md
├── package.json
├── postcss.config.js
├── PRODUCT_BRIEF.md
├── public/
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── app.tsx                    # Root layout (shell, nav, PWA provider, Suspense)
│   ├── app.css                    # Tailwind v4 + CSS custom properties + neumorphism
│   ├── entry-client.tsx           # Client hydration
│   ├── entry-server.tsx           # SSR entry
│   ├── types.ts                   # Shared global types
│   ├── routes/
│   │   ├── index.tsx              # Home / discovery
│   │   ├── library.tsx            # Favorites, history
│   │   ├── search.tsx             # Unified search
│   │   ├── manga/[id].tsx         # Manga detail
│   │   ├── read/[id].tsx          # Chapter reader
│   │   └── api/
│   │       ├── manga/[...path]/+server.ts   # MangaDex proxy
│   │       ├── anilist/query/+server.ts      # AniList GraphQL proxy
│   │       └── jikan/[...path]/+server.ts    # Jikan REST proxy
│   └── lib/
│       ├── api/
│       │   ├── rate-limit.ts      # Vercel KV-backed rate limiter
│       │   ├── cache.ts           # KV + memory cache
│       │   ├── constants.ts       # URLs, TTLs, rate-limit config
│       │   ├── errors.ts          # ProxyError + error response helpers
│       │   └── types.ts           # MangaDex / AniList / Jikan response types
│       ├── components/
│       ├── stores/
│       └── styles/
├── tsconfig.json
├── vercel.json
└── vite.config.ts                 # Vite + SolidStart + vite-plugin-pwa config
```

---

*Document ends. Awaiting CEO review before implementation begins.*
