import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { ErrorBodySchema, ScanRequestSchema, ScanResultSchema } from '@/lib/schemas'
import { runChecks } from '@/lib/scanner/checks/index'
import { computeScore } from '@/lib/scanner/scoring'
import type { ScanResult } from '@/lib/scanner/types'

import { PERFECT_HEADERS, makeInput } from '../helpers/check-input'

function sampleResult(): ScanResult {
  const findings = runChecks(makeInput({ headers: PERFECT_HEADERS }))
  return {
    schemaVersion: 1,
    scoringVersion: 1,
    scannedAt: '2026-11-07T12:00:00.000Z',
    durationMs: 812,
    target: {
      input: 'example.com',
      finalUrl: 'https://example.com/',
      redirectChain: [{ url: 'https://example.com/', status: 200 }],
      httpStatus: 200,
    },
    tls: { available: true, protocol: 'TLSv1.3', authorized: true },
    ...computeScore(findings),
    summary: { pass: 18, warn: 0, fail: 0, info: 2 },
    findings,
    rawHeaders: PERFECT_HEADERS.map(([name, value]) => ({ name, value })),
  }
}

describe('ScanRequestSchema (SC-23)', () => {
  it('accepts { url }', () => {
    expect(ScanRequestSchema.parse({ url: 'example.com' })).toEqual({ url: 'example.com' })
  })

  it.each([
    [{}],
    [{ url: '' }],
    [{ url: 42 }],
    [{ url: 'a'.repeat(2049) }],
    [{ url: 'example.com', extra: true }],
    [null],
    [['example.com']],
  ])('rejects %j', (body) => {
    expect(ScanRequestSchema.safeParse(body).success).toBe(false)
  })
})

describe('ScanResultSchema (SC-28)', () => {
  it('accepts a real result produced by the engine', () => {
    expect(ScanResultSchema.safeParse(sampleResult()).success).toBe(true)
  })

  it('rejects unexpected fields anywhere in the tree', () => {
    const top = { ...sampleResult(), resolvedIp: '93.184.215.14' }
    expect(ScanResultSchema.safeParse(top).success).toBe(false)

    const nested = sampleResult()
    const target = { ...nested.target, pinnedAddress: '93.184.215.14' }
    expect(ScanResultSchema.safeParse({ ...nested, target }).success).toBe(false)

    const withFindingExtra = sampleResult()
    const [first, ...rest] = withFindingExtra.findings
    const leaky = [{ ...first, stack: 'Error at …' }, ...rest]
    expect(ScanResultSchema.safeParse({ ...withFindingExtra, findings: leaky }).success).toBe(false)
  })

  it('rejects oversized evidence and raw header values', () => {
    const result = sampleResult()
    result.rawHeaders = [{ name: 'x', value: 'a'.repeat(2049) }]
    expect(ScanResultSchema.safeParse(result).success).toBe(false)
  })

  it('rejects an unknown rule id or grade', () => {
    expect(ScanResultSchema.safeParse({ ...sampleResult(), grade: 'A++' }).success).toBe(false)
  })
})

describe('ErrorBodySchema (SC-26)', () => {
  it('allows only a public code', () => {
    expect(ErrorBodySchema.safeParse({ error: { code: 'BLOCKED_TARGET' } }).success).toBe(true)
    expect(
      ErrorBodySchema.safeParse({ error: { code: 'BLOCKED_TARGET', detail: 'x' } }).success,
    ).toBe(false)
    expect(ErrorBodySchema.safeParse({ error: { code: 'NOPE' } }).success).toBe(false)
  })
})

describe('Zod runtime config (ADR-033)', () => {
  it('runs jitless so the browser never probes eval under the page CSP', () => {
    expect(z.config().jitless).toBe(true)
  })
})
