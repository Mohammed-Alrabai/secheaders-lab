import { describe, expect, it } from 'vitest'

import { checkCookies } from '@/lib/scanner/checks/cookies'
import { checkDisclosure } from '@/lib/scanner/checks/disclosure'
import { runChecks } from '@/lib/scanner/checks/index'
import { checkHttpRedirect, checkTls } from '@/lib/scanner/checks/tls'
import type { TlsInspection } from '@/lib/scanner/tls-inspect'
import { RULE_IDS } from '@/lib/scanner/types'

import { NOW, makeInput, only, validTls } from '../../helpers/check-input'

const tls = (inspection: TlsInspection) => checkTls(makeInput({ tls: inspection }))

describe('TLS-AVAILABLE (04 §4.2)', () => {
  it('TLS-AVAILABLE fail (30, critical) when the handshake fails; other TLS rules not evaluated', () => {
    const findings = tls({ available: false, reason: 'CONNECT_FAILED' })
    expect(only(findings, 'TLS-AVAILABLE')).toMatchObject({
      status: 'fail',
      severity: 'critical',
      deduction: 30,
      params: { reason: 'CONNECT_FAILED' },
    })
    for (const id of ['TLS-CERT-VALID', 'TLS-CERT-EXPIRY', 'TLS-PROTOCOL'] as const) {
      expect(only(findings, id)).toMatchObject({
        status: 'info',
        deduction: 0,
        messageKey: `${id}.notEvaluated`,
      })
    }
  })

  it('TLS-AVAILABLE pass when the handshake succeeds', () => {
    expect(only(tls(validTls()), 'TLS-AVAILABLE').status).toBe('pass')
  })
})

describe('TLS-CERT-VALID (04 §4.2)', () => {
  const invalid = (authorizationError: string, hostnameMatches = true): TlsInspection => ({
    ...validTls(),
    authorized: false,
    authorizationError,
    hostnameMatches,
  })

  it.each([
    ['CERT_HAS_EXPIRED', true, 'expired'],
    ['CERT_NOT_YET_VALID', true, 'notYetValid'],
    ['ERR_TLS_CERT_ALTNAME_INVALID', false, 'hostnameMismatch'],
    ['SELF_SIGNED_CERT_IN_CHAIN', false, 'hostnameMismatch'],
    ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', true, 'untrusted'],
  ])('TLS-CERT-VALID fail (30, critical) for %s', (code, matches, variant) => {
    const findings = tls(invalid(code, matches))
    expect(only(findings, 'TLS-CERT-VALID')).toMatchObject({
      status: 'fail',
      severity: 'critical',
      deduction: 30,
      messageKey: `TLS-CERT-VALID.${variant}`,
    })
    expect(only(findings, 'TLS-CERT-EXPIRY').status).toBe('info')
  })

  it('TLS-CERT-VALID pass for a trusted certificate, with issuer and expiry as evidence', () => {
    expect(only(tls(validTls()), 'TLS-CERT-VALID')).toMatchObject({
      status: 'pass',
      evidence: { detail: expect.stringContaining('Test CA') as unknown },
    })
  })
})

describe('TLS-CERT-EXPIRY (04 §4.2)', () => {
  it.each([
    [1, 'warn', 10, 'soon'],
    [13.9, 'warn', 10, 'soon'],
    [14, 'warn', 5, 'month'],
    [30, 'warn', 5, 'month'],
    [30.5, 'pass', 0, 'ok'],
    [90, 'pass', 0, 'ok'],
  ] as const)('%s days left → %s (%i)', (days, status, deduction, variant) => {
    expect(only(tls(validTls(days)), 'TLS-CERT-EXPIRY')).toMatchObject({
      status,
      deduction,
      messageKey: `TLS-CERT-EXPIRY.${variant}`,
    })
  })

  it('TLS-CERT-EXPIRY severity is high below 14 days, medium for 14–30', () => {
    expect(only(tls(validTls(5)), 'TLS-CERT-EXPIRY').severity).toBe('high')
    expect(only(tls(validTls(20)), 'TLS-CERT-EXPIRY').severity).toBe('medium')
  })

  it('TLS-CERT-EXPIRY is not evaluated without a parsable expiry date', () => {
    expect(only(tls({ ...validTls(), validTo: null }), 'TLS-CERT-EXPIRY').status).toBe('info')
  })

  it('reports remaining days as a whole number', () => {
    expect(only(tls(validTls(20.7)), 'TLS-CERT-EXPIRY').params).toEqual({ days: 20 })
  })

  it('uses the injected clock, not the system clock', () => {
    expect(NOW.toISOString()).toBe('2026-11-07T12:00:00.000Z')
  })
})

describe('TLS-PROTOCOL (04 §4.2)', () => {
  it.each(['TLSv1', 'TLSv1.1', 'SSLv3'])('TLS-PROTOCOL fail (15, high) for %s', (protocol) => {
    expect(only(tls(validTls(90, protocol)), 'TLS-PROTOCOL')).toMatchObject({
      status: 'fail',
      severity: 'high',
      deduction: 15,
      messageKey: 'TLS-PROTOCOL.old',
    })
  })

  it('TLS-PROTOCOL pass for TLS 1.2 and TLS 1.3 (info: modern)', () => {
    expect(only(tls(validTls(90, 'TLSv1.2')), 'TLS-PROTOCOL').messageKey).toBe('TLS-PROTOCOL.tls12')
    expect(only(tls(validTls(90, 'TLSv1.3')), 'TLS-PROTOCOL').messageKey).toBe('TLS-PROTOCOL.tls13')
  })

  it('TLS-PROTOCOL is not evaluated when the protocol is unknown', () => {
    expect(only(tls({ ...validTls(), protocol: null }), 'TLS-PROTOCOL').status).toBe('info')
  })
})

describe('TLS-HTTP-REDIRECT (04 §4.2, ADR-020)', () => {
  const redirect = (
    httpRedirect: Parameters<typeof makeInput>[0] extends infer O
      ? O extends { httpRedirect?: infer R }
        ? R
        : never
      : never,
    inputHostname = 'example.com',
  ) => checkHttpRedirect(makeInput({ httpRedirect, inputHostname }))[0]

  it.each([
    ['https://example.com/', 'example.com'],
    ['https://www.example.com/', 'example.com'],
    ['https://example.com/', 'www.example.com'],
    ['https://shop.example.co.uk/', 'example.co.uk'],
  ])('TLS-HTTP-REDIRECT pass when http:// lands on %s (input %s)', (finalUrl, host) => {
    expect(redirect({ kind: 'response', finalUrl }, host)).toMatchObject({
      status: 'pass',
      messageKey: 'TLS-HTTP-REDIRECT.ok',
    })
  })

  it('TLS-HTTP-REDIRECT fail (10) when http:// does not redirect to https://', () => {
    expect(redirect({ kind: 'response', finalUrl: 'http://example.com/' })).toMatchObject({
      status: 'fail',
      severity: 'medium',
      deduction: 10,
      messageKey: 'TLS-HTTP-REDIRECT.noRedirect',
    })
  })

  it.each([
    ['https://example.org/', 'example.com'],
    ['https://b.github.io/', 'a.github.io'],
  ])(
    'TLS-HTTP-REDIRECT fail (10) for https on another registrable domain: %s',
    (finalUrl, host) => {
      expect(redirect({ kind: 'response', finalUrl }, host)).toMatchObject({
        status: 'fail',
        deduction: 10,
        messageKey: 'TLS-HTTP-REDIRECT.otherSite',
      })
    },
  )

  it('TLS-HTTP-REDIRECT fail (10) when the http fetch errors (blocked hop, loop, too many hops)', () => {
    expect(redirect({ kind: 'error' })).toMatchObject({ status: 'fail', deduction: 10 })
  })

  it('TLS-HTTP-REDIRECT pass (info) when port 80 is unreachable (HTTPS only)', () => {
    expect(redirect({ kind: 'unreachable' })).toMatchObject({
      status: 'pass',
      deduction: 0,
      messageKey: 'TLS-HTTP-REDIRECT.httpUnavailable',
    })
  })
})

const cookies = (headers: string[], finalUrl = 'https://example.com/') =>
  checkCookies(
    makeInput({ finalUrl, headers: headers.map((v) => ['set-cookie', v] as [string, string]) }),
  )

describe('CK-* cookie rules (04 §4.3, ADR-023)', () => {
  it('every CK rule is info "no cookies set" when there are none', () => {
    const findings = cookies([])
    expect(findings.map((f) => [f.id, f.status, f.messageKey])).toEqual([
      ['CK-SECURE', 'info', 'CK-SECURE.noCookies'],
      ['CK-HTTPONLY', 'info', 'CK-HTTPONLY.noCookies'],
      ['CK-SAMESITE', 'info', 'CK-SAMESITE.noCookies'],
      ['CK-PREFIX', 'info', 'CK-PREFIX.noCookies'],
    ])
  })

  it('all CK rules pass for a fully hardened cookie', () => {
    for (const f of cookies(['__Host-id=1; Path=/; Secure; HttpOnly; SameSite=Strict'])) {
      expect([f.id, f.status, f.deduction]).toEqual([f.id, 'pass', 0])
    }
  })

  it('CK-SECURE fail 5 per cookie on HTTPS, capped at 10', () => {
    expect(only(cookies(['a=1; HttpOnly; SameSite=Lax']), 'CK-SECURE')).toMatchObject({
      status: 'fail',
      severity: 'medium',
      deduction: 5,
    })
    expect(only(cookies(['a=1', 'b=2', 'c=3']), 'CK-SECURE')).toMatchObject({
      deduction: 10,
      params: { count: 3, cookies: 'a, b, c' },
      evidence: { header: 'set-cookie', detail: 'a, b, c' },
    })
  })

  it('CK-SECURE is info (not applicable) on a plain HTTP site', () => {
    expect(only(cookies(['a=1'], 'http://example.com/'), 'CK-SECURE')).toMatchObject({
      status: 'info',
      messageKey: 'CK-SECURE.notHttps',
    })
  })

  it('CK-HTTPONLY warn 3 per cookie, capped at 6', () => {
    expect(only(cookies(['a=1; Secure; SameSite=Lax']), 'CK-HTTPONLY')).toMatchObject({
      status: 'warn',
      severity: 'low',
      deduction: 3,
    })
    expect(only(cookies(['a=1', 'b=2', 'c=3']), 'CK-HTTPONLY').deduction).toBe(6)
  })

  it('CK-SAMESITE warn 3 when missing or unrecognised, capped at 6', () => {
    expect(only(cookies(['a=1; Secure; HttpOnly']), 'CK-SAMESITE')).toMatchObject({
      status: 'warn',
      deduction: 3,
    })
    expect(only(cookies(['a=1; Secure; SameSite=Bogus']), 'CK-SAMESITE')).toMatchObject({
      status: 'warn',
      deduction: 3,
    })
    expect(only(cookies(['a=1', 'b=2', 'c=3']), 'CK-SAMESITE').deduction).toBe(6)
  })

  it('CK-SAMESITE fail 5 for SameSite=None without Secure (within the same cap)', () => {
    expect(only(cookies(['a=1; SameSite=None']), 'CK-SAMESITE')).toMatchObject({
      status: 'fail',
      severity: 'medium',
      deduction: 5,
      messageKey: 'CK-SAMESITE.noneWithoutSecure',
    })
    expect(only(cookies(['a=1; SameSite=None', 'b=2']), 'CK-SAMESITE')).toMatchObject({
      status: 'fail',
      deduction: 6,
    })
    expect(only(cookies(['a=1; SameSite=None; Secure']), 'CK-SAMESITE').status).toBe('pass')
  })

  it.each([
    ['__Host-a=1; Secure; Path=/; Domain=example.com', 'Domain set'],
    ['__Host-a=1; Secure; Path=/app', 'Path not /'],
    ['__Host-a=1; Path=/', 'not Secure'],
    ['__Secure-a=1; Path=/', '__Secure- without Secure'],
    ['__host-a=1; Path=/', 'case-insensitive prefix'],
  ])('CK-PREFIX fail 5 (cap 5): %s (%s)', (header) => {
    expect(only(cookies([header, '__Secure-b=2']), 'CK-PREFIX')).toMatchObject({
      status: 'fail',
      deduction: 5,
    })
  })

  it('CK-PREFIX passes for correct prefixes and unprefixed names', () => {
    expect(only(cookies(['__Secure-a=1; Secure', 'plain=1']), 'CK-PREFIX').status).toBe('pass')
  })

  it('evidence lists cookie names only, never values', () => {
    const findings = cookies(['sid=SUPER-SECRET-VALUE', '=orphan'])
    expect(JSON.stringify(findings)).not.toContain('SUPER-SECRET-VALUE')
    expect(only(findings, 'CK-HTTPONLY').params).toEqual({ count: 2, cookies: 'sid, (unnamed)' })
  })
})

describe('INF-* disclosure (04 §4.4)', () => {
  const disclosure = (headers: [string, string][]) => checkDisclosure(makeInput({ headers }))

  it.each(['nginx/1.24.0', 'Apache/2.4.58 (Ubuntu)', 'Microsoft-IIS/10.0'])(
    'INF-SERVER warn (3) for %s',
    (value) => {
      expect(only(disclosure([['server', value]]), 'INF-SERVER')).toMatchObject({
        status: 'warn',
        severity: 'low',
        deduction: 3,
        messageKey: 'INF-SERVER.version',
        evidence: { header: 'server', value },
      })
    },
  )

  it.each(['nginx', 'cloudflare', 'Server 2'])(
    'INF-SERVER info (0) without a dotted version: %s',
    (value) => {
      expect(only(disclosure([['server', value]]), 'INF-SERVER')).toMatchObject({
        status: 'info',
        deduction: 0,
      })
    },
  )

  it('INF-SERVER pass when absent', () => {
    expect(only(disclosure([]), 'INF-SERVER').status).toBe('pass')
  })

  it('INF-POWERED-BY warn (3) when present, pass when absent', () => {
    expect(only(disclosure([['x-powered-by', 'PHP/8.2']]), 'INF-POWERED-BY')).toMatchObject({
      status: 'warn',
      deduction: 3,
    })
    expect(only(disclosure([]), 'INF-POWERED-BY').status).toBe('pass')
  })

  it.each(['x-aspnet-version', 'x-aspnetmvc-version'])('INF-ASPNET warn (3) for %s', (header) => {
    expect(only(disclosure([[header, '4.0.30319']]), 'INF-ASPNET')).toMatchObject({
      status: 'warn',
      deduction: 3,
      evidence: { header, value: '4.0.30319' },
    })
  })

  it('INF-ASPNET pass when absent', () => {
    expect(only(disclosure([]), 'INF-ASPNET').status).toBe('pass')
  })
})

describe('runChecks', () => {
  it('emits exactly one finding per rule (HDR-DUPLICATE only when needed)', () => {
    const ids = runChecks(makeInput()).map((f) => f.id)
    expect(ids).toEqual(RULE_IDS.filter((id) => id !== 'HDR-DUPLICATE'))
  })

  it('pass and info findings never deduct (04 §1)', () => {
    for (const f of runChecks(
      makeInput({
        headers: [
          ['server', 'nginx'],
          ['x-xss-protection', '1'],
        ],
      }),
    )) {
      if (f.status === 'pass' || f.status === 'info') expect(f.deduction, f.id).toBe(0)
    }
  })
})
