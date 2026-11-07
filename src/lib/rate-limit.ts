/**
 * SC-24 defense in depth: an in-memory token bucket per client key. Each serverless
 * instance has its own memory, so this only slows a single client on a warm instance;
 * the platform rule configured at deploy is the primary control (ADR-024).
 */

export type LimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number }

export interface TokenBucketOptions {
  /** Burst size and steady rate: `perMinute` requests per 60 s. */
  perMinute: number
  /** Upper bound on tracked clients; the least recently seen is evicted first. */
  maxKeys?: number
  now?: () => number
}

interface Bucket {
  tokens: number
  updatedAt: number
}

export class TokenBucketLimiter {
  private readonly capacity: number
  private readonly refillPerMs: number
  private readonly maxKeys: number
  private readonly now: () => number
  private readonly buckets = new Map<string, Bucket>()

  constructor(options: TokenBucketOptions) {
    if (!Number.isInteger(options.perMinute) || options.perMinute < 1) {
      throw new RangeError('perMinute must be a positive integer')
    }
    this.capacity = options.perMinute
    this.refillPerMs = options.perMinute / 60_000
    this.maxKeys = options.maxKeys ?? 10_000
    this.now = options.now ?? Date.now
  }

  /** Consumes one token for `key`, or says how long to wait for the next one. */
  take(key: string): LimitDecision {
    const now = this.now()
    const previous = this.buckets.get(key)
    const elapsed = previous ? Math.max(0, now - previous.updatedAt) : 0
    const tokens = previous
      ? Math.min(this.capacity, previous.tokens + elapsed * this.refillPerMs)
      : this.capacity

    // Re-insert so Map order tracks recency for eviction.
    this.buckets.delete(key)
    if (tokens >= 1) {
      this.buckets.set(key, { tokens: tokens - 1, updatedAt: now })
      this.evict()
      return { allowed: true }
    }
    this.buckets.set(key, { tokens, updatedAt: now })
    return { allowed: false, retryAfterSeconds: Math.ceil((1 - tokens) / this.refillPerMs / 1000) }
  }

  get size(): number {
    return this.buckets.size
  }

  private evict(): void {
    while (this.buckets.size > this.maxKeys) {
      const oldest = this.buckets.keys().next().value
      if (oldest === undefined) return
      this.buckets.delete(oldest)
    }
  }
}

/**
 * Best-effort client key. Netlify documents no client-IP header for Next.js route handlers
 * (ADR-024), so this reads the common proxy headers. They can be spoofed where the platform
 * does not overwrite them, which is acceptable for a secondary limiter: the key is never
 * logged or stored (SC-37) and the platform rule does not rely on it.
 */
export function clientKey(headers: Headers): string {
  const direct = headers.get('x-nf-client-connection-ip')?.trim()
  if (direct) return direct
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  return 'unknown'
}
