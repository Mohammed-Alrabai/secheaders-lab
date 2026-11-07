import type http from 'node:http'
import net from 'node:net'
import tls from 'node:tls'

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { ScanError } from '@/lib/scanner/errors'
import {
  MAX_KEPT_HEADERS,
  buildUserAgent,
  createPinnedConnector,
  safeFetch,
  type SafeFetchDeps,
} from '@/lib/scanner/safe-fetch'

import { type Pem, createTestCa, issueLeaf } from '../helpers/certs'
import { localConnectorFactory } from '../helpers/local-connector'
import { MockResolver } from '../helpers/mock-resolver'
import { type TestServer, redirect, startHttpServer, startHttpsServer } from '../helpers/servers'

const PUBLIC_IP = '93.184.215.14'
const UA = buildUserAgent('0.0.1', 'https://secheaders.example.org')

let ca: Pem
let leaf: Pem
let route: (req: http.IncomingMessage, res: http.ServerResponse) => void
let httpsServer: TestServer
let httpServer: TestServer

beforeAll(async () => {
  ca = await createTestCa()
  leaf = await issueLeaf(ca, { hostnames: ['example.com', 'www.example.com', 'other.example.org'] })
  httpsServer = await startHttpsServer((req, res) => {
    route(req, res)
  }, leaf)
  httpServer = await startHttpServer((req, res) => {
    route(req, res)
  })
})

afterAll(async () => {
  await Promise.all([httpsServer.close(), httpServer.close()])
})

afterEach(() => {
  httpsServer.requests.length = 0
  httpServer.requests.length = 0
})

function deps(
  overrides: Partial<SafeFetchDeps> = {},
  log: Parameters<typeof localConnectorFactory>[2] = [],
) {
  const resolver = new MockResolver()
    .set('example.com', [PUBLIC_IP])
    .set('www.example.com', [PUBLIC_IP])
    .set('other.example.org', [PUBLIC_IP])
  return {
    resolver,
    signal: AbortSignal.timeout(8_000),
    userAgent: UA,
    connectorFactory: localConnectorFactory(
      { https: httpsServer.port, http: httpServer.port },
      ca.cert,
      log,
    ),
    ...overrides,
  } satisfies SafeFetchDeps
}

async function failure(promise: Promise<unknown>): Promise<ScanError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ScanError) return error
    throw error
  }
  throw new Error('expected a ScanError')
}

describe('safeFetch happy path', () => {
  it('fetches headers over verified TLS and reports the chain', async () => {
    route = (_req, res) => {
      res.setHeader('strict-transport-security', 'max-age=63072000')
      res.setHeader('set-cookie', ['a=1; Secure', 'b=2; HttpOnly'])
      res.end('ok')
    }
    const result = await safeFetch('example.com', deps())
    expect(result.status).toBe(200)
    expect(result.finalUrl.href).toBe('https://example.com/')
    expect(result.chain).toEqual([{ url: 'https://example.com/', status: 200 }])
    expect(result.pinned).toEqual({ hostname: 'example.com', address: PUBLIC_IP, family: 4 })
    expect(result.headers).toContainEqual(['strict-transport-security', 'max-age=63072000'])
    expect(result.headers.filter(([name]) => name === 'set-cookie')).toEqual([
      ['set-cookie', 'a=1; Secure'],
      ['set-cookie', 'b=2; HttpOnly'],
    ])
  })

  it('accepts a URL object and keeps path and query', async () => {
    route = (_req, res) => res.end()
    await safeFetch(new URL('https://example.com/a/b?x=1#frag'), deps())
    expect(httpsServer.requests[0]?.url).toBe('/a/b?x=1')
  })

  it('SC-15 / SC-16 sends only GET with the fixed header set', async () => {
    route = (_req, res) => res.end()
    await safeFetch('https://example.com/', deps())
    const request = httpsServer.requests[0]
    expect(request?.method).toBe('GET')
    expect(request?.headers['user-agent']).toBe(
      'SecHeadersLab/0.0.1 (+https://secheaders.example.org/about)',
    )
    expect(request?.headers.accept).toBe('text/html,*/*;q=0.8')
    expect(request?.headers['accept-language']).toBe('en')
    expect(request?.headers.host).toBe('example.com')
    const allowed = new Set(['host', 'user-agent', 'accept', 'accept-language', 'connection'])
    expect(request?.rawHeaderNames.filter((h) => !allowed.has(h))).toEqual([])
  })

  it('SC-20 keeps at most 100 header entries', async () => {
    route = (_req, res) => {
      for (let i = 0; i < 150; i++) res.setHeader(`x-h-${String(i)}`, String(i))
      res.end()
    }
    const result = await safeFetch('https://example.com/', deps())
    expect(result.headers).toHaveLength(MAX_KEPT_HEADERS)
  })

  it('SC-20 rejects response headers larger than 64 KB', async () => {
    route = (_req, res) => {
      res.setHeader('x-big', 'a'.repeat(70 * 1024))
      res.end()
    }
    const error = await failure(safeFetch('https://example.com/', deps()))
    expect(error.code).toBe('TARGET_UNREACHABLE')
    expect(error.detail).toBe('HEADERS_TOO_LARGE')
  })

  it('treats a 3xx without Location as the final response', async () => {
    route = (_req, res) => {
      res.statusCode = 304
      res.end()
    }
    const result = await safeFetch('https://example.com/', deps())
    expect(result.status).toBe(304)
  })
})

describe('SC-17 redirects', () => {
  it('follows relative and absolute redirects, re-validating and re-resolving each hop', async () => {
    route = (req, res) => {
      if (req.url === '/') redirect(res, '/step', 301)
      else if (req.url === '/step') redirect(res, 'https://www.example.com/final?x=1#f', 308)
      else res.end('done')
    }
    const log: Parameters<typeof localConnectorFactory>[2] = []
    const resolver = new MockResolver()
      .set('example.com', [PUBLIC_IP])
      .set('www.example.com', [PUBLIC_IP])
    const d = deps({ resolver }, log)
    const result = await safeFetch('https://example.com/', d)
    expect(result.chain).toEqual([
      { url: 'https://example.com/', status: 301 },
      { url: 'https://example.com/step', status: 308 },
      { url: 'https://www.example.com/final?x=1', status: 200 },
    ])
    expect(resolver.calls).toEqual(['example.com', 'example.com', 'www.example.com'])
    expect(log.map((l) => l.pinned.address)).toEqual([PUBLIC_IP, PUBLIC_IP, PUBLIC_IP])
    expect(httpsServer.requests[2]?.headers.host).toBe('www.example.com')
  })

  it('follows an https → http downgrade under the same controls', async () => {
    route = (_req, res) => {
      redirect(res, 'http://example.com/plain')
    }
    const httpRoute = route
    route = (req, res) => {
      if (req.socket.localPort === httpServer.port) res.end('plain')
      else httpRoute(req, res)
    }
    const result = await safeFetch('https://example.com/', deps())
    expect(result.finalUrl.href).toBe('http://example.com/plain')
    expect(result.status).toBe(200)
  })

  it('stopBefore returns the validated next hop without requesting it', async () => {
    route = (req, res) => {
      if (req.url === '/') redirect(res, '/step')
      else redirect(res, 'https://www.example.com/secure')
    }
    const log: Parameters<typeof localConnectorFactory>[2] = []
    const result = await safeFetch('http://example.com/', deps({}, log), {
      stopBefore: (next) => next.protocol === 'https:',
    })
    expect(result.finalUrl.href).toBe('https://www.example.com/secure')
    expect(result.status).toBe(302)
    expect(result.chain.map((h) => h.url)).toEqual([
      'http://example.com/',
      'http://example.com/step',
    ])
    expect(log.map((l) => l.url)).toEqual(['http://example.com/', 'http://example.com/step'])
  })

  it('stopBefore still applies the policy to the next hop', async () => {
    route = (_req, res) => {
      redirect(res, 'https://169.254.169.254/')
    }
    const error = await failure(
      safeFetch('http://example.com/', deps(), {
        stopBefore: (next) => next.protocol === 'https:',
      }),
    )
    expect(error.code).toBe('BLOCKED_TARGET')
  })

  it('allows exactly 5 redirects', async () => {
    route = (req, res) => {
      const n = Number(req.url?.slice(1) ?? '0')
      if (n < 5) redirect(res, `/${String(n + 1)}`)
      else res.end()
    }
    const result = await safeFetch('https://example.com/', deps())
    expect(result.chain).toHaveLength(6)
  })

  it('never sends a cookie on later hops (SC-22)', async () => {
    route = (req, res) => {
      if (req.url === '/') {
        res.setHeader('set-cookie', 'session=abc')
        redirect(res, '/next')
      } else res.end()
    }
    await safeFetch('https://example.com/', deps())
    expect(httpsServer.requests[1]?.headers.cookie).toBeUndefined()
  })

  it('takes the first Location value when a hop sends several', async () => {
    route = (req, res) => {
      if (req.url === '/') {
        res.writeHead(302, [
          ['location', '/one'],
          ['location', '/two'],
        ])
        res.end()
      } else res.end()
    }
    const result = await safeFetch('https://example.com/', deps())
    expect(result.finalUrl.pathname).toBe('/one')
  })
})

describe('transport failures map to public codes (SC-26)', () => {
  it('maps a refused connection to TARGET_UNREACHABLE', async () => {
    const closed = await startHttpServer(() => undefined)
    const port = closed.port
    await closed.close()
    const error = await failure(
      safeFetch(
        'http://example.com/',
        deps({ connectorFactory: localConnectorFactory({ http: port }, undefined) }),
      ),
    )
    expect(error.code).toBe('TARGET_UNREACHABLE')
    expect(error.detail).toBe('CONNECT_FAILED')
  })

  it('SC-21 rejects an untrusted certificate on the page fetch', async () => {
    route = (_req, res) => res.end()
    const error = await failure(
      safeFetch(
        'https://example.com/',
        deps({ connectorFactory: localConnectorFactory({ https: httpsServer.port }, undefined) }),
      ),
    )
    expect(error.code).toBe('TARGET_UNREACHABLE')
    expect(error.detail).toBe('TLS_FAILURE')
  })

  it('SC-21 rejects a certificate for another hostname', async () => {
    route = (_req, res) => res.end()
    const resolver = new MockResolver().set('wrong.example.net', [PUBLIC_IP])
    const error = await failure(safeFetch('https://wrong.example.net/', deps({ resolver })))
    expect(error.detail).toBe('TLS_FAILURE')
  })

  it('maps a malformed HTTP response to PROTOCOL_ERROR', async () => {
    const sockets = new Set<net.Socket>()
    const garbage = net.createServer((socket) => {
      sockets.add(socket)
      socket.on('error', () => undefined)
      socket.on('data', () => {
        socket.write('HTTP/1.1 200 OK\r\nbad header line without colon\r\n\r\n')
      })
    })
    await new Promise<void>((resolve) => garbage.listen(0, '127.0.0.1', resolve))
    const address = garbage.address()
    if (address === null || typeof address === 'string') throw new Error('no port')
    try {
      const error = await failure(
        safeFetch(
          'http://example.com/',
          deps({ connectorFactory: localConnectorFactory({ http: address.port }, undefined) }),
        ),
      )
      expect(error.code).toBe('TARGET_UNREACHABLE')
      expect(error.detail).toBe('PROTOCOL_ERROR')
    } finally {
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve) => {
        garbage.close(() => {
          resolve()
        })
      })
    }
  })

  it('does not leak resolved IPs or upstream text in the error', async () => {
    const error = await failure(
      safeFetch(
        'http://example.com/',
        deps({ connectorFactory: localConnectorFactory({ http: 1 }, undefined) }),
      ),
    )
    expect(error.message).not.toContain(PUBLIC_IP)
    expect(error.message).not.toContain('127.0.0.1')
  })
})

describe('production connector (no test injection, SC-13 / SC-21)', () => {
  const refuse = () => {
    throw Object.assign(new Error('refused by test'), { code: 'ECONNREFUSED' })
  }

  it('dials the pinned public IP for HTTPS with SNI and strict verification', async () => {
    const spy = vi.spyOn(tls, 'connect').mockImplementation(refuse)
    const resolver = new MockResolver().set('example.com', [PUBLIC_IP])
    const error = await failure(
      safeFetch('https://example.com/', {
        resolver,
        signal: AbortSignal.timeout(5_000),
        userAgent: UA,
      }),
    )
    expect(error.code).toBe('TARGET_UNREACHABLE')
    expect(spy).toHaveBeenCalledOnce()
    expect(spy.mock.calls[0]?.[0]).toMatchObject({
      host: PUBLIC_IP,
      port: 443,
      servername: 'example.com',
      rejectUnauthorized: true,
    })
  })

  it('dials the pinned public IP for HTTP on port 80 without any lookup', async () => {
    const spy = vi.spyOn(net, 'connect').mockImplementation(refuse)
    const resolver = new MockResolver().set('example.com', [PUBLIC_IP])
    await failure(
      safeFetch('http://example.com/', {
        resolver,
        signal: AbortSignal.timeout(5_000),
        userAgent: UA,
      }),
    )
    expect(spy).toHaveBeenCalledOnce()
    const options = spy.mock.calls[0]?.[0] as { host?: string; port?: number; lookup?: unknown }
    expect(options.host).toBe(PUBLIC_IP)
    expect(options.port).toBe(80)
    expect(options.lookup).toBeUndefined()
  })

  it('uses the URL port when no override is given', async () => {
    const connector = createPinnedConnector({ address: '127.0.0.1', servername: 'example.com' })
    const socket = await new Promise<net.Socket>((resolve, reject) => {
      connector(
        { hostname: 'example.com', protocol: 'http:', port: String(httpServer.port) },
        (err, s) => {
          if (err) reject(err)
          else resolve(s)
        },
      )
    })
    expect(socket.remoteAddress).toBe('127.0.0.1')
    expect(socket.remotePort).toBe(httpServer.port)
    socket.destroy()
  })
})

describe('createPinnedConnector (SC-13)', () => {
  it('dials the pinned IP without any DNS lookup and verifies TLS against servername', async () => {
    route = (_req, res) => res.end('pinned')
    // The network guard throws on any real DNS lookup for a non-localhost name, so success
    // proves the hostname was never resolved.
    const resolver = new MockResolver().set('www.example.com', [PUBLIC_IP])
    const result = await safeFetch('https://www.example.com/', {
      resolver,
      signal: AbortSignal.timeout(5_000),
      userAgent: UA,
      connectorFactory: (_pinned, url) =>
        createPinnedConnector({
          address: '127.0.0.1',
          servername: url.hostname,
          port: httpsServer.port,
          ca: ca.cert,
        }),
    })
    expect(result.status).toBe(200)
    expect(resolver.calls).toEqual(['www.example.com'])
  })

  it('does not send SNI on plain HTTP', async () => {
    route = (_req, res) => res.end()
    const result = await safeFetch('http://example.com/', {
      ...deps(),
      connectorFactory: () =>
        createPinnedConnector({
          address: '127.0.0.1',
          servername: 'example.com',
          port: httpServer.port,
        }),
    })
    expect(result.status).toBe(200)
  })
})
