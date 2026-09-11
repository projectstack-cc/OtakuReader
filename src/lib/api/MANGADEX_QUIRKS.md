# MangaDex v5 API Quirks — Handling Notes

## 1. Rate Limits (Dual-Bucket System)

MangaDex operates **two independent rate limit buckets**:

| Bucket | Limit | Scope |
|---|---|---|
| **Global API** | 5 req/s sustained | All `/api/v2/*` endpoints |
| **At-Home (Chapter Images)** | 40 req/min | `/at-home/server/{chapterId}` only |

**Implementation:** Separate `RateLimiter` instances in `src/lib/api/rate-limit.ts`:
- `mangaDexRateLimiter` — global, 5 tokens/sec, refill rate 1 token/ms
- `mangaDexAtHomeRateLimiter` — 40 tokens/min, refill rate 40/60000 tokens/ms

**Gotcha:** Both limits apply simultaneously. A single request to `at-home` hits both counters. The global bucket will fill first (5 tokens in 5 seconds), then the at-home bucket fills at 40/60s. Code paths to `at-home` go through the same `fetchWithRateLimitAndRetry` as API calls.

## 2. Content Rating Injection

**Problem:** MangaDex's default search includes `erotica` and `pornographic` content. The MVP spec requires only `safe` + `suggestive`.

**Fix in `buildFilteredUrl()` (`src/routes/api/manga/[...path]/+server.ts:58`):**
- Automatically appends `contentRating[]=safe&contentRating[]=suggestive` to any `manga` or `feed` request that does not already specify a `contentRating` or `contentRating[]` param.
- Uses array-notation (`contentRating[]`) — MangaDex v5 requires this, not `contentRating=safe,suggestive`.
- Excluded endpoints: `auth/*` (login, refresh) — content ratings don't apply there.

**Note:** Content rating applies only to `manga` and `feed` endpoints. Tag endpoints and other resources are not affected.

## 3. User-Agent Header (Required, Strict)

**MangaDex TOS:** "Identify your application using a User-Agent header that includes your app name and contact info."

**Implementation:** Every proxied request sets:
```
User-Agent: OtakuReader/1.0.0 (https://github.com/yourusername/otakureader; contact@otakureader.dev)
```

**Forbidden header:** Do NOT send `Via` or `X-Forwarded-For` — MangaDex blocks these. If running behind Vercel/Cloudflare, these may be added automatically by the platform. Mitigate by:
- Overriding in the proxy: `headers: { 'User-Agent': '...' }` (explicit override wins)
- Vercel's outgoing fetch does not add `Via` by default for `fetch()` calls

## 4. Hotlink Protection and At-Home Endpoint

**Problem:** MangaDex image URLs are signed with tokens that expire after a short window (typically 30 min). Direct URLs from MangaDex's CDN don't work past token expiry.

**Fix via `at-home` endpoint:**
```
GET https://api.mangadex.org/at-home/server/{chapterId}?forcePort443=false&useCompression=true
```

Response contains:
```json
{
  "baseUrl": "https://api.mangadex.org",
  "chapter": {
    "hash": "abc123",
    "data": ["page01.jpg", "page02.jpg"],
    "dataSaver": ["page01_s.jpg", ...]
  }
}
```

**Image URL construction (client-side):**
```
{baseUrl}/data/{hash}/{filename}?token={server-assigned-token}
```

**Parameters used:**
- `forcePort443=false` — requests token from non-443 port (avoids TLS issues in some proxied envs)
- `useCompression=true` — enables WebP/AVIF negotiation when available
- `useDataSaver=true` (optional) — returns `dataSaver` array (smaller files)

**Token expiry:** Tokens from at-home endpoint are valid for 30 minutes. Cache at-home response for 1 hour (cache TTL 3600s), but client should re-request if images return 403.

## 5. CORS — No Client-Side Access

MangaDex API **does not set CORS headers** (`Access-Control-Allow-Origin`). Any browser fetch to `api.mangadex.org` will fail with a CORS error.

**Mitigation:** ALL client requests must go through this proxy. The proxy adds `Access-Control-Allow-Origin: *` headers in `vercel.json`. No client-side code should directly call `api.mangadex.org`.

## 6. Error Response Format

MangaDex returns structured errors:
```json
{
  "result": "error",
  "errors": [
    {
      "id": "string",
      "status": 404,
      "title": "Not Found",
      "detail": "Manga not found"
    }
  ]
}
```

**Implementation:** Parse and re-throw as `ProxyError` with `upstreamBody` preserved for debugging. Return `statusCode` from upstream error (not generic 500).

**Gotcha:** `result` field is always `"error"` on error responses, `"ok"` on success. Used in `isSearchResponse()` check.

## 7. Pagination Defaults and Quirks

- Default `limit` is **20** for most endpoints, **100** max for `manga` search.
- Offset-based pagination (not cursor-based).
- `offset=0` returns first page.
- `limit` values > 100 are silently clamped to 100.

**Fix:** Proxy sets `limit=100` for `manga` endpoint if not specified (line 71 of server).

**Cache key:** Pagination params (`page`, `limit`) are included in the cache key, so different pages cache independently.

## 8. `chapter/NULL` Placeholders

MangaDex returns "placeholder" chapters with `id: null` for volumes without released chapters. These appear as:
```json
{ "id": null, "type": "chapter", "attributes": { "chapter": null, ... } }
```

**Handling:** Client-side code should filter `id === null` before storing in chapter list. The proxy passes these through unchanged — it's the client's responsibility to skip null chapters.

## 9. Language/Translation Handling

- `availableTranslatedLanguages` is an array of ISO 639-1 codes (e.g., `["en", "ja", "es"]`) on manga detail.
- Individual chapters have `attributes.language` — **only present if it differs** from the manga's primary language. Absence means it's the primary language.
- When requesting chapters/feed, pass `translatedLanguage[]` param to filter by language.
- Default proxy does not filter by language — the client should pass `translatedLanguage[]` in the request query string.

## 10. Request Parameters — Array Notation

MangaDex v5 uses **array notation** with square brackets for multi-value params:

```
GET /manga?contentRating[]=safe&contentRating[]=suggestive&tag[]=4d32cc48-9663-4932-b4a0-3f64e6e6a5a3
```

**Critical:** `tag[]=id1&tag[]=id2` NOT `tag=id1,id2`. The proxy's `URLSearchParams.append()` automatically handles this correctly.

## 11. Cover Art and Image URLs

- Cover art `fileName` from `cover_art` relationship is used as: `https://uploads.mangadex.org/covers/{mangaId}/{fileName}` 
- **NOT** through the API — direct CDN URL.
- The proxy's `cover/[coverId]` endpoint serves covers through the CDN with appropriate cache headers.

## 12. Search Endpoint

- `GET /manga?title=...&limit=...` — searches by title (all languages)
- `order[followedCount]=desc` — most-followed sort
- `includedTagsMode` / `excludedTagsMode`: `AND` (default) or `OR`
- Content rating filter applies automatically via proxy

## 13. Auth vs Unauthenticated Requests

- Public endpoints (manga, feed, at-home) work without auth.
- User-specific endpoints (followed manga, reading status, custom lists) require auth token in `Authorization: Bearer {token}` header.
- Proxy **does not** handle auth — client passes the token through the proxy.
- Auth login (`POST /auth/login`) returns a `refresh_token` and `session` token.
- **Do NOT cache auth endpoints** — proxy skips cache for any path starting with `auth` (line 151 check).

## 14. Image Hotlink Token Expiration

Tokens issued by `at-home` endpoint expire after 30 minutes. After expiry:
- Image requests return `403 Forbidden`
- Client must re-fetch chapter metadata from `/at-home/server/{chapterId}` to get fresh tokens
- Proxy caches at-home responses for 1 hour, but tokens themselves may expire earlier
- Mitigation: Client re-validates images on 403, re-fetches at-home data

## 15. Headers to Forward (or Strip)

| Header | Action | Reason |
|---|---|---|
| `x-ratelimit-*` | Forward | Client observability |
| `etag` | Forward | Client can do conditional requests |
| `last-modified` | Forward | Client cache validation |
| `cache-control` | Forward | CDN hints |
| `content-type` | Forward | Response type |
| `server` | Strip | Platform fingerprinting |
| `x-powered-by` | Strip | Obscurity |

## 16. SolidStart Server Route Caveats

- `[...path]` routes in SolidStart are **eagerly matched** — all segments must exist in the route file path.
- Route parameters are passed as `{ path: string[] }` — NOT `{ "*": string }`.
- `fetch()` in SolidStart server routes uses the Node.js `undici` fetch (Node 18+) which respects `next: { revalidate: 0 }` to bypass SolidStart's own cache.
- Server routes run on Node.js runtime by default. Edge runtime is specified via route file comment or config.
