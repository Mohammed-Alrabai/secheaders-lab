import { describe, expect, it } from 'vitest'

import { PLATFORMS, RECOMMENDED_HEADERS, type Platform, remediationFor } from '@/lib/remediation'
import { RULE_IDS } from '@/lib/scanner/types'

describe('remediation snippets (FR-05, 07 task 2.6)', () => {
  it.each(PLATFORMS)('%s: every rule has a snippet or localized steps', (platform) => {
    for (const rule of RULE_IDS) {
      const snippet = remediationFor(rule, platform)
      if (snippet.kind === 'code') {
        expect(snippet.code.trim().length, `${rule}/${platform}`).toBeGreaterThan(0)
        expect(snippet.code.endsWith('\n')).toBe(true)
        expect(snippet.filename.length).toBeGreaterThan(0)
      } else {
        expect(snippet.messageKey).toBe(`remediation.${platform}.${rule}`)
      }
    }
  })

  it.each(PLATFORMS)('%s snapshot', (platform) => {
    const all = Object.fromEntries(RULE_IDS.map((rule) => [rule, remediationFor(rule, platform)]))
    expect(all).toMatchSnapshot()
  })

  it.each(['nginx', 'apache', 'iis', 'nextjs', 'netlify'] as Platform[])(
    '%s header snippets carry the exact recommended value',
    (platform) => {
      for (const [rule, [name, value]] of Object.entries(RECOMMENDED_HEADERS)) {
        const snippet = remediationFor(rule as keyof typeof RECOMMENDED_HEADERS, platform)
        if (snippet.kind !== 'code') throw new Error(`${rule} should be code on ${platform}`)
        expect(snippet.code).toContain(name)
        const rendered = platform === 'iis' ? value.replaceAll('"', '&quot;') : value
        expect(snippet.code).toContain(rendered)
      }
    },
  )

  it('recommended baselines would themselves pass our checks', () => {
    expect(RECOMMENDED_HEADERS['HDR-HSTS'][1]).toMatch(/max-age=63072000; includeSubDomains/)
    expect(RECOMMENDED_HEADERS['HDR-CSP'][1]).not.toMatch(/unsafe-(inline|eval)/)
    expect(RECOMMENDED_HEADERS['HDR-CSP'][1]).toContain("object-src 'none'")
    expect(RECOMMENDED_HEADERS['HDR-PERMISSIONS'][1]).not.toContain('interest-cohort')
  })

  it('nginx uses `always` so headers are sent on error responses too', () => {
    const snippet = remediationFor('HDR-XCTO', 'nginx')
    expect(snippet.kind === 'code' && snippet.code).toContain('always;')
  })

  it('platform-managed fixes point to localized instructions', () => {
    expect(remediationFor('HDR-HSTS', 'cloudflare')).toEqual({
      kind: 'instructions',
      messageKey: 'remediation.cloudflare.HDR-HSTS',
    })
    expect(remediationFor('TLS-CERT-EXPIRY', 'nginx').kind).toBe('instructions')
    expect(remediationFor('CK-SECURE', 'netlify').kind).toBe('instructions')
  })

  it('throws for an unknown platform (untyped input)', () => {
    const bogus = JSON.parse('"lighttpd"') as Platform
    expect(() => remediationFor('HDR-XCTO', bogus)).toThrow(/Unknown platform/)
    expect(() => remediationFor('CK-SECURE', bogus)).toThrow(/Unknown platform/)
  })
})
