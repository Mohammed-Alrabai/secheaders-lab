import { describe, expect, it } from 'vitest'

import { ScanError } from '@/lib/scanner/errors'
import {
  MAX_KEPT_HEADERS,
  buildUserAgent,
  flattenHeaders,
  mapTransportError,
} from '@/lib/scanner/safe-fetch'

const live = () => new AbortController().signal

function withCode(code: string, message = 'upstream detail 10.0.0.1'): Error {
  return Object.assign(new Error(message), { code })
}

describe('mapTransportError (SC-26)', () => {
  it('passes a ScanError through unchanged', () => {
    const original = new ScanError('BLOCKED_TARGET', 'NON_PUBLIC_ADDRESS')
    expect(mapTransportError(original, live())).toBe(original)
  })

  it('reports BUDGET_EXCEEDED whenever the scan signal has fired', () => {
    const controller = new AbortController()
    controller.abort()
    const error = mapTransportError(withCode('ECONNRESET'), controller.signal)
    expect([error.code, error.detail]).toEqual(['TARGET_TIMEOUT', 'BUDGET_EXCEEDED'])
  })

  it.each([
    ['UND_ERR_CONNECT_TIMEOUT', 'TARGET_TIMEOUT', 'CONNECT_TIMEOUT'],
    ['UND_ERR_HEADERS_TIMEOUT', 'TARGET_TIMEOUT', 'HEADERS_TIMEOUT'],
    ['UND_ERR_BODY_TIMEOUT', 'TARGET_TIMEOUT', 'HEADERS_TIMEOUT'],
    ['UND_ERR_HEADERS_OVERFLOW', 'TARGET_UNREACHABLE', 'HEADERS_TOO_LARGE'],
    ['ERR_TLS_CERT_ALTNAME_INVALID', 'TARGET_UNREACHABLE', 'TLS_FAILURE'],
    ['ERR_SSL_WRONG_VERSION_NUMBER', 'TARGET_UNREACHABLE', 'TLS_FAILURE'],
    ['CERT_HAS_EXPIRED', 'TARGET_UNREACHABLE', 'TLS_FAILURE'],
    ['DEPTH_ZERO_SELF_SIGNED_CERT', 'TARGET_UNREACHABLE', 'TLS_FAILURE'],
    ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'TARGET_UNREACHABLE', 'TLS_FAILURE'],
    ['EPROTO', 'TARGET_UNREACHABLE', 'TLS_FAILURE'],
    ['HPE_INVALID_CONSTANT', 'TARGET_UNREACHABLE', 'PROTOCOL_ERROR'],
    ['ECONNREFUSED', 'TARGET_UNREACHABLE', 'CONNECT_FAILED'],
    ['ECONNRESET', 'TARGET_UNREACHABLE', 'CONNECT_FAILED'],
    ['UND_ERR_SOCKET', 'TARGET_UNREACHABLE', 'CONNECT_FAILED'],
  ])('%s → %s / %s', (code, publicCode, detail) => {
    const error = mapTransportError(withCode(code), live())
    expect([error.code, error.detail]).toEqual([publicCode, detail])
    expect(error.message).not.toContain('10.0.0.1')
  })

  it('recognises undici 8 HTTPParserError by name', () => {
    const parserError = Object.assign(new Error('bad'), { name: 'HTTPParserError' })
    expect(mapTransportError(parserError, live()).detail).toBe('PROTOCOL_ERROR')
  })

  it.each([
    ['a non-object', 'boom'],
    ['null', null],
    ['an object with a numeric code', { code: 42 }],
  ])('treats %s as CONNECT_FAILED', (_name, value) => {
    expect(mapTransportError(value, live()).detail).toBe('CONNECT_FAILED')
  })
})

describe('flattenHeaders (SC-20)', () => {
  it('expands repeated headers, lowercases names and skips undefined', () => {
    expect(
      flattenHeaders({ 'Set-Cookie': ['a=1', 'b=2'], server: 'nginx', missing: undefined }),
    ).toEqual([
      ['set-cookie', 'a=1'],
      ['set-cookie', 'b=2'],
      ['server', 'nginx'],
    ])
  })

  it('keeps at most MAX_KEPT_HEADERS entries, even inside a repeated header', () => {
    const raw = { 'x-many': Array.from({ length: 150 }, (_, i) => String(i)) }
    const out = flattenHeaders(raw)
    expect(out).toHaveLength(MAX_KEPT_HEADERS)
    expect(out.at(-1)).toEqual(['x-many', String(MAX_KEPT_HEADERS - 1)])
  })
})

describe('buildUserAgent (SC-16)', () => {
  it('follows the documented format', () => {
    expect(buildUserAgent('1.2.3', 'https://site.example.org')).toBe(
      'SecHeadersLab/1.2.3 (+https://site.example.org/about)',
    )
  })
})
