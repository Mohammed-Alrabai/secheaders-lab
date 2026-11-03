import net from 'node:net'
import tls from 'node:tls'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { PinnedAddress } from '@/lib/scanner/dns'
import { inspectTls } from '@/lib/scanner/tls-inspect'

import { DAY, type Pem, createTestCa, issueLeaf } from '../helpers/certs'

const pinned: PinnedAddress = { hostname: 'example.com', address: '127.0.0.1', family: 4 }

interface TlsTestServer {
  port: number
  appBytes: () => number
  close: () => Promise<void>
}

async function startTlsServer(pem: Pem, extra: tls.TlsOptions = {}): Promise<TlsTestServer> {
  let appBytes = 0
  const sockets = new Set<net.Socket>()
  const server = tls.createServer({ key: pem.key, cert: pem.cert, ...extra }, (socket) => {
    socket.on('data', (chunk: Buffer) => {
      appBytes += chunk.length
    })
    socket.on('error', () => undefined)
  })
  server.on('connection', (s: net.Socket) => sockets.add(s))
  server.on('tlsClientError', () => undefined)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as net.AddressInfo
  return {
    port: address.port,
    appBytes: () => appBytes,
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy()
        server.close(() => {
          resolve()
        })
      }),
  }
}

async function startRawServer(onSocket: (socket: net.Socket) => void) {
  const sockets = new Set<net.Socket>()
  const server = net.createServer((socket) => {
    sockets.add(socket)
    socket.on('error', () => undefined)
    onSocket(socket)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  return {
    port,
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy()
        server.close(() => {
          resolve()
        })
      }),
  }
}

const live = () => new AbortController().signal

let ca: Pem
let valid: Pem
let servers: TlsTestServer[] = []

beforeAll(async () => {
  ca = await createTestCa()
  valid = await issueLeaf(ca, { hostnames: ['example.com'] })
})

afterAll(async () => {
  await Promise.all(servers.map((s) => s.close()))
  servers = []
})

async function serve(pem: Pem, extra?: tls.TlsOptions) {
  const server = await startTlsServer(pem, extra)
  servers.push(server)
  return server
}

describe('inspectTls (SC-21)', () => {
  it('reports protocol, trust, hostname match, validity and issuer for a valid certificate', async () => {
    const server = await serve(valid)
    const result = await inspectTls(pinned, { signal: live(), port: server.port, ca: ca.cert })
    expect(result).toMatchObject({
      available: true,
      protocol: 'TLSv1.3',
      authorized: true,
      authorizationError: null,
      hostnameMatches: true,
      issuer: 'SecHeaders Lab Test CA',
    })
    if (!result.available) throw new Error('unreachable')
    expect(Date.parse(result.validTo ?? '')).toBeGreaterThan(Date.now() + 80 * DAY)
    expect(Date.parse(result.validFrom ?? '')).toBeLessThan(Date.now())
  })

  it('sends no application data on the inspection socket', async () => {
    const server = await serve(valid)
    await inspectTls(pinned, { signal: live(), port: server.port, ca: ca.cert })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(server.appBytes()).toBe(0)
  })

  it('reports an untrusted certificate instead of failing', async () => {
    const server = await serve(valid)
    const result = await inspectTls(pinned, { signal: live(), port: server.port })
    expect(result).toMatchObject({ available: true, authorized: false, hostnameMatches: true })
    if (!result.available) throw new Error('unreachable')
    expect(result.authorizationError).toMatch(/UNABLE_TO|SELF_SIGNED/)
  })

  it('reports an expired certificate', async () => {
    const expired = await issueLeaf(ca, {
      hostnames: ['example.com'],
      notBefore: new Date(Date.now() - 10 * DAY),
      notAfter: new Date(Date.now() - DAY),
    })
    const server = await serve(expired)
    const result = await inspectTls(pinned, { signal: live(), port: server.port, ca: ca.cert })
    expect(result).toMatchObject({
      available: true,
      authorized: false,
      authorizationError: 'CERT_HAS_EXPIRED',
    })
  })

  it('reports a not-yet-valid certificate', async () => {
    const future = await issueLeaf(ca, {
      hostnames: ['example.com'],
      notBefore: new Date(Date.now() + DAY),
      notAfter: new Date(Date.now() + 10 * DAY),
    })
    const server = await serve(future)
    const result = await inspectTls(pinned, { signal: live(), port: server.port, ca: ca.cert })
    expect(result).toMatchObject({
      available: true,
      authorized: false,
      authorizationError: 'CERT_NOT_YET_VALID',
    })
  })

  it('reports a hostname mismatch', async () => {
    const other = await issueLeaf(ca, { hostnames: ['other.example.org'] })
    const server = await serve(other)
    const result = await inspectTls(pinned, { signal: live(), port: server.port, ca: ca.cert })
    expect(result).toMatchObject({
      available: true,
      authorized: false,
      hostnameMatches: false,
      authorizationError: 'ERR_TLS_CERT_ALTNAME_INVALID',
    })
  })

  it('reports TLS 1.2 when the server caps there', async () => {
    const server = await serve(valid, { maxVersion: 'TLSv1.2' })
    const result = await inspectTls(pinned, { signal: live(), port: server.port, ca: ca.cert })
    expect(result).toMatchObject({ available: true, protocol: 'TLSv1.2' })
  })

  it('ADR-018 detects a server that only speaks TLS 1.1 instead of reporting no HTTPS', async () => {
    const server = await serve(valid, {
      minVersion: 'TLSv1.1',
      maxVersion: 'TLSv1.1',
      ciphers: 'DEFAULT:@SECLEVEL=0',
    })
    const result = await inspectTls(pinned, { signal: live(), port: server.port, ca: ca.cert })
    expect(result).toMatchObject({ available: true, protocol: 'TLSv1.1' })
  })

  it('reports CONNECT_FAILED when nothing listens', async () => {
    const raw = await startRawServer(() => undefined)
    const port = raw.port
    await raw.close()
    await expect(inspectTls(pinned, { signal: live(), port })).resolves.toEqual({
      available: false,
      reason: 'CONNECT_FAILED',
    })
  })

  it('reports HANDSHAKE_FAILED when the peer does not speak TLS', async () => {
    const raw = await startRawServer((socket) => {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
    })
    const result = await inspectTls(pinned, { signal: live(), port: raw.port })
    await raw.close()
    expect(result).toEqual({ available: false, reason: 'HANDSHAKE_FAILED' })
  })

  it('times out when the handshake never completes', async () => {
    const raw = await startRawServer(() => undefined)
    const started = Date.now()
    const result = await inspectTls(pinned, { signal: live(), port: raw.port, timeoutMs: 200 })
    await raw.close()
    expect(result).toEqual({ available: false, reason: 'TIMEOUT' })
    expect(Date.now() - started).toBeLessThan(1_500)
  })

  it('stops when the scan budget is aborted mid-handshake', async () => {
    const raw = await startRawServer(() => undefined)
    const controller = new AbortController()
    const pending = inspectTls(pinned, { signal: controller.signal, port: raw.port })
    setTimeout(() => {
      controller.abort()
    }, 50)
    const result = await pending
    await raw.close()
    expect(result).toEqual({ available: false, reason: 'BUDGET_EXCEEDED' })
  })

  it('does not connect at all when the budget is already spent', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(inspectTls(pinned, { signal: controller.signal, port: 1 })).resolves.toEqual({
      available: false,
      reason: 'BUDGET_EXCEEDED',
    })
  })
})
