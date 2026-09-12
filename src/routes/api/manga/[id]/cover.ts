import type { APIEvent } from '@solidjs/start/server';
import { DEFAULT_USER_AGENT, CACHE_TTL } from '~/lib/api/constants';
import { cachedFetch, cacheGet, cacheSet } from '~/lib/api/cache';

const MANGA_DEX_CDN_BASE = 'https://uploads.mangadex.org/covers';
const COVER_CACHE_TTL = CACHE_TTL.MANGA_DEX_COVER;

function buildCoverCacheKey(mangaId: string, fileName: string, size: string): string {
  return `md:cover:${mangaId}:${fileName}:${size}`;
}

export async function GET(event: APIEvent): Promise<Response> {
  const mangaId = event.params.id;
  const url = new URL(event.request.url);
  const fileName = url.searchParams.get('file');
  const size = url.searchParams.get('size') || '512';

  if (!fileName) {
    return new Response(JSON.stringify({ error: 'Missing required "file" query parameter' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cdnUrl = `${MANGA_DEX_CDN_BASE}/${encodeURIComponent(mangaId)}/${encodeURIComponent(fileName)}`;
  const cacheKey = buildCoverCacheKey(mangaId, fileName, size);

  try {
    const cached = await cacheGet<{ body: ArrayBuffer; contentType: string }>(cacheKey);
    if (cached) {
      return new Response(cached.value.body, {
        status: 200,
        headers: {
          'Content-Type': cached.value.contentType,
          'X-Cache': 'HIT',
          'Cache-Control': `public, max-age=${COVER_CACHE_TTL}`,
        },
      });
    }
  } catch {
    console.error('[cover-proxy] Cache read error', { cacheKey });
  }

  try {
    const response = await fetch(cdnUrl, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({
        error: 'COVER_NOT_FOUND',
        message: `MangaDex CDN returned HTTP ${response.status}`,
        upstreamStatus: response.status,
      }), {
        status: response.status === 404 ? 404 : 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const bodyBuffer = await response.arrayBuffer();

    try {
      await cacheSet(cacheKey, { body: bodyBuffer, contentType }, COVER_CACHE_TTL);
    } catch {
      console.error('[cover-proxy] Cache write error', { cacheKey });
    }

    return new Response(bodyBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${COVER_CACHE_TTL}`,
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('[cover-proxy] Upstream fetch error', {
      url: cdnUrl,
      error: error instanceof Error ? error.message : 'unknown',
    });

    try {
      const cached = await cacheGet<{ body: ArrayBuffer; contentType: string }>(cacheKey);
      if (cached) {
        return new Response(cached.value.body, {
          status: 200,
          headers: {
            'Content-Type': cached.value.contentType,
            'X-Cache': 'HIT-STALE',
            'Cache-Control': `public, max-age=${COVER_CACHE_TTL}`,
          },
        });
      }
    } catch {
      console.error('[cover-proxy] Fallback cache read error', { cacheKey });
    }

    return new Response(JSON.stringify({
      error: 'UPSTREAM_ERROR',
      message: `Failed to fetch cover from MangaDex CDN: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(event: APIEvent): Promise<Response> {
  return GET(event);
}
