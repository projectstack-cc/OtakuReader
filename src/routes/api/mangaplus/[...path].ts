// MangaPlus (Shueisha official) server proxy.
// Real host: jumpg-api.tokyo-cdn.com/api (protobuf + okhttp UA; the old
// mangaplus.shueisha.co.kr / JSON path was wrong and 403s).
// Device registration: PUT /register with device_token=md5(deviceId) and
//   security_key=md5(device_token + '4Kin9vGg'). The returned secret is
//   cached in KV with a long TTL (it persists across requests) and reused.
//
// Endpoints proxied (all GET):
//   title_list/all_v3      -> full title catalog (JSON, 30 min cache)
//   title_detailV3         -> per-title detail + chapter list (10 min)
//   manga_viewer           -> chapter page URLs (1 hour)
// Everything else returns 404.

import type { APIEvent } from '@solidjs/start/server';
import { cachedFetch } from '~/lib/api/cache';
import protobuf from 'protobufjs';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';

// ---- host / UA (matches the official app's okhttp fingerprint) ----
const HOST = 'https://jumpg-api.tokyo-cdn.com/api';
const UA = 'okhttp/4.12.0';
const COMMON = 'os=android&os_ver=35&app_ver=237';

// ---- protobuf: load the schema once at module init ----
const PROTO_PATH = fileURLToPath(new URL('../scripts/mangaplus_api.proto', import.meta.url));
const protoRoot = protobuf.parse(readFileSync(PROTO_PATH, 'utf8'), { keepCase: false }).root;
// Alias to avoid shadowing the global `Response` constructor used in json()/err().
const MpResponse = protoRoot.lookupType('Response');

// ---- device registration (cached) ----
const DEVICE_ID = 'otakureader-web-' + (process.env.VERCEL_URL ?? 'dev');
const DEVICE_TOKEN = crypto.createHash('md5').update(DEVICE_ID).digest('hex');
const SECURITY_KEY = crypto.createHash('md5').update(DEVICE_TOKEN + '4Kin9vGg').digest('hex');

async function getDeviceSecret(): Promise<string | null> {
  const { value } = await cachedFetch<{ secret?: string }>(
    'mangaplus:device_secret',
    86400, // 24 h
    async () => {
      const url = `${HOST}/register?${COMMON}&device_token=${encodeURIComponent(DEVICE_TOKEN)}&security_key=${encodeURIComponent(SECURITY_KEY)}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'User-Agent': UA, 'Accept-Encoding': 'identity', Connection: 'Keep-Alive' },
      });
      if (!res.ok) throw new Error(`register HTTP ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      const decoded = MpResponse.toObject(MpResponse.decode(buf), { enums: String, defaults: false });
      const secret = decoded.success?.registerationData?.deviceSecret;
      if (!secret) throw new Error('register response had no deviceSecret');
      return { secret };
    },
    { probeCache: true },
  );
  return value?.secret ?? null;
}

// ---- protobuf helpers ----
function decodeResponse(buf: Uint8Array): { error?: string; data?: Record<string, unknown> } {
  const decoded = MpResponse.toObject(MpResponse.decode(buf), { enums: String, defaults: false });
  if (decoded.error) return { error: decoded.error.englishPopup ?? decoded.error.message ?? 'unknown' };
  return { data: decoded.success ?? {} };
}

// ---- endpoint routing: map path -> real endpoint + query params ----
function resolveEndpoint(path: string): { realPath: string; extraParams?: string; ttl: number } | null {
  if (path === 'title_list/all_v3') {
    return { realPath: 'title_list/all_v3', extraParams: 'type=serializing&lang=eng&clang=eng', ttl: 1800 };
  }
  if (path === 'title_detailV3') {
    return { realPath: 'title_detailV3', ttl: 600 };
  }
  if (path === 'manga_viewer') {
    return { realPath: 'manga_viewer', ttl: 3600 };
  }
  return null;
}

function buildUrl(realPath: string, extraParams: string | undefined, queryString: string): string {
  const base = `${HOST}/${realPath}?${COMMON}`;
  const extras = extraParams ? `${extraParams}&` : '';
  const q = queryString.startsWith('?') ? queryString.slice(1) : queryString;
  return q ? `${base}${extras}${q}` : `${base}${extras}`.replace(/&$/, '');
}

// ---- response helpers ----
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

// ---- GET handler ----
export async function GET(event: APIEvent): Promise<Response> {
  const params = event.params as unknown as Record<string, string | string[]>;
  const raw = params['path'];
  const path = (Array.isArray(raw) ? raw.join('/') : raw || '').replace(/^\//, '');

  const endpoint = resolveEndpoint(path);
  if (!endpoint) return err(404, 'unknown mangaplus endpoint');

  const url = new URL(event.request.url);
  const query = url.search || '';

  try {
    const secret = await getDeviceSecret();
    if (!secret) return err(502, 'mangaplus: could not obtain device secret');

    const fullUrl = `${buildUrl(endpoint.realPath, endpoint.extraParams, query)}&device_secret=${encodeURIComponent(secret)}`;
    const ttl = endpoint.ttl;
    const cacheKey = `mangaplus:${path}${query}`;

    const { value, fromCache } = await cachedFetch<Record<string, unknown>>(cacheKey, ttl, async () => {
      const res = await fetch(fullUrl, {
        headers: { 'User-Agent': UA, 'Accept-Encoding': 'identity', Connection: 'Keep-Alive' },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`mangaplus upstream HTTP ${res.status}${text ? ': ' + text.slice(0, 200) : ''}`);
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      const decoded = decodeResponse(buf);
      if (decoded.error) throw new Error(`mangaplus: ${decoded.error}`);
      return { value: decoded.data ?? {} };
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
