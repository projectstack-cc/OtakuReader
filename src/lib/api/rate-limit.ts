import { getKVClient } from './cache';

export interface RateLimiterOptions {
  maxTokens: number;
  windowMs: number;
  keyPrefix?: string;
}

export interface RateLimiterResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

export interface KVLike {
  incr: (key: string) => Promise<number>;
  expire: (key: string, ttlSeconds: number) => Promise<number>;
  get: (key: string) => Promise<string | null>;
  del: (key: string) => Promise<number>;
}

interface MemoryBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRatePerMs: number;
}

interface MemoryState {
  [key: string]: MemoryBucket;
}

const memoryState: MemoryState = {};

export class RateLimiter {
  private readonly maxTokens: number;
  private readonly windowMs: number;
  private readonly keyPrefix: string;
  private readonly kv: KVLike | null;

  constructor(options: RateLimiterOptions, kvClient?: KVLike | null) {
    this.maxTokens = options.maxTokens;
    this.windowMs = options.windowMs;
    this.keyPrefix = options.keyPrefix ?? 'rl';
    this.kv = kvClient ?? null;
  }

  private memoryKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }

  private kvKey(key: string): string {
    return `ratelimit:${this.keyPrefix}:${key}`;
  }

  private memoryRefill(bucket: MemoryBucket): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const refillAmount = elapsed * bucket.refillRatePerMs;
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + refillAmount);
    bucket.lastRefill = now;
  }

  private memoryTryConsume(key: string): RateLimiterResult {
    const memKey = this.memoryKey(key);
    if (!memoryState[memKey]) {
      memoryState[memKey] = {
        tokens: this.maxTokens,
        lastRefill: Date.now(),
        maxTokens: this.maxTokens,
        refillRatePerMs: this.maxTokens / this.windowMs,
      };
    }

    const bucket = memoryState[memKey];
    this.memoryRefill(bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, remaining: Math.floor(bucket.tokens) };
    }

    const deficit = 1 - bucket.tokens;
    const retryAfterMs = Math.ceil(deficit / bucket.refillRatePerMs);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  private async kvTryConsume(key: string): Promise<RateLimiterResult> {
    if (!this.kv) return this.memoryTryConsume(key);

    const k = this.kvKey(key);
    const windowSeconds = Math.max(1, Math.ceil(this.windowMs / 1000));

    try {
      const count = await this.kv.incr(k);
      if (count === 1) {
        await this.kv.expire(k, windowSeconds);
      }

      if (count > this.maxTokens) {
        const ttlRaw = await this.kv.get(k);
        const retryAfterMs = ttlRaw ? parseInt(ttlRaw, 10) * 1000 : this.windowMs;
        await this.kv.del(k);
        return { allowed: false, remaining: 0, retryAfterMs };
      }

      return { allowed: true, remaining: this.maxTokens - count };
    } catch {
      return this.memoryTryConsume(key);
    }
  }

  async tryConsume(key: string): Promise<RateLimiterResult> {
    if (this.kv) {
      return this.kvTryConsume(key);
    }
    return this.memoryTryConsume(key);
  }

  getWaitTime(key: string): number {
    const memKey = this.memoryKey(key);
    if (!memoryState[memKey]) {
      memoryState[memKey] = {
        tokens: this.maxTokens,
        lastRefill: Date.now(),
        maxTokens: this.maxTokens,
        refillRatePerMs: this.maxTokens / this.windowMs,
      };
    }
    const bucket = memoryState[memKey];
    this.memoryRefill(bucket);
    const deficit = 1 - bucket.tokens;
    if (deficit <= 0) return 0;
    return Math.ceil(deficit / bucket.refillRatePerMs);
  }

  async waitForSlot(key: string, maxWaitMs: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
      const result = await this.tryConsume(key);
      if (result.allowed) return true;

      const waitTime = result.retryAfterMs ?? 1000;
      const elapsed = Date.now() - startTime;
      if (elapsed + waitTime > maxWaitMs) return false;

      await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, maxWaitMs - elapsed)));
      attempts++;
    }
    return false;
  }
}

export function createRateLimiter(
  options: RateLimiterOptions,
  kvClient?: KVLike | null,
): RateLimiter {
  return new RateLimiter(options, kvClient);
}

const sharedKVClient: { promise: ReturnType<typeof getKVClient> | null } = { promise: null };

async function getSharedKVClient(): Promise<Awaited<ReturnType<typeof getKVClient>>> {
  if (!sharedKVClient.promise) {
    sharedKVClient.promise = getKVClient();
  }
  return sharedKVClient.promise as Promise<Awaited<ReturnType<typeof getKVClient>>>;
}

export function createRateLimiterFromEnv(options: RateLimiterOptions): Promise<RateLimiter> {
  return getSharedKVClient().then(kv => createRateLimiter(options, kv));
}

export const mangaDexRateLimiter = createRateLimiter({
  maxTokens: 5,
  windowMs: 1000,
  keyPrefix: 'md-global',
});

export const mangaDexAtHomeRateLimiter = createRateLimiter({
  maxTokens: 40,
  windowMs: 60000,
  keyPrefix: 'md-athome',
});

export const anilistRateLimiter = createRateLimiter({
  maxTokens: 30,
  windowMs: 60000,
  keyPrefix: 'al',
});

export const jikanRateLimiter = createRateLimiter({
  maxTokens: 3,
  windowMs: 1000,
  keyPrefix: 'jk',
});
