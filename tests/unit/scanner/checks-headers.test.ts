import { describe, expect, it } from 'vitest'

import { checkCsp } from '@/lib/scanner/checks/csp'
import { EVIDENCE_MAX } from '@/lib/scanner/checks/finding'
import {
  checkCoop,
  checkDuplicates,
  checkFrame,
  checkPermissions,
  checkReferrer,
  checkXcto,
  checkXxss,
} from '@/lib/scanner/checks/headers'
import { checkHsts } from '@/lib/scanner/checks/hsts'

import { makeInput } from '../../helpers/check-input'

const hsts = (value?: string, finalUrl?: string) =>
  checkHsts(
    makeInput({
      headers: value === undefined ? [] : [['strict-transport-security', value]],
      ...(finalUrl ? { finalUrl } : {}),
    }),
  )[0]

describe('HDR-HSTS (04 §4.1)', () => {
  it('HDR-HSTS fail (20) when missing', () => {
    expect(hsts()).toMatchObject({
      status: 'fail',
      severity: 'high',
      deduction: 20,
      messageKey: 'HDR-HSTS.missing',
    })
  })

  it('HDR-HSTS fail (20) when the final response is not HTTPS (04 §1)', () => {
    expect(hsts('max-age=63072000', 'http://example.com/')).toMatchObject({
      status: 'fail',
      deduction: 20,
      messageKey: 'HDR-HSTS.notHttps',
    })
  })

  it.each(['includeSubDomains', 'max-age=abc', 'max-age=0', 'max-age=1; max-age=2'])(
    'HDR-HSTS fail (20) when max-age is missing/unparsable/0: %j',
    (value) => {
      expect(hsts(value)).toMatchObject({
        status: 'fail',
        deduction: 20,
        messageKey: 'HDR-HSTS.invalidMaxAge',
      })
    },
  )

  it('HDR-HSTS warn (8) when max-age < 180 days', () => {
    expect(hsts('max-age=15551999; includeSubDomains')).toMatchObject({
      status: 'warn',
      severity: 'medium',
      deduction: 8,
      messageKey: 'HDR-HSTS.short',
      params: { maxAge: 15551999, days: 179 },
    })
  })

  it('HDR-HSTS pass + info note when ≥ 180 days without includeSubDomains', () => {
    expect(hsts('max-age=31536000')).toMatchObject({
      status: 'pass',
      severity: 'info',
      deduction: 0,
      messageKey: 'HDR-HSTS.noSubdomains',
    })
  })

  it('HDR-HSTS pass when 180 days – 1 year with includeSubDomains (ADR-022)', () => {
    expect(hsts('max-age=15552000; includeSubDomains')).toMatchObject({
      status: 'pass',
      deduction: 0,
      messageKey: 'HDR-HSTS.belowOneYear',
      params: { maxAge: 15552000 },
    })
  })

  it('HDR-HSTS pass when ≥ 1 year with includeSubDomains (+ optional preload)', () => {
    expect(hsts('max-age=31536000; includeSubDomains')).toMatchObject({
      status: 'pass',
      messageKey: 'HDR-HSTS.ok',
    })
    expect(hsts('max-age=63072000; includeSubDomains; preload')).toMatchObject({
      status: 'pass',
      messageKey: 'HDR-HSTS.ok',
      evidence: {
        header: 'strict-transport-security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
    })
  })
})

const csp = (...values: string[]) =>
  checkCsp(
    makeInput({ headers: values.map((v) => ['content-security-policy', v] as [string, string]) }),
  )[0]

const noteKeys = (f: ReturnType<typeof csp>) => (f?.notes ?? []).map((n) => n.messageKey)

describe('HDR-CSP (04 §4.1, ADR-021, ADR-022)', () => {
  it('HDR-CSP fail (20) when missing', () => {
    expect(csp()).toMatchObject({
      status: 'fail',
      severity: 'high',
      deduction: 20,
      messageKey: 'HDR-CSP.missing',
    })
    expect(csp()?.notes).toBeUndefined()
  })

  it('HDR-CSP fail (20) when only Report-Only is present, with an info note', () => {
    const f = checkCsp(
      makeInput({ headers: [['content-security-policy-report-only', "default-src 'self'"]] }),
    )[0]
    expect(f).toMatchObject({ status: 'fail', deduction: 20, messageKey: 'HDR-CSP.missing' })
    expect(noteKeys(f)).toEqual(['HDR-CSP.reportOnlyIgnored'])
  })

  it('HDR-CSP warn (10) with no default-src and no script-src', () => {
    const f = csp("object-src 'none'; base-uri 'none'")
    expect(f).toMatchObject({
      status: 'warn',
      severity: 'medium',
      deduction: 10,
      messageKey: 'HDR-CSP.weak',
    })
    expect(noteKeys(f)).toEqual(['HDR-CSP.noScriptControl'])
  })

  it("HDR-CSP warn (10) for 'unsafe-inline' without nonce/hash", () => {
    const f = csp("script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'")
    expect(f).toMatchObject({ status: 'warn', deduction: 10 })
    expect(noteKeys(f)).toEqual(['HDR-CSP.unsafeInline'])
  })

  it("HDR-CSP no deduction for 'unsafe-inline' when a nonce or hash is present", () => {
    expect(
      csp("script-src 'nonce-abc' 'unsafe-inline'; object-src 'none'; base-uri 'none'"),
    ).toMatchObject({
      status: 'pass',
      messageKey: 'HDR-CSP.ok',
    })
    expect(
      csp("script-src 'sha256-abc=' 'unsafe-inline'; object-src 'none'; base-uri 'none'"),
    ).toMatchObject({
      status: 'pass',
    })
  })

  it("HDR-CSP warn (5) for 'unsafe-eval'", () => {
    const f = csp("script-src 'self' 'unsafe-eval'; object-src 'none'; base-uri 'none'")
    expect(f).toMatchObject({ status: 'warn', deduction: 5 })
    expect(noteKeys(f)).toEqual(['HDR-CSP.unsafeEval'])
  })

  it.each(['*', 'http:', 'https:', 'data:', 'HTTPS:'])(
    'HDR-CSP warn (5) for broad source %s',
    (source) => {
      const f = csp(`script-src 'self' ${source}; object-src 'none'; base-uri 'none'`)
      expect(f).toMatchObject({ status: 'warn', deduction: 5 })
      expect(noteKeys(f)).toEqual(['HDR-CSP.broadSource'])
    },
  )

  it('HDR-CSP uses default-src as the script fallback', () => {
    const f = csp("default-src * 'unsafe-inline'; object-src 'none'; base-uri 'none'")
    expect(noteKeys(f)).toEqual(['HDR-CSP.unsafeInline', 'HDR-CSP.broadSource'])
    expect(f?.deduction).toBe(15)
  })

  it("HDR-CSP ignores broad sources under 'strict-dynamic' with a nonce (ADR-021)", () => {
    expect(
      csp(
        "script-src 'nonce-abc' 'strict-dynamic' https: 'unsafe-inline'; object-src 'none'; base-uri 'none'",
      ),
    ).toMatchObject({ status: 'pass', deduction: 0 })
  })

  it("HDR-CSP still deducts broad sources for 'strict-dynamic' without nonce/hash", () => {
    const f = csp("script-src 'strict-dynamic' https:; object-src 'none'; base-uri 'none'")
    expect(noteKeys(f)).toEqual(['HDR-CSP.broadSource'])
  })

  it("HDR-CSP warn (3, low) when object-src is not 'none'", () => {
    const f = csp("script-src 'self'; base-uri 'none'")
    expect(f).toMatchObject({ status: 'warn', severity: 'low', deduction: 3 })
    expect(noteKeys(f)).toEqual(['HDR-CSP.objectSrc'])
    expect(
      csp("script-src 'self'; object-src 'self'; default-src 'none'; base-uri 'none'")?.deduction,
    ).toBe(3)
  })

  it("HDR-CSP accepts default-src 'none' as the object-src fallback", () => {
    expect(csp("default-src 'none'; script-src 'self'; base-uri 'none'")).toMatchObject({
      status: 'pass',
    })
  })

  it('HDR-CSP pass with an info note when only base-uri is missing (ADR-022)', () => {
    const f = csp("script-src 'self'; object-src 'none'")
    expect(f).toMatchObject({ status: 'pass', deduction: 0, messageKey: 'HDR-CSP.ok' })
    expect(noteKeys(f)).toEqual(['HDR-CSP.noBaseUri'])
  })

  it('HDR-CSP pass when everything is clean', () => {
    const f = csp("default-src 'self'; object-src 'none'; base-uri 'none'")
    expect(f).toMatchObject({ status: 'pass', severity: 'info', deduction: 0 })
    expect(f?.notes).toBeUndefined()
  })

  it('HDR-CSP sub-deductions are cumulative and capped at 20', () => {
    const f = csp("script-src * 'unsafe-inline' 'unsafe-eval'")
    expect(noteKeys(f)).toEqual([
      'HDR-CSP.unsafeInline',
      'HDR-CSP.unsafeEval',
      'HDR-CSP.broadSource',
      'HDR-CSP.objectSrc',
      'HDR-CSP.noBaseUri',
    ])
    expect(f?.deduction).toBe(20)
  })

  it('HDR-CSP with several policies counts a weakness only if every policy has it (ADR-021)', () => {
    const f = csp(
      "script-src 'self' 'unsafe-inline'",
      "script-src 'self'; object-src 'none'; base-uri 'none'",
    )
    expect(f).toMatchObject({ status: 'pass' })
    const both = csp("script-src 'unsafe-eval'", "default-src 'unsafe-eval'; object-src 'none'")
    expect(noteKeys(both)).toEqual(['HDR-CSP.unsafeEval', 'HDR-CSP.noBaseUri'])
  })

  it('HDR-CSP treats comma-separated policies in one header like separate headers', () => {
    expect(
      csp("script-src 'unsafe-inline', script-src 'self'; object-src 'none'; base-uri 'none'"),
    ).toMatchObject({
      status: 'pass',
    })
  })

  it('HDR-CSP shows every policy as evidence', () => {
    expect(csp('a', 'b')?.evidence).toEqual({ header: 'content-security-policy', value: 'a\nb' })
  })

  it('evidence values are truncated to 512 characters (02 §4)', () => {
    const long = `script-src 'self' ${'x'.repeat(1000)}`
    expect(csp(long)?.evidence?.value).toHaveLength(EVIDENCE_MAX)
  })
})

const frame = (headers: [string, string][]) => checkFrame(makeInput({ headers }))[0]

describe('HDR-FRAME (04 §4.1)', () => {
  it('HDR-FRAME fail (10) when neither XFO nor frame-ancestors is present', () => {
    expect(frame([])).toMatchObject({
      status: 'fail',
      severity: 'medium',
      deduction: 10,
      messageKey: 'HDR-FRAME.missing',
    })
  })

  it('HDR-FRAME fail (10) for an invalid XFO value', () => {
    expect(frame([['x-frame-options', 'ALLOWALL']])).toMatchObject({
      status: 'fail',
      deduction: 10,
    })
  })

  it('HDR-FRAME warn (8) for obsolete ALLOW-FROM without frame-ancestors', () => {
    expect(frame([['x-frame-options', 'ALLOW-FROM https://example.com']])).toMatchObject({
      status: 'warn',
      deduction: 8,
      messageKey: 'HDR-FRAME.allowFrom',
    })
  })

  it.each([
    [[['x-frame-options', 'DENY']]],
    [[['x-frame-options', 'sameorigin']]],
    [[['content-security-policy', "frame-ancestors 'none'"]]],
    [
      [
        ['x-frame-options', 'ALLOW-FROM https://x.example'],
        ['content-security-policy', "frame-ancestors 'self'"],
      ],
    ],
  ] as [string, string][][][])('HDR-FRAME pass for %j', (headers) => {
    expect(frame(headers)).toMatchObject({ status: 'pass', deduction: 0 })
  })

  it('HDR-FRAME does not count frame-ancestors * or Report-Only', () => {
    expect(frame([['content-security-policy', 'frame-ancestors *']])?.status).toBe('fail')
    expect(frame([['content-security-policy-report-only', "frame-ancestors 'none'"]])?.status).toBe(
      'fail',
    )
  })
})

describe('HDR-XCTO (04 §4.1)', () => {
  it('HDR-XCTO fail (8) when missing', () => {
    expect(checkXcto(makeInput())[0]).toMatchObject({
      status: 'fail',
      deduction: 8,
      messageKey: 'HDR-XCTO.missing',
    })
  })

  it('HDR-XCTO fail (8) when the value is not nosniff', () => {
    expect(
      checkXcto(makeInput({ headers: [['x-content-type-options', 'sniff']] }))[0],
    ).toMatchObject({
      status: 'fail',
      messageKey: 'HDR-XCTO.invalid',
    })
  })

  it('HDR-XCTO pass for nosniff (case-insensitive)', () => {
    expect(
      checkXcto(makeInput({ headers: [['x-content-type-options', ' NoSniff ']] }))[0]?.status,
    ).toBe('pass')
  })
})

const referrer = (value?: string) =>
  checkReferrer(makeInput({ headers: value === undefined ? [] : [['referrer-policy', value]] }))[0]

describe('HDR-REFERRER (04 §4.1)', () => {
  it('HDR-REFERRER warn (3, low) when missing', () => {
    expect(referrer()).toMatchObject({
      status: 'warn',
      severity: 'low',
      deduction: 3,
      messageKey: 'HDR-REFERRER.missing',
    })
  })

  it('HDR-REFERRER warn (3) when no token is valid (browser default applies)', () => {
    expect(referrer('bogus')).toMatchObject({
      status: 'warn',
      deduction: 3,
      messageKey: 'HDR-REFERRER.invalid',
    })
  })

  it.each(['unsafe-url', 'no-referrer-when-downgrade', 'no-referrer, unsafe-url'])(
    'HDR-REFERRER warn (5, medium) for %s',
    (value) => {
      expect(referrer(value)).toMatchObject({
        status: 'warn',
        severity: 'medium',
        deduction: 5,
        messageKey: 'HDR-REFERRER.leaky',
      })
    },
  )

  it.each([
    'no-referrer',
    'same-origin',
    'strict-origin',
    'strict-origin-when-cross-origin',
    'origin',
  ])('HDR-REFERRER pass for %s', (value) => {
    expect(referrer(value)).toMatchObject({
      status: 'pass',
      deduction: 0,
      params: { policy: value },
    })
  })
})

describe('HDR-PERMISSIONS, HDR-COOP, HDR-XXSS (04 §4.1)', () => {
  it('HDR-PERMISSIONS warn (3) when missing, pass when present', () => {
    expect(checkPermissions(makeInput())[0]).toMatchObject({
      status: 'warn',
      severity: 'low',
      deduction: 3,
    })
    expect(
      checkPermissions(makeInput({ headers: [['permissions-policy', 'camera=()']] }))[0]?.status,
    ).toBe('pass')
  })

  it('HDR-COOP info (0) when missing, pass when present', () => {
    expect(checkCoop(makeInput())[0]).toMatchObject({
      status: 'info',
      deduction: 0,
      messageKey: 'HDR-COOP.missing',
    })
    expect(
      checkCoop(makeInput({ headers: [['cross-origin-opener-policy', 'same-origin']] }))[0]?.status,
    ).toBe('pass')
  })

  it.each(['1', '1; mode=block'])('HDR-XXSS info (0) when enabled: %j', (value) => {
    expect(checkXxss(makeInput({ headers: [['x-xss-protection', value]] }))[0]).toMatchObject({
      status: 'info',
      deduction: 0,
      messageKey: 'HDR-XXSS.enabled',
    })
  })

  it('HDR-XXSS pass when absent or disabled', () => {
    expect(checkXxss(makeInput())[0]?.messageKey).toBe('HDR-XXSS.absent')
    expect(checkXxss(makeInput({ headers: [['x-xss-protection', '0']] }))[0]?.messageKey).toBe(
      'HDR-XXSS.disabled',
    )
  })
})

describe('HDR-DUPLICATE (04 §1)', () => {
  it('emits an info finding listing duplicated headers', () => {
    const findings = checkDuplicates(
      makeInput({
        headers: [
          ['x-frame-options', 'DENY'],
          ['X-Frame-Options', 'SAMEORIGIN'],
          ['set-cookie', 'a=1'],
          ['set-cookie', 'b=2'],
        ],
      }),
    )
    expect(findings).toEqual([
      expect.objectContaining({
        id: 'HDR-DUPLICATE',
        status: 'info',
        deduction: 0,
        params: { headers: 'x-frame-options' },
      }),
    ])
  })

  it('evaluates the first occurrence of a duplicated header', () => {
    const f = frame([
      ['x-frame-options', 'ALLOWALL'],
      ['x-frame-options', 'DENY'],
    ])
    expect(f?.status).toBe('fail')
  })

  it('emits nothing when no header repeats', () => {
    expect(checkDuplicates(makeInput())).toEqual([])
  })
})
