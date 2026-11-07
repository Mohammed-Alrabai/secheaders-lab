import { describe, expect, it } from 'vitest'

import {
  HeaderMap,
  hasKeyword,
  hasNonceOrHash,
  parseCsp,
  parseFrameOptions,
  parseHsts,
  parseReferrerPolicy,
  parseSetCookie,
  redactSetCookie,
  scriptSources,
  truncate,
} from '@/lib/scanner/header-utils'

describe('HeaderMap (04 §1)', () => {
  const map = new HeaderMap([
    ['Server', 'nginx'],
    ['x-frame-options', 'DENY'],
    ['X-Frame-Options', 'SAMEORIGIN'],
    ['set-cookie', 'a=1'],
    ['set-cookie', 'b=2'],
    ['content-security-policy', "default-src 'self'"],
    ['content-security-policy', "object-src 'none'"],
  ])

  it('is case-insensitive and returns the first occurrence', () => {
    expect(map.get('SERVER')).toBe('nginx')
    expect(map.get('x-frame-options')).toBe('DENY')
    expect(map.has('x-frame-OPTIONS')).toBe(true)
    expect(map.get('missing')).toBeUndefined()
    expect(map.has('missing')).toBe(false)
  })

  it('returns every value in order', () => {
    expect(map.getAll('Set-Cookie')).toEqual(['a=1', 'b=2'])
    expect(map.getAll('nope')).toEqual([])
  })

  it('lists duplicated headers except legitimately repeated ones', () => {
    expect(map.duplicates()).toEqual(['x-frame-options'])
  })

  it('exports lowercase pairs', () => {
    expect(map.toArray()[0]).toEqual(['server', 'nginx'])
  })
})

describe('parseHsts', () => {
  it.each([
    [
      'max-age=31536000; includeSubDomains; preload',
      { maxAge: 31536000, includeSubDomains: true, preload: true },
    ],
    ['MAX-AGE="600"', { maxAge: 600, includeSubDomains: false, preload: false }],
    ['  max-age = 0 ; INCLUDESUBDOMAINS', { maxAge: 0, includeSubDomains: true, preload: false }],
    ['includeSubDomains', { maxAge: null, includeSubDomains: true, preload: false }],
    ['max-age=abc', { maxAge: null, includeSubDomains: false, preload: false }],
    ['max-age=-1', { maxAge: null, includeSubDomains: false, preload: false }],
    ['max-age=1; max-age=2', { maxAge: null, includeSubDomains: false, preload: false }],
    ['', { maxAge: null, includeSubDomains: false, preload: false }],
  ])('%j', (value, expected) => {
    expect(parseHsts(value)).toEqual(expected)
  })
})

describe('parseCsp', () => {
  it('splits directives, lowercases names and keeps the first duplicate', () => {
    const [policy] = parseCsp(
      "Default-Src 'self';  script-src 'nonce-abc' 'strict-dynamic'; script-src *;;",
    )
    expect(policy?.get('default-src')).toEqual(["'self'"])
    expect(policy?.get('script-src')).toEqual(["'nonce-abc'", "'strict-dynamic'"])
  })

  it('treats commas as separate policies (CSP3)', () => {
    const policies = parseCsp("script-src 'self', object-src 'none'")
    expect(policies).toHaveLength(2)
    expect(policies[1]?.get('object-src')).toEqual(["'none'"])
  })

  it('drops empty policies', () => {
    expect(parseCsp(' ; , ')).toEqual([])
  })

  it('keeps directives with no sources', () => {
    expect(parseCsp('upgrade-insecure-requests')[0]?.get('upgrade-insecure-requests')).toEqual([])
  })

  it('resolves script sources with default-src fallback', () => {
    const [withScript, withDefault, neither] = [
      ...parseCsp("script-src 'self'; default-src *"),
      ...parseCsp('default-src https:'),
      ...parseCsp("img-src 'self'"),
    ]
    expect(withScript && scriptSources(withScript)).toEqual(["'self'"])
    expect(withDefault && scriptSources(withDefault)).toEqual(['https:'])
    expect(neither && scriptSources(neither)).toBeUndefined()
  })

  it('detects nonces, hashes and keywords case-insensitively', () => {
    expect(hasNonceOrHash(["'NONCE-x'"])).toBe(true)
    expect(hasNonceOrHash(["'sha384-abc'"])).toBe(true)
    expect(hasNonceOrHash(["'self'", 'nonce-x'])).toBe(false)
    expect(hasKeyword(["'Unsafe-Inline'"], "'unsafe-inline'")).toBe(true)
    expect(hasKeyword(["'self'"], "'unsafe-inline'")).toBe(false)
  })
})

describe('parseSetCookie (values are discarded)', () => {
  it('parses name and attributes', () => {
    expect(parseSetCookie('__Host-sid=SECRET; Path=/; Secure; HttpOnly; SameSite=Lax')).toEqual({
      name: '__Host-sid',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      domain: undefined,
    })
  })

  it('handles case, spacing, domain and missing attributes', () => {
    const cookie = parseSetCookie(' id = x ;secure; DOMAIN=example.com; samesite=None')
    expect(cookie).toMatchObject({
      name: 'id',
      secure: true,
      httpOnly: false,
      sameSite: 'none',
      domain: 'example.com',
    })
  })

  it('returns an empty name for a value-only cookie', () => {
    expect(parseSetCookie('justavalue').name).toBe('')
  })

  it('never exposes the value', () => {
    expect(JSON.stringify(parseSetCookie('sid=TOP-SECRET; Secure'))).not.toContain('TOP-SECRET')
  })

  it.each([
    ['sid=TOP-SECRET; Secure; HttpOnly', 'sid=[redacted]; Secure; HttpOnly'],
    ['sid=TOP-SECRET', 'sid=[redacted]'],
    ['novalue', '=[redacted]'],
  ])('redactSetCookie(%j)', (input, expected) => {
    expect(redactSetCookie(input)).toBe(expected)
  })
})

describe('parseReferrerPolicy', () => {
  it.each([
    ['strict-origin-when-cross-origin', 'strict-origin-when-cross-origin'],
    ['NO-REFERRER', 'no-referrer'],
    ['no-referrer, bogus', 'no-referrer'],
    ['unsafe-url, strict-origin', 'strict-origin'],
    ['bogus', undefined],
    ['', undefined],
  ])('%j → %j', (value, expected) => {
    expect(parseReferrerPolicy(value)).toBe(expected)
  })
})

describe('parseFrameOptions', () => {
  it.each([
    ['DENY', 'DENY'],
    ['sameorigin', 'SAMEORIGIN'],
    [' SameOrigin , DENY', 'SAMEORIGIN'],
    ['ALLOW-FROM https://example.com', 'ALLOW-FROM'],
    ['allowall', 'INVALID'],
    ['', 'INVALID'],
  ])('%j → %s', (value, expected) => {
    expect(parseFrameOptions(value)).toBe(expected)
  })
})

describe('truncate', () => {
  it('keeps short values', () => {
    expect(truncate('abc', 5)).toBe('abc')
  })

  it('cuts long values', () => {
    expect(truncate('abcdef', 3)).toBe('abc')
  })

  it('never splits a surrogate pair', () => {
    expect(truncate('ab😀c', 3)).toBe('ab')
  })
})
