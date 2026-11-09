import { EventEmitter } from 'node:events'
import tls from 'node:tls'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { TLS_INSPECT_TIMEOUT_MS, inspectTls, summarizeCertificate } from '@/lib/scanner/tls-inspect'

function cert(fields: Record<string, unknown>): tls.PeerCertificate {
  return fields as unknown as tls.PeerCertificate
}

describe('summarizeCertificate', () => {
  it('handles an empty certificate object', () => {
    expect(summarizeCertificate(cert({}), 'example.com')).toEqual({
      hostnameMatches: false,
      validFrom: null,
      validTo: null,
      issuer: null,
      key: null,
    })
  })

  it('reports EC keys with their curve and RSA keys with their size (ADR-046)', () => {
    expect(
      summarizeCertificate(cert({ bits: 256, nistCurve: 'P-256', asn1Curve: 'prime256v1' }), 'x')
        .key,
    ).toEqual({ type: 'EC', bits: 256, curve: 'P-256' })
    expect(summarizeCertificate(cert({ bits: 384, asn1Curve: 'secp384r1' }), 'x').key).toEqual({
      type: 'EC',
      bits: 384,
      curve: 'secp384r1',
    })
    expect(summarizeCertificate(cert({ bits: 2048, modulus: 'C0FFEE' }), 'x').key).toEqual({
      type: 'RSA',
      bits: 2048,
    })
  })

  it('omits keys it cannot identify', () => {
    expect(summarizeCertificate(cert({ bits: 0, modulus: 'AB' }), 'x').key).toBeNull()
    expect(summarizeCertificate(cert({ bits: 256 }), 'x').key).toBeNull()
    expect(summarizeCertificate(cert({ bits: 256, nistCurve: 'x'.repeat(40) }), 'x').key).toBeNull()
  })

  it('prefers the issuer organisation, then the common name', () => {
    expect(summarizeCertificate(cert({ issuer: { O: 'Org', CN: 'CN' } }), 'x').issuer).toBe('Org')
    expect(summarizeCertificate(cert({ issuer: { CN: 'Only CN' } }), 'x').issuer).toBe('Only CN')
    expect(summarizeCertificate(cert({ issuer: { O: ['First', 'Second'] } }), 'x').issuer).toBe(
      'First',
    )
    expect(summarizeCertificate(cert({ issuer: {} }), 'x').issuer).toBeNull()
  })

  it('converts certificate dates to ISO and rejects garbage', () => {
    const summary = summarizeCertificate(
      cert({ valid_from: 'Nov  3 20:00:00 2026 GMT', valid_to: 'not a date' }),
      'x',
    )
    expect(summary.validFrom).toBe('2026-11-03T20:00:00.000Z')
    expect(summary.validTo).toBeNull()
  })

  it('matches the hostname against subjectAltName', () => {
    const c = cert({
      subject: { CN: 'example.com' },
      subjectaltname: 'DNS:example.com, DNS:www.example.com',
    })
    expect(summarizeCertificate(c, 'www.example.com').hostnameMatches).toBe(true)
    expect(summarizeCertificate(c, 'evil.example.org').hostnameMatches).toBe(false)
  })
})

describe('inspectTls defaults', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('dials port 443 on the pinned IP with SNI and gives up after the default timeout', async () => {
    vi.useFakeTimers()
    const fakeSocket = Object.assign(new EventEmitter(), { destroy: vi.fn() })
    const spy = vi
      .spyOn(tls, 'connect')
      .mockImplementation(() => fakeSocket as unknown as tls.TLSSocket)
    const pending = inspectTls(
      { hostname: 'example.com', address: '93.184.215.14', family: 4 },
      { signal: new AbortController().signal },
    )
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        host: '93.184.215.14',
        port: 443,
        servername: 'example.com',
        rejectUnauthorized: false,
      }),
    )
    expect(spy.mock.calls[0]?.[0]).not.toHaveProperty('ca')
    await vi.advanceTimersByTimeAsync(TLS_INSPECT_TIMEOUT_MS)
    await expect(pending).resolves.toEqual({ available: false, reason: 'TIMEOUT' })
    expect(fakeSocket.destroy).toHaveBeenCalled()
  })
})
