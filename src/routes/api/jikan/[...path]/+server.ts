import { JIKAN_BASE_URL, DEFAULT_USER_AGENT, MAX_RETRIES, RETRY_BACKOFF_BASE_MS, JIKAN_PAGE_SIZE } from '$lib/api/constants';
import { createRateLimiterFromEnv, RateLimiter } from '$lib/api/rate-limit';
import { cachedFetch } from '$lib/api/cache';
import { ProxyError, proxyErrorResponse, fallbackResponse } from '$lib/api/errors';
import type { JikanResponse, JikanManga, JikanAnime, JikanPagination } from '$lib/api/types';

let jikanRateLimiterInstance: RateLimiter | null = null;
let jikanRateLimiterInit: Promise<RateLimiter> | null = null;

async function getJikanRateLimiter(): Promise<RateLimiter> {
  if (jikanRateLimiterInstance) return jikanRateLimiterInstance;
  if (!jikanRateLimiterInit) {
    jikanRateLimiterInit = createRateLimiterFromEnv({ maxTokens: 3, windowMs: 1000, keyPrefix: 'jk' });
    jikanRateLimiterInstance = await jikanRateLimiterInit;
  }
  return jikanRateLimiterInit;
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

const JIKAN_CACHE_TTL: Record<string, number> = {
  top: 3600,
  'top/manga': 3600,
  'top/anime': 3600,
  search: 600,
  'manga': 900,
  anime: 900,
  genres: 86400,
  genres_manga: 86400,
  random: 60,
  schedules: 300,
  seasons: 3600,
  users: 600,
  'manga/': 900,
};

function getCacheTTL(segments: string[]): number {
  const pathKey = segments.join('/');
  if (JIKAN_CACHE_TTL[pathKey]) return JIKAN_CACHE_TTL[pathKey];
  if (pathKey.startsWith('top/manga')) return 3600;
  if (pathKey.startsWith('manga/')) return 900;
  if (pathKey.startsWith('anime/')) return 900;
  if (pathKey.startsWith('search')) return 600;
  if (pathKey.startsWith('characters')) return 86400;
  if (pathKey.startsWith('producers')) return 86400;
  if (pathKey.startsWith('magazines')) return 86400;
  if (pathKey.startsWith('genres')) return 86400;
  if (pathKey.startsWith('users')) return 600;
  if (pathKey.startsWith('clubs')) return 86400;
  if (pathKey.startsWith('seasons')) return 3600;
  if (pathKey.startsWith('schedules')) return 300;
  if (pathKey.startsWith('random')) return 60;
  if (pathKey.startsWith('recommendations')) return 3600;
  if (pathKey.startsWith('reviews')) return 3600;
  return 600;
}

function buildCacheKey(segments: string[], queryParams: URLSearchParams): string {
  const pathPart = segments.join('/');
  const normalizedParams = new URLSearchParams();
  for (const [key, value] of queryParams) {
    if (!['page', 'limit', 'sfw'].includes(key)) {
      normalizedParams.set(key, value);
    }
  }
  const queryPart = normalizedParams.toString();
  return `jk:${pathPart}${queryPart ? `?${queryPart}` : ''}`;
}

async function fetchWithRateLimitAndRetry(
  url: string,
  maxRetries: number = MAX_RETRIES,
): Promise<Response> {
  const limiter = await getJikanRateLimiter();
  const waitResult = await limiter.waitForSlot(url, 5000);
  if (!waitResult) {
    const retryAfter = limiter.getWaitTime(url);
    throw new ProxyError({
      code: 'RATE_LIMITED',
      message: 'Jikan rate limited (3/sec). Back off and retry.',
      statusCode: 429,
      retryAfter,
    });
  }

  return exponentialBackoff(async () => {
    const res = await fetch(url, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (res.status === 429) {
      const retryAfterHeader = res.headers.get('Retry-After');
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
      throw new ProxyError({
        code: 'RATE_LIMITED',
        message: 'Jikan upstream rate limited',
        statusCode: 429,
        upstreamStatus: 429,
        upstreamBody: await res.text(),
        retryAfter,
      });
    }

    return res;
  }, maxRetries);
}

function isJikanSuccessResponse(status: number): boolean {
  return status >= 200 && status < 300;
}

export async function GET(
  { params }: { params: { path: string[] } },
  request: Request,
): Promise<Response> {
  const pathSegments = params.path ?? [];
  const url = new URL(request.url);
  const queryParams = url.searchParams;

  if (pathSegments.length === 0) {
    return proxyErrorResponse({
      code: 'INVALID_REQUEST',
      message: 'No Jikan endpoint specified',
      statusCode: 400,
    });
  }

  if (queryParams.has('page')) {
    const page = parseInt(queryParams.get('page') ?? '1', 10);
    if (isNaN(page) || page < 1) {
      return proxyErrorResponse({
        code: 'INVALID_REQUEST',
        message: '"page" must be a positive integer',
        statusCode: 400,
      });
    }
  }

  if (queryParams.has('limit')) {
    const limit = parseInt(queryParams.get('limit') ?? '25', 10);
    if (isNaN(limit) || limit < 1 || limit > 25) {
      queryParams.set('limit', String(JIKAN_PAGE_SIZE));
    }
  }

  const cacheKey = buildCacheKey(pathSegments, queryParams);
  const cacheTTL = getCacheTTL(pathSegments);

  if (!pathSegments.some(s => ['random'].includes(s))) {
    try {
      const cached = await cachedFetch<{ data: unknown }>(cacheKey, cacheTTL, async () => ({ data: null }), { probeCache: true });
      if (cached.fromCache && cached.value !== null) {
        return new Response(JSON.stringify({ ...(cached.value as object), _cache: { cached: true, ttl: cacheTTL, source: 'jikan-edge-cache', key: cacheKey } }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey,
          },
        });
      }
    } catch {
      console.error('[jikan-proxy] Cache read error', { cacheKey });
    }
  }

  let upstreamUrl: string;
  const basePath = pathSegments.join('/');
  upstreamUrl = `${JIKAN_BASE_URL}/${basePath}?${queryParams.toString()}`;

  try {
    const upstreamResponse = await fetchWithRateLimitAndRetry(upstreamUrl);

    if (!isJikanSuccessResponse(upstreamResponse.status)) {
      let errorBody: { error?: string } = {};
      try {
        errorBody = await upstreamResponse.json();
      } catch {
        errorBody = { error: upstreamResponse.statusText };
      }

      throw new ProxyError({
        code: upstreamResponse.status === 429 ? 'RATE_LIMITED' : 'UPSTREAM_ERROR',
        message: errorBody.error ?? `Jikan returned HTTP ${upstreamResponse.status}`,
        statusCode: upstreamResponse.status,
        upstreamStatus: upstreamResponse.status,
        upstreamBody: JSON.stringify(errorBody),
        path: basePath,
      });
    }

    const contentType = upstreamResponse.headers.get('content-type') ?? 'application/json';
    const rawBody = await upstreamResponse.text();

    if (!contentType.includes('application/json')) {
      return new Response(rawBody, {
        status: 200,
        headers: { 'Content-Type': contentType },
      });
    }

    let parsedData: { data: unknown; pagination?: JikanPagination };
    try {
      parsedData = JSON.parse(rawBody);
    } catch {
      return new Response(rawBody, { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    try {
      await cachedFetch(cacheKey, cacheTTL, async () => parsedData, { forceRefresh: true });
    } catch {
      console.error('[jikan-proxy] Cache write error', { cacheKey });
    }

    const responsePayload = {
      ...parsedData,
      _cache: { cached: false, ttl: cacheTTL, source: 'jikan-upstream', key: cacheKey },
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        'X-Cache-Key': cacheKey,
        'X-RateLimit-Remaining': String((await getJikanRateLimiter()).getWaitTime(cacheKey)),
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown';
    if (error instanceof ProxyError) {
      if (error.code === 'RATE_LIMITED') {
        return proxyErrorResponse({
          code: 'RATE_LIMITED',
          message,
          statusCode: 429,
          retryAfter: (error as ProxyError & { retryAfter?: number }).retryAfter,
          path: basePath,
        });
      }
    }

    console.error('[jikan-proxy] Upstream fetch error', {
      url: upstreamUrl,
      error: message,
    });

    try {
      const cached = await cachedFetch<{ data: unknown }>(cacheKey, cacheTTL, async () => ({ data: null }), { probeCache: true });
      if (cached.fromCache && cached.value !== null) {
        return new Response(JSON.stringify({
          ...(cached.value as Record<string, unknown>),
          _cache: { cached: true, ttl: cacheTTL, source: 'jikan-stale-cache', key: cacheKey },
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'HIT',
            'X-Cache-Stale': 'true',
          },
        });
      }
    } catch {
      console.error('[jikan-proxy] Fallback cache read error');
    }

    return fallbackResponse(false, `Jikan API error for ${basePath}: ${message}`);
  }
}

export async function POST({ params, request }: { params: { path: string[] }; request: Request }): Promise<Response> {
  return GET({ params }, request);
}

export async function PUT({ params, request }: { params: { path: string[] }; request: Request }): Promise<Response> {
  return GET({ params }, request);
}

export async function DELETE({ params, request }: { params: { path: string[] }; request: Request }): Promise<Response> {
  return GET({ params }, request);
}
