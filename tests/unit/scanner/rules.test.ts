import { describe, expect, it } from 'vitest'

import { ruleMeta } from '@/lib/scanner/rules'
import { RULE_IDS, type RuleId } from '@/lib/scanner/types'

const ALLOWED_HOSTS = new Set(['developer.mozilla.org', 'owasp.org', 'cheatsheetseries.owasp.org'])
const PREFIX = new Map([
  ['headers', 'HDR-'],
  ['tls', 'TLS-'],
  ['cookies', 'CK-'],
  ['disclosure', 'INF-'],
])

describe('rules registry (04 §4, §7)', () => {
  it.each(RULE_IDS)('%s has metadata and at least one reference', (id) => {
    expect(ruleMeta(id).references.length).toBeGreaterThan(0)
  })

  it('throws for an unknown rule ID', () => {
    expect(() => ruleMeta(JSON.parse('"HDR-NOPE"') as RuleId)).toThrow(/Unknown rule/)
  })

  it('only references HTTPS pages on the allowed documentation hosts (04 §7)', () => {
    for (const id of RULE_IDS) {
      for (const ref of ruleMeta(id).references) {
        const url = new URL(ref.url)
        expect(url.protocol, `${id} ${ref.url}`).toBe('https:')
        expect(ALLOWED_HOSTS.has(url.hostname), `${id} ${ref.url}`).toBe(true)
        expect(ref.label.length).toBeGreaterThan(0)
      }
    }
  })

  it('category matches the rule ID prefix', () => {
    for (const id of RULE_IDS)
      expect(id.startsWith(PREFIX.get(ruleMeta(id).category) ?? '?')).toBe(true)
  })

  it('maximum deductions add up to the sanity totals in 04 §5', () => {
    const total = (category: string) =>
      RULE_IDS.filter((id) => ruleMeta(id).category === category).reduce(
        (sum, id) => sum + ruleMeta(id).maxDeduction,
        0,
      )
    expect(total('headers')).toBe(66)
    expect(total('tls')).toBe(95)
    expect(total('cookies')).toBe(27)
    expect(total('disclosure')).toBe(9)
  })
})
