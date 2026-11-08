import { describe, expect, it } from 'vitest'

import { isSameSite, registrableDomain } from '@/lib/scanner/site'

describe('registrableDomain (ADR-020)', () => {
  it('returns the PSL registrable domain', () => {
    expect(registrableDomain('www.example.com')).toBe('example.com')
    expect(registrableDomain('shop.example.co.uk')).toBe('example.co.uk')
  })

  it('treats private-section suffixes as public: each tenant is its own site', () => {
    expect(registrableDomain('a.github.io')).toBe('a.github.io')
    expect(registrableDomain('app.netlify.app')).toBe('app.netlify.app')
  })

  it('returns null for a bare public suffix', () => {
    expect(registrableDomain('co.uk')).toBeNull()
  })
})

describe('isSameSite (ADR-039)', () => {
  it.each([
    ['example.com', 'example.com', true],
    ['example.com', 'www.example.com', true],
    ['a.b.example.com', 'example.com', true],
    ['example.com', 'example.net', false],
    ['example.com', 'example.com.evil.net', false],
    ['a.github.io', 'b.github.io', false],
    ['a.github.io', 'www.a.github.io', true],
    ['co.uk', 'example.co.uk', false],
  ])('%s vs %s → %s', (a, b, expected) => {
    expect(isSameSite(a, b)).toBe(expected)
    expect(isSameSite(b, a)).toBe(expected)
  })

  it('an identical host is the same site even without a registrable domain', () => {
    expect(isSameSite('co.uk', 'co.uk')).toBe(true)
  })
})
