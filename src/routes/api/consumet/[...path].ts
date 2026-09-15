// Consumet (MangaPill, English scanlations) server proxy.
// Routes:
//   GET /api/consumet/search/:query        -> provider search (title, id, image)
//   GET /api/consumet/info?id=<mangaId>     -> manga info + chapter list
//   GET /api/consumet/read?chapterId=<id>   -> chapter page images
//   GET /api/consumet/image?url=<imgUrl>    -> image bytes proxy (Referer-safe, CORS-free)
// Responses are cached (search/info 1h, read 6h, images 7d via Cache-Control).

import type { APIEvent } from '@solidjs/start/server';
import { MANGA } from '@consumet/extensions';
import { cachedFetch } from '~/lib/api/cache';

function getPathSegments(event: APIEvent): string[] {
  const params = event.params as unknown as Record<string, string | string[]>;
  const raw = params['path'];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string' && raw.length > 0) return raw.split('/').filter(Boolean);
  return [];
}

function json(data: unknown, cacheControl: string, cacheHeader: 'HIT' | 'MISS' = 'MISS'): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheControl,
      'X-Cache': cacheHeader,
    },
  });
}

function err(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let mangaPill: InstanceType<typeof MANGA.MangaPill> | null = null;
function provider(): InstanceType<typeof MANGA.MangaPill> {
  if (!mangaPill) mangaPill = new MANGA.MangaPill();
  return mangaPill;
}

export async function GET(event: APIEvent): Promise<Response> {
  const segments = getPathSegments(event);
  const action = segments[0] || '';
  const url = new URL(event.request.url);

  try {
    // ---- search/:query ----
    if (action === 'search') {
      const query = decodeURIComponent(segments.slice(1).join('/') || '').trim();
      if (!query) return err(400, 'search query is required');
      const data = await cachedFetch(
        `consumet:search:${query.toLowerCase()}`,
        3600,
        () => provider().search(query),
      );
      return json(data, 'public, max-age=3600', data.fromCache ? 'HIT' : 'MISS');
    }

    // ---- info?id= ----
    if (action === 'info') {
      const id = url.searchParams.get('id') || '';
      if (!id) return err(400, 'id is required');
      const data = await cachedFetch(
        `consumet:info:${id}`,
        3600,
        () => provider().fetchMangaInfo(id),
      );
      return json(data, 'public, max-age=3600', data.fromCache ? 'HIT' : 'MISS');
    }

    // ---- read?chapterId= ----
    if (action === 'read') {
      const chapterId = url.searchParams.get('chapterId') || '';
      if (!chapterId) return err(400, 'chapterId is required');
      const data = await cachedFetch(
        `consumet:read:${chapterId}`,
        21600,
        () => provider().fetchChapterPages(chapterId),
      );
      return json(data, 'public, max-age=21600', data.fromCache ? 'HIT' : 'MISS');
    }

    // ---- image?url= ---- proxy upstream image bytes with Referer header
    if (action === 'image') {
      const imgUrl = url.searchParams.get('url') || '';
      if (!imgUrl || !/^https?:\/\//i.test(imgUrl)) return err(400, 'url is required');
      const upstream = await fetch(imgUrl, {
        headers: {
          Referer: 'https://mangapill.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      if (!upstream.ok) return err(upstream.status, `upstream image error: ${upstream.status}`);
      const buf = await upstream.arrayBuffer();
      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=604800, immutable',
        },
      });
    }

    return err(404, 'unknown consumet endpoint (search/:query, info?id=, read?chapterId=, image?url=)');
  } catch (e) {
    console.error('[consumet-proxy] error', { action, error: e instanceof Error ? e.message : 'unknown' });
    return err(502, e instanceof Error ? e.message : 'consumet provider error');
  }
}

export async function POST(event: APIEvent): Promise<Response> {
  return GET(event);
}
