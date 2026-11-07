import { describe, expect, it } from 'vitest'

import { checkUrlInput } from '@/lib/client-url-check'
import { normalizeAndValidate } from '@/lib/scanner/url-policy'

function serverAccepts(input: string): boolean {
  try {
    normalizeAndValidate(input)
    return true
  } catch {
    return false
  }
}

// SSRF matrix inputs (03 §9) plus edge cases from url-policy.test.ts.
const INPUTS = [
  'example.com',
  'https://example.com/path?q=1',
  'http://example.com:80/',
  'example.com:443/a',
  'https://例え.jp',
  'www.example.org.',
  'http://localhost',
  'http://localhost.',
  'http://app.localhost',
  'http://127.0.0.1',
  'http://127.1',
  'http://2130706433',
  'http://0x7f000001',
  'http://0177.0.0.1',
  'http://[::1]',
  'http://[::ffff:127.0.0.1]',
  'http://10.0.0.1',
  'http://169.254.169.254/latest/meta-data/',
  'http://metadata.google.internal',
  'http://printer.local',
  'http://server.corp',
  'file:///etc/passwd',
  'ftp://example.com',
  'javascript:alert(1)',
  'data:text/html,x',
  'https://user:pass@example.com',
  'https://example.com:8443',
  'https://example.com/%0d%0aX-Injected:1',
  'https://example.com/a\r\nb',
  `https://example.com/${'a'.repeat(2040)}`,
  'https://intranet/',
  'https://-bad.example.com/',
  'https://exa$mple.com/',
  '   ',
  '',
]

describe('checkUrlInput mirrors the server policy (SC-01…SC-08)', () => {
  it.each(INPUTS)('agrees with normalizeAndValidate for %j', (input) => {
    expect(checkUrlInput(input) === null).toBe(serverAccepts(input))
  })

  it.each([
    ['', 'empty'],
    ['a'.repeat(2049), 'tooLong'],
    ['https://example.com/%00', 'controlChars'],
    ['ftp://example.com', 'scheme'],
    ['https://u:p@example.com', 'credentials'],
    ['example.com:8080', 'port'],
    ['http://127.1', 'ipLiteral'],
    ['http://[::1]/', 'ipLiteral'],
    ['https://myhost/', 'hostname'],
    ['http://exa mple.com', 'hostname'],
    ['printer.local', 'reserved'],
  ] as const)('%j → %s', (input, error) => {
    expect(checkUrlInput(input)).toBe(error)
  })
})
