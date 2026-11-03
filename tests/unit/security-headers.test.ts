import { describe, expect, it } from 'vitest'

import nextConfig from '../../next.config'
import { BASELINE_CSP, SECURITY_HEADERS } from '@/lib/security-headers'

function header(name: string): string | undefined {
  return SECURITY_HEADERS.find((h) => h.key.toLowerCase() === name.toLowerCase())?.value
}

describe('own security headers (03 §6)', () => {
  it('has no duplicate header names', () => {
    const names = SECURITY_HEADERS.map((h) => h.key.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })

  it('HSTS is two years with includeSubDomains and preload', () => {
    expect(header('strict-transport-security')).toBe('max-age=63072000; includeSubDomains; preload')
  })

  it.each([
    ['x-content-type-options', 'nosniff'],
    ['x-frame-options', 'DENY'],
    ['referrer-policy', 'strict-origin-when-cross-origin'],
    ['cross-origin-opener-policy', 'same-origin'],
    ['cross-origin-resource-policy', 'same-origin'],
  ])('%s is %s', (name, value) => {
    expect(header(name)).toBe(value)
  })

  it('baseline CSP locks down objects, base URI, forms and framing', () => {
    expect(BASELINE_CSP).toContain("object-src 'none'")
    expect(BASELINE_CSP).toContain("base-uri 'none'")
    expect(BASELINE_CSP).toContain("form-action 'self'")
    expect(BASELINE_CSP).toContain("frame-ancestors 'none'")
    expect(BASELINE_CSP).not.toMatch(/unsafe-(inline|eval)/)
  })

  it('next.config disables X-Powered-By and applies the headers to every path', async () => {
    expect(nextConfig.poweredByHeader).toBe(false)
    const rules = await nextConfig.headers?.()
    expect(rules).toEqual([{ source: '/:path*', headers: [...SECURITY_HEADERS] }])
  })
})
