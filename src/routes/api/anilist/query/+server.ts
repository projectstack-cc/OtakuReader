import { ANILIST_BASE_URL, DEFAULT_USER_AGENT, MAX_RETRIES, RETRY_BACKOFF_BASE_MS, RETRY_HEADER } from '$lib/api/constants';
import { createRateLimiterFromEnv, RateLimiter } from '$lib/api/rate-limit';
import { cachedFetch } from '$lib/api/cache';
import { ProxyError, proxyErrorResponse } from '$lib/api/errors';
import type { AnilistMedia, AnilistUser } from '$lib/api/types';

let anilistRateLimiterInstance: RateLimiter | null = null;
let anilistRateLimiterInit: Promise<RateLimiter> | null = null;

async function getAnilistRateLimiter(): Promise<RateLimiter> {
  if (anilistRateLimiterInstance) return anilistRateLimiterInstance;
  if (!anilistRateLimiterInit) {
    anilistRateLimiterInit = createRateLimiterFromEnv({ maxTokens: 30, windowMs: 60000, keyPrefix: 'al' });
    anilistRateLimiterInstance = await anilistRateLimiterInit;
  }
  return anilistRateLimiterInit;
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

const ANILIST_QUERY_CACHE_TTL = 300;
const ANILIST_PUBLIC_QUERIES: string[] = [
  'trending',
  'recent',
  'popular',
  'search',
  'manga',
  'detail',
  'genre',
  'staff',
  'character',
];

function buildCacheKey(query: string, variables: Record<string, unknown>): string {
  const normalized = query.replace(/\s+/g, ' ').trim().substring(0, 200);
  const variablesStr = JSON.stringify(variables);
  return `al:${normalized}:${variablesStr}`;
}

function validateGraphQLQuery(query: string): { valid: boolean; error?: string } {
  const trimmed = query.trim();
  if (!trimmed.startsWith('query') && !trimmed.startsWith('mutation')) {
    return { valid: false, error: 'Query must start with "query" or "mutation"' };
  }
  const dangerousPatterns = [
    /\bDROP\s+\w+/i,
    /\bDELETE\s+\w+/i,
    /\bINSERT\s+\w+/i,
    /\bUPDATE\s+\w+/i,
    /\bALTER\s+\w+/i,
    /\bTRUNCATE\b/i,
  ];
  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'Query contains forbidden operations' };
    }
  }
  return { valid: true };
}

async function executeGraphQL(
  query: string,
  variables: Record<string, unknown> = {},
  forceRefresh = false,
): Promise<{ data: Record<string, unknown>; fromCache: boolean }> {
  const cacheKey = buildCacheKey(query, variables);
  const isPublicQuery = ANILIST_PUBLIC_QUERIES.some(pub =>
    query.toLowerCase().includes(pub.toLowerCase()),
  );

  const validation = validateGraphQLQuery(query);
  if (!validation.valid) {
    throw new ProxyError({
      code: 'INVALID_REQUEST',
      message: validation.error ?? 'Invalid GraphQL query',
      statusCode: 400,
    });
  }

  if (!forceRefresh && isPublicQuery) {
    try {
      const cached = await cachedFetch(cacheKey, ANILIST_QUERY_CACHE_TTL, async () => null, { probeCache: true });
      if (cached.fromCache && cached.value !== null) {
        return { data: cached.value as Record<string, unknown>, fromCache: true };
      }
    } catch {
      console.error('[anilist] Cache read error', { cacheKey });
    }
  }

  const rateLimitResult = await (await getAnilistRateLimiter()).tryConsume(cacheKey);
  if (!rateLimitResult.allowed) {
    throw new ProxyError({
      code: 'RATE_LIMITED',
      message: 'AniList rate limit exceeded. Retry after 60s.',
      statusCode: 429,
      retryAfter: rateLimitResult.retryAfterMs,
    });
  }

  try {
    const response = await exponentialBackoff(async () => {
      const res = await fetch(ANILIST_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': DEFAULT_USER_AGENT,
          'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });
      return res;
    }, MAX_RETRIES);

    if (!response.ok) {
      const text = await response.text();
      throw new ProxyError({
        code: 'UPSTREAM_ERROR',
        message: `AniList returned HTTP ${response.status}`,
        statusCode: response.status,
        upstreamStatus: response.status,
        upstreamBody: text,
      });
    }

    const result = await response.json();

    if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
      const err = result.errors[0];
      throw new ProxyError({
        code: 'UPSTREAM_ERROR',
        message: err.message ?? 'GraphQL error',
        statusCode: err.status ?? 400,
        upstreamStatus: err.status,
        upstreamBody: JSON.stringify(result.errors),
      });
    }

    if (isPublicQuery) {
      try {
        await cachedFetch(cacheKey, ANILIST_QUERY_CACHE_TTL, async () => result.data, { forceRefresh: true });
      } catch {
        console.error('[anilist] Cache write error', { cacheKey });
      }
    }

    const filteredData = filterAdultMedia(result.data as Record<string, unknown>);

    return { data: filteredData as Record<string, unknown>, fromCache: false };

  } catch (error) {
    if (error instanceof ProxyError) {
      throw error;
    }

    console.error('[anilist] GraphQL error', { error: error instanceof Error ? error.message : 'unknown' });

    try {
      const cached = await cachedFetch(cacheKey, ANILIST_QUERY_CACHE_TTL, async () => null, { probeCache: true });
      if (cached.fromCache && cached.value !== null) {
        return { data: cached.value as Record<string, unknown>, fromCache: true };
      }
    } catch {
      console.error('[anilist] Fallback cache read error');
    }

    throw new ProxyError({
      code: 'ALL_FALLBACKS_FAILED',
      message: `AniList query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      statusCode: 503,
    });
  }
}

function filterAdultMedia(data: Record<string, unknown>): Record<string, unknown> {
  if (!data || typeof data !== 'object') return data;

  if (data.Page && typeof data.Page === 'object' && Array.isArray((data.Page as Record<string, unknown>).media)) {
    const page = data.Page as Record<string, unknown>;
    page.media = (page.media as Record<string, unknown>[]).filter(
      (m: Record<string, unknown>) => m.isAdult !== true,
    );
  }

  return data;
}

export async function GET({ request }: { params: Record<string, string>; request: Request }): Promise<Response> {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('query')?.trim();
    const variablesParam = url.searchParams.get('variables');

    if (!query) {
      return proxyErrorResponse({
        code: 'INVALID_REQUEST',
        message: 'Missing required "query" parameter',
        statusCode: 400,
      });
    }

    let variables: Record<string, unknown> = {};
    if (variablesParam) {
      try {
        variables = JSON.parse(variablesParam);
      } catch {
        return proxyErrorResponse({
          code: 'INVALID_REQUEST',
          message: 'Invalid "variables" JSON',
          statusCode: 400,
        });
      }
    }

    const forceRefresh = url.searchParams.get('forceRefresh') === 'true';
    const { data, fromCache } = await executeGraphQL(query, variables, forceRefresh);

    const filteredData = filterAdultMedia(data as Record<string, unknown>);

    const responseData = {
      data: filteredData,
      _cache: fromCache
        ? { cached: true, source: 'anilist-edge-cache', ttl: ANILIST_QUERY_CACHE_TTL }
        : { cached: false, source: 'anilist-upstream' },
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': fromCache ? 'HIT' : 'MISS',
        'X-RateLimit-Remaining': String((await getAnilistRateLimiter()).getWaitTime(buildCacheKey(query, variables))),
      },
    });

  } catch (error) {
    if (error instanceof ProxyError) {
      return proxyErrorResponse(error);
    }
    console.error('[anilist] Unexpected error', { error });
    return proxyErrorResponse({
      code: 'UPSTREAM_ERROR',
      message: 'Unexpected AniList proxy error',
      statusCode: 500,
    });
  }
}

export async function POST({ request }: { params: Record<string, string>; request: Request }): Promise<Response> {
  try {
    const body = await request.json();
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    const variables = typeof body.variables === 'object' && body.variables !== null ? body.variables : {};

    if (!query) {
      return proxyErrorResponse({
        code: 'INVALID_REQUEST',
        message: 'Missing "query" field in request body',
        statusCode: 400,
      });
    }

    const forceRefresh = body.forceRefresh === true;
    const { data, fromCache } = await executeGraphQL(query, variables, forceRefresh);

    const filteredData = filterAdultMedia(data as Record<string, unknown>);

    return new Response(JSON.stringify({
      data: filteredData,
      _cache: fromCache ? { cached: true, source: 'anilist-edge-cache' } : { cached: false, source: 'anilist-upstream' },
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': fromCache ? 'HIT' : 'MISS',
      },
    });

  } catch {
    return proxyErrorResponse({
      code: 'UPSTREAM_ERROR',
      message: 'Failed to process AniList GraphQL request',
      statusCode: 500,
    });
  }
}
