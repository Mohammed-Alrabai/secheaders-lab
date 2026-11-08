import { describe, expect, it } from 'vitest'

import { reportFileName, reportJson } from '@/lib/report-export'
import { ScanResultSchema } from '@/lib/schemas'

import { sampleResult } from '../e2e/fixtures'

const named = (finalUrl: string, scannedAt = '2026-11-08T21:15:00.000Z') =>
  reportFileName({ target: { ...sampleResult().target, finalUrl }, scannedAt })

describe('reportFileName (ADR-040)', () => {
  it('uses the final hostname and the UTC scan date', () => {
    expect(named('https://www.example.com/path?q=1')).toBe(
      'secheaders-www.example.com-2026-11-08.json',
    )
  })

  it('keeps punycode hostnames as they are', () => {
    expect(named('https://xn--mgbh0fb.example/')).toBe(
      'secheaders-xn--mgbh0fb.example-2026-11-08.json',
    )
  })

  it('falls back safely for an unparsable URL or date', () => {
    expect(named('not a url', 'yesterday')).toBe('secheaders-report-undated.json')
  })

  it('never produces path separators or reserved characters', () => {
    const name = named('https://example.com/', '2026-11-08T00:00:00Z')
    expect(name).toMatch(/^secheaders-[a-z0-9.-]+-\d{4}-\d{2}-\d{2}\.json$/)
  })
})

describe('reportJson (ADR-040)', () => {
  it('round-trips to the same schema-valid result', () => {
    const result = sampleResult()
    const text = reportJson(result)
    expect(text.endsWith('}\n')).toBe(true)
    const parsed: unknown = JSON.parse(text)
    expect(ScanResultSchema.parse(parsed)).toEqual(ScanResultSchema.parse(result))
  })

  it('keeps cookie values redacted, as the API returned them', () => {
    const result = sampleResult()
    expect(reportJson(result)).not.toContain('TOP-SECRET')
  })
})
