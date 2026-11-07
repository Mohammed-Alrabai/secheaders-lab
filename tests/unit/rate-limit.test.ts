import { describe, expect, it } from 'vitest'

import { TokenBucketLimiter, clientKey } from '@/lib/rate-limit'

function clock(start = 0) {
  let t = start
  return { now: () => t, advance: (ms: number) => (t += ms) }
}

describe('TokenBucketLimiter (SC-24)', () => {
  it('allows a burst of perMinute, then rejects with Retry-After', () => {
    const c = clock()
    const limiter = new TokenBucketLimiter({ perMinute: 10, now: c.now })
    for (let i = 0; i < 10; i++) expect(limiter.take('a').allowed).toBe(true)
    expect(limiter.take('a')).toEqual({ allowed: false, retryAfterSeconds: 6 })
  })

  it('refills at perMinute / 60 s', () => {
    const c = clock()
    const limiter = new TokenBucketLimiter({ perMinute: 10, now: c.now })
    for (let i = 0; i < 10; i++) limiter.take('a')
    c.advance(5_999)
    expect(limiter.take('a').allowed).toBe(false)
    // One token every 6 s; a rejected attempt does not reset the refill.
    c.advance(2)
    expect(limiter.take('a').allowed).toBe(true)
    expect(limiter.take('a').allowed).toBe(false)
  })

  it('never refills beyond capacity', () => {
    const c = clock()
    const limiter = new TokenBucketLimiter({ perMinute: 2, now: c.now })
    limiter.take('a')
    c.advance(10 * 60_000)
    expect(limiter.take('a').allowed).toBe(true)
    expect(limiter.take('a').allowed).toBe(true)
    expect(limiter.take('a').allowed).toBe(false)
  })

  it('tracks clients independently', () => {
    const limiter = new TokenBucketLimiter({ perMinute: 1, now: clock().now })
    expect(limiter.take('a').allowed).toBe(true)
    expect(limiter.take('b').allowed).toBe(true)
    expect(limiter.take('a').allowed).toBe(false)
  })

  it('evicts the least recently seen key when maxKeys is exceeded', () => {
    const limiter = new TokenBucketLimiter({ perMinute: 1, maxKeys: 2, now: clock().now })
    limiter.take('a')
    limiter.take('b')
    limiter.take('a') // refreshes "a"; "b" is now the oldest
    limiter.take('c')
    expect(limiter.size).toBe(2)
    expect(limiter.take('b').allowed).toBe(true) // "b" was evicted, so it starts full again
  })

  it('tolerates a clock that goes backwards', () => {
    const c = clock(10_000)
    const limiter = new TokenBucketLimiter({ perMinute: 1, now: c.now })
    limiter.take('a')
    c.advance(-5_000)
    expect(limiter.take('a').allowed).toBe(false)
  })

  it.each([0, -1, 1.5, Number.NaN])('rejects perMinute=%s', (perMinute) => {
    expect(() => new TokenBucketLimiter({ perMinute })).toThrow(RangeError)
  })

  it('defaults to the system clock', () => {
    expect(new TokenBucketLimiter({ perMinute: 1 }).take('x').allowed).toBe(true)
  })
})

describe('clientKey', () => {
  it('prefers x-nf-client-connection-ip', () => {
    const headers = new Headers({
      'x-nf-client-connection-ip': '203.0.113.9',
      'x-forwarded-for': '1.1.1.1',
    })
    expect(clientKey(headers)).toBe('203.0.113.9')
  })

  it('falls back to the first x-forwarded-for entry', () => {
    expect(clientKey(new Headers({ 'x-forwarded-for': ' 198.51.100.7 , 10.0.0.1' }))).toBe(
      '198.51.100.7',
    )
  })

  it('uses a shared key when no client address is available', () => {
    expect(clientKey(new Headers())).toBe('unknown')
    expect(clientKey(new Headers({ 'x-forwarded-for': ' , ' }))).toBe('unknown')
  })
})
