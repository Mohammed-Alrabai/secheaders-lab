import { describe, expect, it } from 'vitest'

import { ScanError, type ScanErrorDetail } from '@/lib/scanner/errors'
import {
  MAX_URL_LENGTH,
  RESERVED_HOST_SUFFIXES,
  assertUrlPolicy,
  normalizeAndValidate,
  resolveRedirectTarget,
} from '@/lib/scanner/url-policy'

function rejection(fn: () => unknown): ScanError {
  try {
    fn()
  } catch (error) {
    if (error instanceof ScanError) return error
    throw error
  }
  throw new Error('expected a ScanError')
}

function expectInvalid(input: unknown, detail: ScanErrorDetail): void {
  const error = rejection(() => normalizeAndValidate(input))
  expect(error.code).toBe('INVALID_URL')
  expect(error.detail).toBe(detail)
}

describe('normalizeAndValidate — accepted inputs', () => {
  it.each([
    ['example.com', 'https://example.com/'],
    ['  example.com  ', 'https://example.com/'],
    ['http://example.com', 'http://example.com/'],
    ['HTTPS://Example.COM/Path?q=1', 'https://example.com/Path?q=1'],
    ['https://example.com:443/', 'https://example.com/'],
    ['http://example.com:80/', 'http://example.com/'],
    ['http://example.com:443/', 'http://example.com:443/'],
    ['https://example.com:80/', 'https://example.com:80/'],
    ['example.com:443/a', 'https://example.com/a'],
    ['www.example.org', 'https://www.example.org/'],
    ['https://example.com./', 'https://example.com/'],
    ['https://my_host.example.com/', 'https://my_host.example.com/'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeAndValidate(input).href).toBe(expected)
  })

  it('SC-09 drops the fragment but keeps path and query', () => {
    expect(normalizeAndValidate('https://example.com/a/b?x=1#frag').href).toBe(
      'https://example.com/a/b?x=1',
    )
  })

  it('SC-07 normalizes an IDN to punycode', () => {
    expect(normalizeAndValidate('例え.jp').hostname).toBe('xn--r8jz45g.jp')
    expect(normalizeAndValidate('https://xn--r8jz45g.jp').hostname).toBe('xn--r8jz45g.jp')
  })

  it('SC-01 accepts exactly 2,048 characters', () => {
    const base = 'https://example.com/'
    const input = base + 'a'.repeat(MAX_URL_LENGTH - base.length)
    expect(normalizeAndValidate(input).href).toHaveLength(MAX_URL_LENGTH)
  })

  it('returns a new URL and never mutates its input', () => {
    const input = new URL('https://example.com./#x')
    const output = assertUrlPolicy(input)
    expect(output).not.toBe(input)
    expect(input.href).toBe('https://example.com./#x')
  })
})

describe('SC-01 length and control characters', () => {
  it('rejects non-string input', () => {
    expectInvalid(42, 'INPUT_TYPE')
    expectInvalid(undefined, 'INPUT_TYPE')
  })

  it('rejects empty or whitespace-only input', () => {
    expectInvalid('', 'TOO_LONG')
    expectInvalid('   ', 'TOO_LONG')
  })

  it('rejects 2,049 characters', () => {
    expectInvalid('https://example.com/' + 'a'.repeat(MAX_URL_LENGTH), 'TOO_LONG')
  })

  it.each([
    'https://example.com/\r\nX-Injected: 1',
    'https://exa\u0000mple.com/',
    'https://example.com/a\tb',
    'https://example.com/\u007f',
    'https://example.com/%0d%0aX-Injected:1',
    'https://example.com/%0A',
    'https://example.com/%00',
    'https://example.com/%7F',
  ])('rejects control characters in %j', (input) => {
    expectInvalid(input, 'CONTROL_CHARS')
  })

  it('rejects a URL that only exceeds the limit after normalization', () => {
    const input = 'https://例え.jp/' + 'a'.repeat(MAX_URL_LENGTH - 20)
    expectInvalid(input, 'TOO_LONG')
  })
})

describe('SC-02 / SC-03 scheme and parsing', () => {
  it.each([
    'file:///etc/passwd',
    'ftp://example.com',
    'gopher://example.com',
    'javascript:alert(1)',
    'data:text/html,x',
    'ws://example.com',
    'wss://example.com',
    'mailto:user@example.com',
  ])('rejects %s', (input) => {
    expectInvalid(input, 'SCHEME')
  })

  it.each(['https://', 'http://exa mple.com', 'https://[::1'])('rejects unparsable %s', (input) => {
    expectInvalid(input, 'PARSE')
  })
})

describe('SC-04 credentials', () => {
  it.each([
    'https://user:pass@example.com',
    'https://user@example.com',
    'https://:pass@example.com',
  ])('rejects %s', (input) => {
    expectInvalid(input, 'CREDENTIALS')
  })
})

describe('SC-05 ports', () => {
  it.each([
    'https://example.com:8443',
    'http://example.com:22',
    'example.com:8080',
    'https://example.com:0',
  ])('rejects %s', (input) => {
    expectInvalid(input, 'PORT')
  })
})

describe('SC-06 IP literals in any form', () => {
  it.each([
    'http://127.0.0.1',
    'http://127.1',
    'http://2130706433',
    'http://0x7f000001',
    'http://0177.0.0.1',
    'http://0x7f.0.0.1',
    'http://[::1]',
    'http://[::ffff:127.0.0.1]',
    'http://[::ffff:7f00:1]',
    'http://0.0.0.0',
    'http://10.0.0.1',
    'http://192.168.1.1',
    'http://172.16.0.1',
    'http://100.64.0.1',
    'http://169.254.169.254/latest/meta-data/',
    'http://93.184.215.14',
    '8.8.8.8',
    'http://%31%32%37.0.0.1',
  ])('rejects %s', (input) => {
    expectInvalid(input, 'IP_LITERAL')
  })
})

describe('SC-07 hostname shape', () => {
  it.each([
    ['single label', 'https://myhost/'],
    ['label > 63 chars', `https://${'a'.repeat(64)}.com/`],
    ['label with leading hyphen', 'https://-bad.example.com/'],
    ['label with trailing hyphen', 'https://bad-.example.com/'],
    ['double trailing dot', 'https://example.com../'],
    ['empty label', 'https://a..example.com/'],
    ['disallowed character', 'https://exa$mple.com/'],
  ])('rejects %s', (_name, input) => {
    expectInvalid(input, 'HOSTNAME_SHAPE')
  })

  it('rejects a hostname longer than 253 characters', () => {
    const label = 'a'.repeat(63)
    const host = [label, label, label, label, 'com'].join('.')
    expect(host.length).toBeGreaterThan(253)
    expectInvalid(`https://${host}/`, 'HOSTNAME_SHAPE')
  })

  it('accepts a 253-character hostname', () => {
    const host = ['a'.repeat(63), 'b'.repeat(63), 'c'.repeat(63), 'd'.repeat(61)].join('.')
    expect(host).toHaveLength(253)
    expect(normalizeAndValidate(`https://${host}/`).hostname).toBe(host)
  })
})

describe('SC-08 reserved and internal names', () => {
  it.each([
    'http://localhost',
    'http://localhost.',
    'http://app.localhost',
    'http://metadata.google.internal',
    'http://printer.local',
    'http://server.corp',
    'http://wiki.intranet',
    'http://nas.lan',
    'http://router.home.arpa',
    'http://1.0.0.127.in-addr.arpa',
    'http://site.test',
    'http://site.invalid',
    'http://www.example',
    'http://hidden.onion',
    'http://%6c%6f%63%61%6c%68%6f%73%74.',
  ])('rejects %s', (input) => {
    const error = rejection(() => normalizeAndValidate(input))
    expect(error.code).toBe('INVALID_URL')
    expect(['RESERVED_NAME', 'HOSTNAME_SHAPE']).toContain(error.detail)
  })

  it('treats suffixes as whole labels only', () => {
    expect(normalizeAndValidate('https://mylocal.com').hostname).toBe('mylocal.com')
    expect(normalizeAndValidate('https://testing.dev').hostname).toBe('testing.dev')
    expect(normalizeAndValidate('https://example.com').hostname).toBe('example.com')
  })

  it('keeps the reserved list in one constant', () => {
    expect(RESERVED_HOST_SUFFIXES).toContain('internal')
    expect(RESERVED_HOST_SUFFIXES).not.toContain('com')
  })
})

describe('SC-17 resolveRedirectTarget', () => {
  const base = new URL('https://example.com/a/b')

  it('resolves relative locations against the current URL', () => {
    expect(resolveRedirectTarget('/next', base).href).toBe('https://example.com/next')
    expect(resolveRedirectTarget('c?x=1#f', base).href).toBe('https://example.com/a/c?x=1')
    expect(resolveRedirectTarget('//www.example.org/', base).href).toBe('https://www.example.org/')
  })

  it.each([
    ['http://169.254.169.254/', 'IP_LITERAL'],
    ['file:///', 'SCHEME'],
    ['https://example.com:8080/', 'PORT'],
    ['http://app.localhost/', 'RESERVED_NAME'],
    ['http://localhost/', 'RESERVED_NAME'],
    ['https://u:p@example.com/', 'CREDENTIALS'],
    ['/x\r\nSet-Cookie: a=b', 'CONTROL_CHARS'],
    ['/x%0d%0a', 'CONTROL_CHARS'],
    ['', 'TOO_LONG'],
    ['http://[::1', 'PARSE'],
  ] as const)('re-applies the full policy: %s → %s', (location, detail) => {
    const error = rejection(() => resolveRedirectTarget(location, base))
    expect(error.code).toBe('INVALID_URL')
    expect(error.detail).toBe(detail)
  })

  it('rejects an overlong Location header', () => {
    const error = rejection(() => resolveRedirectTarget('/' + 'a'.repeat(MAX_URL_LENGTH), base))
    expect(error.detail).toBe('TOO_LONG')
  })
})
