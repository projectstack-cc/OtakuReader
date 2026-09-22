// MangaPlus (Shueisha official) server proxy — see src/lib/utils/api.ts.
// Routes (all GET):
//   /api/mangaplus/titles/all/all/v2?format=json  -> full title list
//   /api/mangaplus/title_v3?title_id=<id>&...     -> title detail + chapter list
//   /api/mangaplus/chapter_v3?chapter_id=<id>&... -> chapter pages (page URLs)
// Everything else is 404. All requests carry a browser-like UA; upstream is
// region-restricted in some networks, so failures return JSON errors and the
// client treats them as "no data" (MangaDex-only behavior is unaffected).

import type { APIEvent } from '@solidjs/start/server';
import { cachedFetch } from '~/lib/api/cache';

const MANGAPLUS_BASE = 'https://mangaplus.shueisha.co.kr';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const ALLOWED = /^(titles\/all\/all\/v2|title_v3|chapter_v3)$/;

function json(data: unknown, ttl: number, fromCache = false): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${ttl}`,
      'X-Cache': fromCache ? 'HIT' : 'MISS',
    },
  });
}

function err(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(event: APIEvent): Promise<Response> {
  const params = event.params as unknown as Record<string, string | string[]>;
  const raw = params['path'];
  const path = (Array.isArray(raw) ? raw.join('/') : raw || '').replace(/^\//, '');

  if (!ALLOWED.test(path)) return err(404, 'unknown mangaplus endpoint');

  const url = new URL(event.request.url);
  const query = url.search || '?format=json';

  try {
    // Title list: 30 min. Title detail: 10 min. Chapter pages: 1 h.
    const ttl = path === 'titles/all/all/v2' ? 1800 : path === 'title_v3' ? 600 : 3600;
    const { value, fromCache } = await cachedFetch(`mangaplus:${path}${query}`, ttl, async () => {
      const res = await fetch(`${MANGAPLUS_BASE}/${path}${query}`, {
        headers: { 'User-Agent': UA, Accept: '*/*' },
      });
      if (!res.ok) throw new Error(`MangaPlus returned HTTP ${res.status}`);
      return res.json();
    });
    return json(value, ttl, fromCache);
  } catch (e) {
    console.error('[mangaplus-proxy] error', { path, error: e instanceof Error ? e.message : 'unknown' });
    return err(502, e instanceof Error ? e.message : 'mangaplus upstream error');
  }
}

export async function POST(event: APIEvent): Promise<Response> {
  return GET(event);
}