import { describe, expect, it } from 'vitest'

import { EnvError, getEnv, parseEnv } from '@/lib/env'

describe('parseEnv', () => {
  it('applies defaults outside production', () => {
    expect(parseEnv({ NODE_ENV: 'development' })).toEqual({
      nodeEnv: 'development',
      siteUrl: 'http://localhost:3000',
      scanTotalBudgetMs: 8000,
      scanRateLimitPerMin: 10,
    })
  })

  it('defaults NODE_ENV to development', () => {
    expect(parseEnv({}).nodeEnv).toBe('development')
  })

  it('parses explicit values and normalizes the site URL to its origin', () => {
    const env = parseEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_SITE_URL: 'https://secheaders.example.org/some/path?q=1',
      SCAN_TOTAL_BUDGET_MS: '6000',
      SCAN_RATE_LIMIT_PER_MIN: '5',
    })
    expect(env).toEqual({
      nodeEnv: 'production',
      siteUrl: 'https://secheaders.example.org',
      scanTotalBudgetMs: 6000,
      scanRateLimitPerMin: 5,
    })
  })

  it('requires NEXT_PUBLIC_SITE_URL in production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(/NEXT_PUBLIC_SITE_URL: required/)
  })

  it.each(['not a url', 'ftp://example.com', 'javascript:alert(1)'])(
    'rejects non-http(s) site URL %s',
    (value) => {
      expect(() => parseEnv({ NEXT_PUBLIC_SITE_URL: value })).toThrow(EnvError)
    },
  )

  it.each(['999', '20001', '1.5', 'abc'])('rejects SCAN_TOTAL_BUDGET_MS=%s', (value) => {
    expect(() => parseEnv({ SCAN_TOTAL_BUDGET_MS: value })).toThrow(/SCAN_TOTAL_BUDGET_MS/)
  })

  it.each(['0', '101'])('rejects SCAN_RATE_LIMIT_PER_MIN=%s', (value) => {
    expect(() => parseEnv({ SCAN_RATE_LIMIT_PER_MIN: value })).toThrow(/SCAN_RATE_LIMIT_PER_MIN/)
  })

  it('rejects an unknown NODE_ENV', () => {
    expect(() => parseEnv({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/)
  })

  it('never echoes the offending value in the error message', () => {
    let message = ''
    try {
      parseEnv({ NEXT_PUBLIC_SITE_URL: 'secret-token-value' })
    } catch (error) {
      message = error instanceof Error ? error.message : ''
    }
    expect(message).toMatch(/NEXT_PUBLIC_SITE_URL/)
    expect(message).not.toContain('secret-token-value')
  })
})

describe('getEnv', () => {
  it('parses process.env once and caches the result', () => {
    const first = getEnv()
    expect(getEnv()).toBe(first)
    expect(first.nodeEnv).toBe('test')
  })
})
