type CacheValue = { value: unknown; expiresAt: number };
type StringCacheValue = { value: string; expiresAt: number };

const memoryCache: Map<string, StringCacheValue> = new Map();

function isKVClientAvailable(): boolean {
  return typeof import.meta !== 'undefined' && !!(import.meta as unknown as Record<string, unknown>).env && typeof ((import.meta as unknown as Record<string, unknown>).env as Record<string, unknown>).KV_URL === 'string';
}

export async function getKVClient(): Promise<{
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, opts?: { ex?: number }) => Promise<void>;
  del: (key: string) => Promise<number>;
  incr: (key: string) => Promise<number>;
  expire: (key: string, ttlSeconds: number) => Promise<number>;
} | null> {
  if (!isKVClientAvailable()) return null;
  try {
    const { kv } = await import('@vercel/kv');
    return {
      get: (key: string) => kv.get<string>(key).then(v => (v ?? null)),
      set: (key: string, value: string, opts?: { ex?: number }) => (kv.set as (k: string, v: string, o?: { ex?: number }) => Promise<void>)(key, value, opts as { ex?: number }),
      del: (key: string) => kv.del(key),
      incr: (key: string) => kv.incr(key),
      expire: (key: string, ttlSeconds: number) => kv.expire(key, ttlSeconds),
    };
  } catch {
    return null;
  }
}

function memoryGet(key: string): string | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: string, ttlSeconds: number): void {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  pruneExpiredEntries();
}

function memoryDel(key: string): void {
  memoryCache.delete(key);
}

function pruneExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (now > entry.expiresAt) memoryCache.delete(key);
  }
}

async function kvGet(key: string): Promise<string | null> {
  const client = await getKVClient();
  if (client) return client.get(key);
  return memoryGet(key);
}

async function kvSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const client = await getKVClient();
  if (client) {
    try {
      await client.set(key, value, { ex: ttlSeconds });
    } catch {
      memorySet(key, value, ttlSeconds);
    }
  } else {
    memorySet(key, value, ttlSeconds);
  }
}

async function kvDel(key: string): Promise<void> {
  const client = await getKVClient();
  if (client) {
    try {
      await client.del(key);
    } catch {
      memoryDel(key);
    }
  } else {
    memoryDel(key);
  }
}

export interface CacheEntry<T> {
  value: T;
  cachedAt: number;
  ttl: number;
  isExpired(): boolean;
  ageMs(): number;
  ageSeconds(): number;
}

export function createCacheEntry<T>(value: T, ttlSeconds: number): CacheEntry<T> {
  const cachedAt = Date.now();
  return {
    value,
    cachedAt,
    ttl: ttlSeconds,
    isExpired: () => Date.now() > cachedAt + ttlSeconds * 1000,
    ageMs: () => Date.now() - cachedAt,
    ageSeconds: () => Math.floor((Date.now() - cachedAt) / 1000),
  };
}

export async function cacheGet<T>(key: string): Promise<CacheEntry<T> | null> {
  const raw = await kvGet(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { value: T; cachedAt: number; ttl: number };
    const entry = Object.assign(createCacheEntry<T>(parsed.value, parsed.ttl), {
      cachedAt: parsed.cachedAt,
      ttl: parsed.ttl,
    });
    if (Date.now() > parsed.cachedAt + parsed.ttl * 1000) {
      await cacheDel(key);
      return null;
    }
    return entry;
  } catch {
    await cacheDel(key);
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const payload = JSON.stringify({ value, cachedAt: Date.now(), ttl: ttlSeconds });
  await kvSet(key, payload, ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  await kvDel(key);
}

export async function cacheClear(pattern?: string): Promise<void> {
  if (pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) memoryCache.delete(key);
    }
    return;
  }
  memoryCache.clear();
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
}

const stats = { hits: 0, misses: 0 };
let lastReset = Date.now();

export function getCacheStats(): CacheStats {
  const total = stats.hits + stats.misses;
  return {
    hits: stats.hits,
    misses: stats.misses,
    hitRate: total === 0 ? 0 : stats.hits / total,
    totalKeys: memoryCache.size,
  };
}

export function resetCacheStats(): void {
  stats.hits = 0;
  stats.misses = 0;
  lastReset = Date.now();
}

export async function cachedFetch<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
  opts?: { forceRefresh?: boolean; probeCache?: boolean },
): Promise<{ value: T; fromCache: boolean }> {
  if (!opts?.forceRefresh) {
    const cached = await cacheGet<T>(key);
    if (cached) {
      stats.hits++;
      return { value: cached.value, fromCache: true };
    }
  }
  if (opts?.probeCache) {
    stats.misses++;
    const nullValue = null as unknown as T;
    await cacheSet(key, nullValue, ttlSeconds);
    return { value: nullValue, fromCache: false };
  }
  stats.misses++;
  const value = await fetcher();
  await cacheSet(key, value, ttlSeconds);
  return { value, fromCache: false };
}
