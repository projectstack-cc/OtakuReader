import type { APIEvent } from '@solidjs/start/server';
import { MANGA_DEX_BASE_URL, MANGA_DEX_PAGE_SIZE, MANGA_DEX_AT_HOME_BASE_URL, ALLOWED_CONTENT_RATINGS, CONTENT_RATING_PARAM, DEFAULT_USER_AGENT, MAX_RETRIES, RETRY_BACKOFF_BASE_MS, RETRY_HEADER } from '~/lib/api/constants';
import { createRateLimiterFromEnv, RateLimiter } from '~/lib/api/rate-limit';
import { cachedFetch, cacheGet, cacheSet } from '~/lib/api/cache';
import { ProxyError, proxyErrorResponse, fallbackResponse } from '~/lib/api/errors';
import type { MangaDexSearchResponse, MangaDexFeedResponse, MangaDexAtHomeResponse, MangaDexListResponse, MangaDexManga, MangaDexChapter, MangaDexCoverArt, MangaDexAuthor, MangaDexScanlationGroup, MangaDexAggregateResponse, MangaDexRateLimitHeaders, MangaDexErrorResponse, MangaDexRelationResponse, MangaDexReportReasonListResponse, MangaDexLegacyMappingResponse, MangaDexMangaRatingResponse, MangaDexFollowedMangaResponse, MangaDexReadMarkersResponse, MangaDexReadingStatusResponse, MangaDexAccountCapabilitiesResponse, MangaDexUser, MangaDexCustomList, MangaDexProxyCacheInfo, ContentRatingFilter } from '~/lib/api/types';

let mdRateLimiter: RateLimiter | null = null;
let mdRateLimiterInit: Promise<RateLimiter> | null = null;

async function getMDRateLimiter(): Promise<RateLimiter> {
  if (mdRateLimiter) return mdRateLimiter;
  if (!mdRateLimiterInit) {
    mdRateLimiterInit = createRateLimiterFromEnv({ maxTokens: 5, windowMs: 1000, keyPrefix: 'md-global' });
    mdRateLimiter = await mdRateLimiterInit;
  }
  return mdRateLimiterInit;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function exponentialBackoff(fn: () => Promise<Response>, retriesLeft: number): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (retriesLeft <= 0) throw error;
    const delay = RETRY_BACKOFF_BASE_MS * 2 ** (MAX_RETRIES - retriesLeft);
    await sleep(delay);
    return exponentialBackoff(fn, retriesLeft - 1);
  }
}

function buildRateLimitHeaders(headers: Headers): MangaDexRateLimitHeaders {
  const result: MangaDexRateLimitHeaders = {};
  const limit = headers.get('x-ratelimit-limit');
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');
  if (limit) result.rateLimitLimit = Number(limit);
  if (remaining) result.rateLimitRemaining = Number(remaining);
  if (reset) result.rateLimitReset = Number(reset);
  return result;
}

function forwardHeaders(upstream: Headers, extra?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const passthrough = [
    'content-type',
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-reset',
    'cache-control',
    'etag',
    'last-modified',
  ];
  for (const h of passthrough) {
    const v = upstream.get(h);
    if (v) out[h] = v;
  }
  if (extra) Object.assign(out, extra);
  return out;
}

function buildCacheKey(segments: string[], queryParams: URLSearchParams): string {
  const pathPart = segments.join('/');
  const queryPart = queryParams.toString();
  return `md:${pathPart}${queryPart ? `?${queryPart}` : ''}`;
}

function buildFilteredUrl(segments: string[], queryParams: URLSearchParams): { url: string; filteredParams: URLSearchParams } {
  const pathPart = segments.join('/');
  const filteredParams = new URLSearchParams(queryParams.toString());

  if (!queryParams.get('contentRating[]') && !queryParams.has('contentRating')) {
    const ratings = ALLOWED_CONTENT_RATINGS;
    for (const r of ratings) filteredParams.append('contentRating[]', r);
  }

  if (pathPart === 'manga' && !filteredParams.has('limit')) {
    filteredParams.set('limit', String(MANGA_DEX_PAGE_SIZE));
  }

  const queryPart = filteredParams.toString();
  return {
    url: `${MANGA_DEX_BASE_URL}/${pathPart}${queryPart ? `?${queryPart}` : ''}`,
    filteredParams,
  };
}

function buildCacheTTL(segments: string[]): number {
  if (segments.includes('at-home') || segments.includes('at_home')) return 3600;
  if (segments.some(s => ['manga', 'feed'].includes(s))) return 60;
  if (segments.includes('author') || segments.includes('group')) return 300;
  if (segments.some(s => ['search', 'list'].includes(s))) return 120;
  return 60;
}

async function fetchWithRateLimitAndRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = MAX_RETRIES,
): Promise<Response> {
  const limiter = await getMDRateLimiter();
  const waitResult = await limiter.waitForSlot(url, 5000);
  if (!waitResult) {
    const retryAfter = limiter.getWaitTime(url);
    throw new ProxyError({
      code: 'RATE_LIMITED',
      message: `Rate limited for ${url}`,
      statusCode: 429,
      retryAfter,
    });
  }

  return exponentialBackoff(async () => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get(RETRY_HEADER);
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
      if (retryAfter) {
        throw new ProxyError({
          code: 'RATE_LIMITED',
          message: 'Upstream rate limited',
          statusCode: 429,
          upstreamStatus: 429,
          upstreamBody: await response.text(),
          retryAfter,
        });
      }
    }

    return response;
  }, maxRetries);
}

export async function GET(event: APIEvent): Promise<Response> {
  const pathSegments = (event.params.path ?? '').split('/').filter(Boolean);
  const url = new URL(event.request.url);
  const queryParams = url.searchParams;

  if (pathSegments.length === 0) {
    return new Response(JSON.stringify({ error: 'No path provided' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const isAtHome = pathSegments[0] === 'at-home';

  let upstreamUrl: string;
  let effectiveQueryParams: URLSearchParams;
  if (isAtHome) {
    const chapterId = pathSegments[1];
    const mode = pathSegments[2] || 'data';
    upstreamUrl = `${MANGA_DEX_AT_HOME_BASE_URL}/server/${chapterId}${mode === 'data-saver' ? '?forcePort443=false&useCompression=true&useDataSaver=true' : '?forcePort443=false&useCompression=true'}`;
    effectiveQueryParams = queryParams;
  } else {
    const { url: filteredUrl, filteredParams } = buildFilteredUrl(pathSegments, queryParams);
    upstreamUrl = filteredUrl;
    effectiveQueryParams = filteredParams;
  }

  const cacheKey = buildCacheKey(pathSegments, effectiveQueryParams);
  const cacheTTL = buildCacheTTL(pathSegments);

  if (!isAtHome && pathSegments[0] !== 'auth') {
    try {
      let cachedHeaders: Record<string, string> = {};
      const cached = await cachedFetch(cacheKey, cacheTTL, async () => null, { probeCache: true });
      if (cached.fromCache && cached.value !== null) {
        try {
          const headersRaw = await cacheGet<string>(`${cacheKey}:headers`);
          if (headersRaw) {
            cachedHeaders = JSON.parse(headersRaw.value) as Record<string, string>;
          }
        } catch {
          // headers not cached, proceed without them
        }
        const cacheInfo: MangaDexProxyCacheInfo = { cached: true, ttl: cacheTTL, key: cacheKey };
        return new Response(JSON.stringify({ ...(cached.value as object), _cache: cacheInfo }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey,
            ...cachedHeaders,
          },
        });
      }
    } catch {
      console.error('[manga-proxy] Cache read error, proceeding without cache', { cacheKey });
    }
  }

  try {
    const upstreamResponse = await fetchWithRateLimitAndRetry(
      upstreamUrl,
      { method: 'GET', headers: {} },
    );

    if (!upstreamResponse.ok) {
      let errorBody: MangaDexErrorResponse | null = null;
      try {
        errorBody = await upstreamResponse.json();
      } catch {
        errorBody = { result: 'error', errors: [{ id: 'unknown', status: upstreamResponse.status, title: upstreamResponse.statusText }] };
      }

      throw new ProxyError({
        code: upstreamResponse.status === 429 ? 'RATE_LIMITED' : 'UPSTREAM_ERROR',
        message: errorBody?.errors?.[0]?.detail ?? errorBody?.errors?.[0]?.title ?? `HTTP ${upstreamResponse.status}`,
        statusCode: upstreamResponse.status,
        upstreamStatus: upstreamResponse.status,
        upstreamBody: JSON.stringify(errorBody),
        retryAfter: upstreamResponse.headers.get(RETRY_HEADER) ? parseInt(upstreamResponse.headers.get(RETRY_HEADER)!, 10) : undefined,
        path: pathSegments.join('/'),
      });
    }

    const responseHeaders = forwardHeaders(upstreamResponse.headers);

    if (isAtHome) {
      const atHomeData = (await upstreamResponse.json()) as MangaDexAtHomeResponse;
      return new Response(JSON.stringify(atHomeData), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...responseHeaders },
      });
    }

    const rawBody = await upstreamResponse.text();
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(rawBody);
    } catch {
      return new Response(rawBody, {
        status: 200,
        headers: { 'Content-Type': upstreamResponse.headers.get('content-type') ?? 'application/octet-stream', ...responseHeaders },
      });
    }

    const rateLimitHeaders = buildRateLimitHeaders(upstreamResponse.headers);

    const isListResponse = (obj: unknown): boolean => {
      if (!obj || typeof obj !== 'object') return false;
      const r = obj as Record<string, unknown>;
      return Array.isArray(r.data) && typeof r.limit === 'number' && typeof r.total === 'number';
    };

    const isSearchResponse = (obj: unknown): boolean => {
      if (!obj || typeof obj !== 'object') return false;
      const r = obj as Record<string, unknown>;
      return Array.isArray(r.data) && 'result' in r && (r as { result: string }).result === 'ok';
    };

    const isAtHomeResponse = (obj: unknown): boolean => {
      if (!obj || typeof obj !== 'object') return false;
      const r = obj as Record<string, unknown>;
      return 'baseUrl' in r && 'chapter' in r;
    };

    const shouldCache = (): boolean => {
      const data = parsedData as Record<string, unknown>;
      return !isAtHomeResponse(parsedData);
    };

    if (shouldCache()) {
      try {
        const cachePayload = JSON.stringify({ ...(parsedData as Record<string, unknown>), _rateLimit: rateLimitHeaders });
        await cacheSet(cacheKey, cachePayload, cacheTTL);
        await cacheSet(`${cacheKey}:headers`, JSON.stringify(responseHeaders), cacheTTL);
      } catch {
        console.error('[manga-proxy] Cache write error', { cacheKey });
      }
    }

    const responsePayload = {
      ...(parsedData as Record<string, unknown>),
      _rateLimit: rateLimitHeaders,
      _headers: responseHeaders,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        'X-Cache-Key': cacheKey,
        ...responseHeaders,
      },
    });

  } catch (error) {
    if (error instanceof ProxyError) {
      if (error.code === 'RATE_LIMITED') {
        return proxyErrorResponse({
          code: 'RATE_LIMITED',
          message: error.message,
          statusCode: 429,
          upstreamStatus: error.upstreamStatus,
          retryAfter: error.retryAfter,
          path: pathSegments.join('/'),
        });
      }
    }

    console.error('[manga-proxy] Upstream fetch error', {
      url: upstreamUrl,
      path: pathSegments.join('/'),
      error: error instanceof Error ? error.message : 'Unknown',
    });

    try {
      const cachedEntry = await cacheGet<unknown>(cacheKey);
      if (cachedEntry) {
        return new Response(JSON.stringify({ ...(cachedEntry.value as Record<string, unknown>), _cache: { cached: true, ttl: cacheTTL, key: cacheKey } }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'HIT',
            'X-Cache-Stale': 'true',
            'X-Cache-Key': cacheKey,
          },
        });
      }
    } catch {
      console.error('[manga-proxy] Fallback cache read error', { cacheKey });
    }

    if (isAtHome) {
      return fallbackResponse(false, 'Chapter images unavailable and no cached data found.');
    }

    return fallbackResponse(false, `MangaDex API error: ${error instanceof Error ? error.message : 'Unknown error'}. No cached data available.`);
  }
}

export async function POST(event: APIEvent): Promise<Response> {
  return GET(event);
}

export async function PUT(event: APIEvent): Promise<Response> {
  return GET(event);
}

export async function DELETE(event: APIEvent): Promise<Response> {
  return GET(event);
}
