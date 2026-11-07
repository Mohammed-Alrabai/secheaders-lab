import { describe, expect, it } from 'vitest'

import { runChecks } from '@/lib/scanner/checks/index'
import {
  CAP_MAX_GRADE,
  SCORING_VERSION,
  capsFor,
  computeScore,
  meetsAPlusRequirements,
  thresholdGrade,
} from '@/lib/scanner/scoring'
import type { Finding } from '@/lib/scanner/types'

import { PERFECT_HEADERS, makeInput, validTls } from '../../helpers/check-input'

const without = (name: string) => PERFECT_HEADERS.filter(([n]) => n !== name)
const replace = (name: string, value: string): [string, string][] => [
  ...without(name),
  [name, value],
]

describe('worked examples (04 §6)', () => {
  it('Worked example 1 — perfect site → 100, A+', () => {
    const result = computeScore(runChecks(makeInput({ headers: PERFECT_HEADERS })))
    expect(result).toEqual({ score: 100, grade: 'A+', capsApplied: [] })
  })

  it('Worked example 2 — typical WordPress → 62, D (CAP-NO-CSP does not improve it)', () => {
    const findings = runChecks(
      makeInput({
        headers: [
          ['strict-transport-security', 'max-age=31536000'],
          ['x-frame-options', 'SAMEORIGIN'],
          ['x-content-type-options', 'nosniff'],
          // ADR-023: the cookie has Secure; otherwise the spec's 62 would be 57.
          ['set-cookie', 'wp_session=abc; Path=/; Secure'],
          ['server', 'nginx/1.24.0'],
          ['x-powered-by', 'PHP/8.2'],
        ],
      }),
    )
    const deductions = findings.filter((f) => f.deduction > 0).map((f) => [f.id, f.deduction])
    expect(deductions).toEqual([
      ['HDR-CSP', 20],
      ['HDR-REFERRER', 3],
      ['HDR-PERMISSIONS', 3],
      ['CK-HTTPONLY', 3],
      ['CK-SAMESITE', 3],
      ['INF-SERVER', 3],
      ['INF-POWERED-BY', 3],
    ])
    expect(computeScore(findings)).toEqual({ score: 62, grade: 'D', capsApplied: ['CAP-NO-CSP'] })
  })

  it('Worked example 3 — no HTTPS, only port 80 → capped at F', () => {
    const findings = runChecks(
      makeInput({
        finalUrl: 'http://example.com/',
        tls: { available: false, reason: 'CONNECT_FAILED' },
        httpRedirect: { kind: 'response', finalUrl: 'http://example.com/' },
        headers: [['x-content-type-options', 'nosniff']],
      }),
    )
    const result = computeScore(findings)
    expect(findings.find((f) => f.id === 'HDR-HSTS')?.deduction).toBe(20)
    expect(findings.find((f) => f.id === 'TLS-AVAILABLE')?.deduction).toBe(30)
    expect(result.grade).toBe('F')
    expect(result.capsApplied).toEqual(['CAP-NO-HTTPS', 'CAP-NO-CSP'])
  })

  it('Worked example 4 — near-perfect with short HSTS and no Permissions-Policy → 97, A', () => {
    const headers = replace(
      'strict-transport-security',
      'max-age=15552000; includeSubDomains',
    ).filter(([n]) => n !== 'permissions-policy')
    const findings = runChecks(makeInput({ headers }))
    expect(findings.find((f) => f.id === 'HDR-HSTS')).toMatchObject({
      status: 'pass',
      deduction: 0,
    })
    expect(computeScore(findings)).toEqual({ score: 97, grade: 'A', capsApplied: [] })
  })

  it("Worked example 5 — 'unsafe-inline' without nonce → 90, A", () => {
    const headers = replace(
      'content-security-policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    )
    expect(computeScore(runChecks(makeInput({ headers })))).toEqual({
      score: 90,
      grade: 'A',
      capsApplied: [],
    })
  })
})

describe('grade thresholds (04 §2)', () => {
  it.each([
    [100, true, 'A+'],
    [95, true, 'A+'],
    [95, false, 'A'],
    [94, true, 'A'],
    [90, false, 'A'],
    [89, false, 'B'],
    [80, false, 'B'],
    [79, false, 'C'],
    [70, false, 'C'],
    [69, false, 'D'],
    [60, false, 'D'],
    [59, false, 'F'],
    [0, false, 'F'],
  ] as const)('score %i (A+ eligible: %s) → %s', (score, eligible, grade) => {
    expect(thresholdGrade(score, eligible)).toBe(grade)
  })
})

describe('A+ extra requirements (04 §2)', () => {
  const perfect = () => runChecks(makeInput({ headers: PERFECT_HEADERS }))

  it('holds for the perfect site', () => {
    expect(meetsAPlusRequirements(perfect())).toBe(true)
  })

  it('fails with any fail finding even when the score stays ≥ 95', () => {
    const findings = runChecks(makeInput({ headers: without('x-content-type-options') }))
    expect(computeScore(findings)).toMatchObject({ score: 92, grade: 'A' })
    const tiny: Finding[] = perfect().map((f) =>
      f.id === 'CK-PREFIX' ? { ...f, status: 'fail', deduction: 0 } : f,
    )
    expect(meetsAPlusRequirements(tiny)).toBe(false)
    expect(computeScore(tiny).grade).toBe('A')
  })

  it('fails when HSTS max-age < 1 year or HSTS is absent', () => {
    expect(meetsAPlusRequirements(perfect().filter((f) => f.id !== 'HDR-HSTS'))).toBe(false)
  })

  it('fails when HDR-CSP is not pass', () => {
    const findings = perfect().map((f) =>
      f.id === 'HDR-CSP' ? { ...f, status: 'warn' as const } : f,
    )
    expect(meetsAPlusRequirements(findings)).toBe(false)
  })

  it('an HSTS without includeSubDomains but ≥ 1 year still allows A+', () => {
    const findings = runChecks(
      makeInput({ headers: replace('strict-transport-security', 'max-age=31536000') }),
    )
    expect(computeScore(findings)).toMatchObject({ score: 100, grade: 'A+' })
  })

  it('a CSP lacking only base-uri still allows A+ (ADR-022)', () => {
    const headers = replace(
      'content-security-policy',
      "default-src 'self'; script-src 'nonce-x' 'strict-dynamic'; object-src 'none'; frame-ancestors 'none'",
    )
    expect(computeScore(runChecks(makeInput({ headers })))).toMatchObject({
      score: 100,
      grade: 'A+',
    })
  })
})

describe('caps (04 §3)', () => {
  it('CAP-NO-HTTPS → F', () => {
    const findings = runChecks(
      makeInput({ headers: PERFECT_HEADERS, tls: { available: false, reason: 'TIMEOUT' } }),
    )
    expect(computeScore(findings)).toMatchObject({ grade: 'F', capsApplied: ['CAP-NO-HTTPS'] })
  })

  it('CAP-CERT-INVALID → F', () => {
    const tls = { ...validTls(), authorized: false, authorizationError: 'CERT_HAS_EXPIRED' }
    const result = computeScore(runChecks(makeInput({ headers: PERFECT_HEADERS, tls })))
    expect(result).toMatchObject({ score: 70, grade: 'F', capsApplied: ['CAP-CERT-INVALID'] })
  })

  it('CAP-OLD-TLS → at best C', () => {
    const result = computeScore(
      runChecks(makeInput({ headers: PERFECT_HEADERS, tls: validTls(90, 'TLSv1.1') })),
    )
    expect(result).toMatchObject({ score: 85, grade: 'C', capsApplied: ['CAP-OLD-TLS'] })
  })

  it('CAP-NO-HSTS → at best B on an HTTPS site', () => {
    const result = computeScore(
      runChecks(makeInput({ headers: without('strict-transport-security') })),
    )
    expect(result).toMatchObject({ score: 80, grade: 'B', capsApplied: ['CAP-NO-HSTS'] })
  })

  it('CAP-NO-HSTS is not applied to a plain-HTTP final response (04 §3 "on an HTTPS site")', () => {
    const findings = runChecks(
      makeInput({ headers: PERFECT_HEADERS, finalUrl: 'http://example.com/' }),
    )
    expect(capsFor(findings)).not.toContain('CAP-NO-HSTS')
  })

  it('CAP-NO-CSP → at best B, even when only Report-Only is present', () => {
    const headers: [string, string][] = [
      ...without('content-security-policy'),
      ['content-security-policy-report-only', "default-src 'self'"],
    ]
    const result = computeScore(runChecks(makeInput({ headers })))
    expect(result).toMatchObject({ score: 80, grade: 'B', capsApplied: ['CAP-NO-CSP'] })
  })

  it('lists every triggered cap in spec order and applies the lowest', () => {
    const findings = runChecks(
      makeInput({
        headers: [],
        tls: { ...validTls(90, 'TLSv1'), authorized: false, authorizationError: 'X' },
      }),
    )
    const result = computeScore(findings)
    expect(result.capsApplied).toEqual([
      'CAP-CERT-INVALID',
      'CAP-OLD-TLS',
      'CAP-NO-HSTS',
      'CAP-NO-CSP',
    ])
    expect(result.grade).toBe('F')
  })

  it('a cap never improves a worse threshold grade', () => {
    expect(CAP_MAX_GRADE.get('CAP-NO-CSP')).toBe('B')
    const findings = runChecks(makeInput({ headers: [] }))
    expect(computeScore(findings).grade).toBe('F')
  })
})

describe('score arithmetic (04 §1, §5)', () => {
  it('floors at 0 and stays an integer', () => {
    const findings = runChecks(
      makeInput({
        finalUrl: 'http://example.com/',
        tls: { available: false, reason: 'CONNECT_FAILED' },
        httpRedirect: { kind: 'error' },
        headers: [
          ['set-cookie', 'a=1; SameSite=None'],
          ['set-cookie', '__Host-b=2'],
          ['set-cookie', 'c=3'],
          ['server', 'Apache/2.4.1'],
          ['x-powered-by', 'PHP'],
          ['x-aspnet-version', '4'],
          ['referrer-policy', 'unsafe-url'],
        ],
      }),
    )
    const result = computeScore(findings)
    expect(result.score).toBe(0)
    expect(Number.isInteger(result.score)).toBe(true)
  })

  it('ignores deductions on pass/info findings defensively', () => {
    const bogus: Finding[] = [
      {
        id: 'HDR-COOP',
        category: 'headers',
        status: 'info',
        severity: 'info',
        deduction: 50,
        messageKey: 'x',
      },
    ]
    expect(computeScore(bogus).score).toBe(100)
  })

  it('exports SCORING_VERSION = 1', () => {
    expect(SCORING_VERSION).toBe(1)
  })
})
