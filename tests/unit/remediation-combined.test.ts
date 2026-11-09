import { describe, expect, it } from 'vitest'

import {
  PLATFORMS,
  RECOMMENDED_HEADERS,
  combinedHeaderFix,
  isHeaderRule,
  remediationFor,
} from '@/lib/remediation'
import { RULE_IDS, type RuleId } from '@/lib/scanner/types'

const HEADER_RULES = RULE_IDS.filter(isHeaderRule)
const codeOf = (rules: readonly RuleId[], platform: (typeof PLATFORMS)[number]) => {
  const snippet = combinedHeaderFix(rules, platform)
  if (snippet?.kind !== 'code') throw new Error(`expected code for ${platform}`)
  return snippet.code
}

describe('isHeaderRule (ADR-044)', () => {
  it('is true exactly for the rules in RECOMMENDED_HEADERS', () => {
    expect(HEADER_RULES).toEqual(Object.keys(RECOMMENDED_HEADERS))
    expect(isHeaderRule('TLS-PROTOCOL')).toBe(false)
    expect(isHeaderRule('INF-SERVER')).toBe(false)
  })
})

describe('combinedHeaderFix (ADR-044)', () => {
  it('returns null without header rules, and for Cloudflare', () => {
    for (const platform of PLATFORMS) {
      expect(combinedHeaderFix([], platform)).toBeNull()
      expect(combinedHeaderFix(['TLS-PROTOCOL', 'INF-SERVER'], platform)).toBeNull()
    }
    expect(combinedHeaderFix(HEADER_RULES, 'cloudflare')).toBeNull()
  })

  it.each(PLATFORMS.filter((p) => p !== 'cloudflare'))(
    '%s: one block containing every requested header value exactly once',
    (platform) => {
      const lines = codeOf(HEADER_RULES, platform).split('\n')
      const lineFor = (name: string, value: string): string => {
        switch (platform) {
          case 'nginx':
            return `add_header ${name} "${value}" always;`
          case 'apache':
            return `Header always set ${name} "${value}"`
          case 'iis':
            return `      <add name="${name}" value="${value.replaceAll('"', '&quot;')}" />`
          case 'nextjs':
            return `          { key: '${name}', value: ${JSON.stringify(value)} },`
          case 'netlify':
            return `  ${name}: ${value}`
        }
      }
      for (const [name, value] of Object.values(RECOMMENDED_HEADERS)) {
        expect(
          lines.filter((l) => l === lineFor(name, value)),
          name,
        ).toHaveLength(1)
      }
    },
  )

  it('only includes the requested headers, in RECOMMENDED_HEADERS order', () => {
    const text = codeOf(['HDR-XCTO', 'HDR-HSTS'], 'nginx')
    expect(text).toBe(
      [
        '# Keep "preload" only if you will submit the domain to the HSTS preload list.',
        'add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;',
        'add_header X-Content-Type-Options "nosniff" always;',
        '',
      ].join('\n'),
    )
  })

  it('matches the single-rule snippet for one header', () => {
    for (const platform of ['nginx', 'apache'] as const) {
      const single = remediationFor('HDR-REFERRER', platform)
      expect(single.kind === 'code' && single.code).toBe(codeOf(['HDR-REFERRER'], platform))
    }
  })

  it('netlify keeps comments above the path line', () => {
    const lines = codeOf(['HDR-CSP', 'HDR-XCTO'], 'netlify').trimEnd().split('\n')
    const pathLine = lines.indexOf('/*')
    expect(lines.slice(0, pathLine).every((l) => l.startsWith('# '))).toBe(true)
    expect(lines.slice(pathLine + 1).every((l) => l.startsWith('  '))).toBe(true)
  })

  it('nextjs output is one headers() entry with every key', () => {
    const text = codeOf(HEADER_RULES, 'nextjs')
    expect(text.match(/source: '\/:path\*'/g)).toHaveLength(1)
    expect(text.match(/\{ key: '/g)).toHaveLength(HEADER_RULES.length)
  })
})
