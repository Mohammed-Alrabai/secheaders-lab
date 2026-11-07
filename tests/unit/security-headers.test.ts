import { describe, expect, it } from 'vitest'

import nextConfig from '../../next.config'
import { runChecks } from '@/lib/scanner/checks/index'
import { computeScore } from '@/lib/scanner/scoring'
import {
  LOCKED_DOWN_CSP,
  SECURITY_HEADERS,
  SVG_CSP,
  buildPageCsp,
  generateNonce,
} from '@/lib/security-headers'

import { makeInput } from '../helpers/check-input'

function header(name: string): string | undefined {
  return SECURITY_HEADERS.find((h) => h.key.toLowerCase() === name.toLowerCase())?.value
}

describe('own security headers (03 §6)', () => {
  it('has no duplicate header names', () => {
    const names = SECURITY_HEADERS.map((h) => h.key.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })

  it.each([
    ['strict-transport-security', 'max-age=63072000; includeSubDomains; preload'],
    ['x-content-type-options', 'nosniff'],
    ['x-frame-options', 'DENY'],
    ['referrer-policy', 'strict-origin-when-cross-origin'],
    ['cross-origin-opener-policy', 'same-origin'],
    ['cross-origin-resource-policy', 'same-origin'],
  ])('%s is %s', (name, value) => {
    expect(header(name)).toBe(value)
  })

  it('ADR-029: Permissions-Policy no longer carries the obsolete interest-cohort', () => {
    expect(header('permissions-policy')).toBe(
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    )
  })

  it('the static set contains no CSP (pages get a per-request nonce CSP from proxy.ts)', () => {
    expect(header('content-security-policy')).toBeUndefined()
  })
})

describe('page CSP (03 §6, ADR-009)', () => {
  it('matches the specified policy exactly in production', () => {
    expect(buildPageCsp('abc123', { dev: false })).toBe(
      "default-src 'self'; script-src 'self' 'nonce-abc123' 'strict-dynamic'; style-src 'self' 'nonce-abc123'; style-src-elem 'self' 'nonce-abc123'; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
    )
  })

  it("adds 'unsafe-eval' to script-src in development only", () => {
    expect(buildPageCsp('n', { dev: true })).toContain("'strict-dynamic' 'unsafe-eval';")
    expect(buildPageCsp('n', { dev: false })).not.toContain('unsafe-eval')
  })

  it("never allows 'unsafe-inline' for scripts or style elements", () => {
    const csp = buildPageCsp('n', { dev: false })
    for (const directive of csp.split(';').map((d) => d.trim())) {
      if (
        directive.startsWith('script-src') ||
        directive.startsWith('style-src ') ||
        directive.startsWith('style-src-elem')
      ) {
        expect(directive).not.toContain('unsafe-inline')
      }
    }
  })

  it('generates a fresh 128-bit base64 nonce each time', () => {
    const nonces = new Set(Array.from({ length: 50 }, generateNonce))
    expect(nonces.size).toBe(50)
    for (const n of nonces) expect(n).toMatch(/^[A-Za-z0-9+/]{22}==$/)
  })
})

describe('next.config', () => {
  it('disables X-Powered-By and applies headers to pages, the API and brand files', async () => {
    expect(nextConfig.poweredByHeader).toBe(false)
    expect(await nextConfig.headers?.()).toEqual([
      { source: '/:path*', headers: [...SECURITY_HEADERS] },
      {
        source: '/api/:path*',
        headers: [{ key: 'Content-Security-Policy', value: LOCKED_DOWN_CSP }],
      },
      { source: '/brand/:path*', headers: [{ key: 'Content-Security-Policy', value: SVG_CSP }] },
    ])
  })
})

describe('task 5.4: our own header set grades A+ (PRD G4, NFR-02)', () => {
  it('scores 100 / A+ with no caps when served over valid HTTPS', () => {
    const headers: [string, string][] = [
      ...SECURITY_HEADERS.map(({ key, value }): [string, string] => [key, value]),
      ['content-security-policy', buildPageCsp(generateNonce(), { dev: false })],
    ]
    const findings = runChecks(makeInput({ headers }))
    expect(findings.filter((f) => f.status === 'fail' || f.status === 'warn')).toEqual([])
    expect(computeScore(findings)).toEqual({ score: 100, grade: 'A+', capsApplied: [] })
  })
})
