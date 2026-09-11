# OtakuReader

Personal manga aggregator with offline reading support. Built with SolidStart (SolidJS 5 + Vite + SSR) and deployed to Vercel.

## Features

- Search and browse manga from MangaDex
- Vertical scroll reader with RTL horizontal swipe mode
- Offline chapter caching via IndexedDB (PWA)
- Favorites and reading history
- AniList and Jikan metadata integration
- Rate-limited proxy with in-memory and Vercel KV caching

## Tech Stack

- **Framework:** SolidStart (SolidJS 5 + Vite + SSR)
- **Styling:** Tailwind CSS v4 + CSS custom properties
- **Theme:** Dark, neumorphism, minimalism
- **Deploy:** Vercel (Node.js 20.x, sfo1 region)
- **Cache:** Vercel KV (Redis) with memory fallback
- **PWA:** Vite PWA plugin with Workbox

## Prerequisites

- Node.js >= 20.x
- pnpm or npm
- Vercel account
- Vercel KV (Redis) provisioned

## Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build for Vercel |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Lint with ESLint |
| `npm run typecheck` | TypeScript type check (no emit) |

## Deploy to Vercel

1. Push the repository to GitHub/GitLab/Bitbucket.

2. Import the project in the [Vercel dashboard](https://vercel.com/new).

3. Vercel auto-detects SolidStart. Ensure:
   - **Framework Preset:** SolidStart
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.vercel/output` (auto-detected)

4. Provision Vercel KV:
   - Dashboard → Storage → Create Database → KV
   - Or via CLI:
     ```bash
     vercel link
     vercel env add KV_URL production
     vercel env add KV_REST_API_URL production
     vercel env add KV_REST_API_TOKEN production
     ```

5. Set environment variables in Vercel:
   ```bash
   vercel env add CORS_ORIGIN production
   vercel env add MANGA_DEX_USER_AGENT production
   ```

6. Deploy:
   ```bash
   vercel --prod
   ```

## Environment Variables

### Required

| Variable | Description |
|---|---|
| `KV_URL` | Vercel KV connection string |
| `KV_REST_API_URL` | Vercel KV REST API URL |
| `KV_REST_API_TOKEN` | Vercel KV REST API token |

### Optional

| Variable | Description | Default |
|---|---|---|
| `MANGA_DEX_USER_AGENT` | User-Agent for MangaDex API | `OtakuReader/1.0.0 (...)` |
| `MANGA_DEX_BASE_URL` | Override MangaDex API base | `https://api.mangadex.org` |
| `CORS_ORIGIN` | Allowed CORS origin(s) | `*` |
| `LOG_LEVEL` | Structured log level | `info` |

### Rate Limit Tunables

| Variable | Default | Description |
|---|---|---|
| `RATE_LIMIT_MANGA_DEX_TOKENS` | `5` | MangaDex global token bucket |
| `RATE_LIMIT_MANGA_DEX_REFILL_MS` | `1000` | MangaDex refill period |
| `RATE_LIMIT_AT_HOME_TOKENS` | `40` | At-home chapter image bucket |
| `RATE_LIMIT_AT_HOME_REFILL_MS` | `60000` | At-home refill period |
| `RATE_LIMIT_ANILIST_TOKENS` | `30` | AniList token bucket |
| `RATE_LIMIT_JIKAN_TOKENS` | `3` | Jikan token bucket |
| `RATE_LIMIT_JIKAN_REFILL_MS` | `1000` | Jikan refill period |

## Vercel Configuration

`vercel.json` configures:
- Region: `sfo1` (US West — closest to MangaDex CDN)
- Serverless functions: 1024 MB memory, 30s max duration for API routes
- KV namespace binding: `otakureader-kv`
- CORS headers on `/api/*`
- Cache headers per endpoint (static assets: immutable, API: stale-while-revalidate)

## Project Structure

```
src/
  routes/
    api/
      manga/[...path]+server.ts   # MangaDex proxy
      anilist/query+server.ts      # AniList GraphQL proxy
      jikan/[...path]+server.ts    # Jikan proxy
    index.tsx                      # Home / trending
    search.tsx                     # Search page
    manga/[id].tsx                 # Manga detail
    read/[mangaId]/[chapterId].tsx # Reader
    favorites.tsx                  # Favorites
    history.tsx                    # Reading history
  lib/
    api/
      cache.ts                     # Vercel KV + memory cache
      rate-limit.ts                # Token bucket rate limiter
      constants.ts                 # API URLs and rate limits
      errors.ts                    # ProxyError class
    components/
      Reader.tsx                   # Vertical/horizontal reader
      PWAProvider.tsx              # Service worker registration
      ...
  services/
    api.ts                         # Frontend API helpers
    db.ts                          # IndexedDB via `idb`
```

## License

Personal use only. No ads, no monetization, no user accounts.
