import type http from 'node:http'
import net from 'node:net'
import tls from 'node:tls'

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { ScanError } from '@/lib/scanner/errors'
import { type ScanDeps, type TlsInspector, scan } from '@/lib/scanner/index'
import { buildUserAgent } from '@/lib/scanner/safe-fetch'
import { inspectTls } from '@/lib/scanner/tls-inspect'

import { type Pem, createTestCa, issueLeaf } from '../helpers/certs'
import { PERFECT_HEADERS } from '../helpers/check-input'
import { localConnectorFactory } from '../helpers/local-connector'
import { MockResolver } from '../helpers/mock-resolver'
import { type TestServer, redirect, startHttpServer, startHttpsServer } from '../helpers/servers'

const PUBLIC_IP = '93.184.215.14'
type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void

let ca: Pem
let httpsServer: TestServer
let httpServer: TestServer
let httpsRoute: Handler
let httpRoute: Handler

const sendPerfect: Handler = (_req, res) => {
  for (const [name, value] of PERFECT_HEADERS) res.appendHeader(name, value)
  res.end('<html></html>')
}
const toHttps: Handler = (req, res) => {
  redirect(res, `https://${req.headers.host ?? ''}${req.url ?? '/'}`, 301)
}

beforeAll(async () => {
  ca = await createTestCa()
  const leaf = await issueLeaf(ca, {
    hostnames: ['example.com', 'www.example.com', 'a.github.io'],
  })
  httpsServer = await startHttpsServer((req, res) => {
    httpsRoute(req, res)
  }, leaf)
  httpServer = await startHttpServer((req, res) => {
    httpRoute(req, res)
  })
})

afterAll(async () => {
  await Promise.all([httpsServer.close(), httpServer.close()])
})

/** TLS inspection dials the local HTTPS server in place of the pinned public IP. */
function localInspector(port: number, trust: string | undefined): TlsInspector {
  return (pinned, signal) =>
    inspectTls(
      { ...pinned, address: '127.0.0.1' },
      { signal, port, ...(trust ? { ca: trust } : {}) },
    )
}

function deps(
  overrides: Partial<ScanDeps> = {},
  routes = { https: 0, http: 0 },
  trustCa = true,
): ScanDeps {
  const httpsPort = routes.https || httpsServer.port
  const httpPort = routes.http || httpServer.port
  const trust = trustCa ? ca.cert : undefined
  return {
    userAgent: buildUserAgent('0.0.1', 'https://secheaders.example.org'),
    budgetMs: 8_000,
    resolver: new MockResolver()
      .set('example.com', [PUBLIC_IP])
      .set('www.example.com', [PUBLIC_IP]),
    connectorFactory: localConnectorFactory({ https: httpsPort, http: httpPort }, trust),
    tlsInspector: localInspector(httpsPort, trust),
    now: () => new Date('2026-11-07T12:00:00Z'),
    ...overrides,
  }
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

async function closedPort(): Promise<number> {
  const server = await startHttpServer(() => undefined)
  const { port } = server
  await server.close()
  return port
}

describe('scan() end to end (02 §2)', () => {
  it('grades a perfect site A+ / 100 and returns the full ScanResult contract', async () => {
    httpsRoute = sendPerfect
    httpRoute = toHttps
    const result = await scan('  example.com ', deps())

    expect(result).toMatchObject({
      schemaVersion: 1,
      scoringVersion: 1,
      scannedAt: '2026-11-07T12:00:00.000Z',
      target: {
        input: 'example.com',
        finalUrl: 'https://example.com/',
        redirectChain: [{ url: 'https://example.com/', status: 200 }],
        httpStatus: 200,
      },
      tls: {
        available: true,
        protocol: 'TLSv1.3',
        authorized: true,
        issuer: 'SecHeaders Lab Test CA',
      },
      score: 100,
      grade: 'A+',
      capsApplied: [],
    })
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.summary.fail + result.summary.warn).toBe(0)
    expect(Object.values(result.summary).reduce((a, b) => a + b, 0)).toBe(result.findings.length)
    expect(result.findings.find((f) => f.id === 'TLS-HTTP-REDIRECT')?.messageKey).toBe(
      'TLS-HTTP-REDIRECT.ok',
    )
  })

  it('ADR-015 redacts cookie values and SC-20 truncates raw header values to 2 KB', async () => {
    httpsRoute = (req, res) => {
      res.setHeader('x-long', 'a'.repeat(5000))
      sendPerfect(req, res)
    }
    httpRoute = toHttps
    const result = await scan('example.com', deps())
    const cookie = result.rawHeaders.find((h) => h.name === 'set-cookie')
    expect(cookie?.value).toBe('__Host-sid=[redacted]; Path=/; Secure; HttpOnly; SameSite=Lax')
    expect(JSON.stringify(result)).not.toContain('__Host-sid=abc')
    expect(result.rawHeaders.find((h) => h.name === 'x-long')?.value).toHaveLength(2048)
  })

  it('follows redirects and inspects TLS on the final host', async () => {
    httpsRoute = (req, res) => {
      if (req.headers.host === 'example.com') redirect(res, 'https://www.example.com/home', 301)
      else sendPerfect(req, res)
    }
    httpRoute = toHttps
    const inspected: string[] = []
    const base = deps()
    const result = await scan('https://example.com/', {
      ...base,
      tlsInspector: (pinned, signal) => {
        inspected.push(pinned.hostname)
        return localInspector(httpsServer.port, ca.cert)(pinned, signal)
      },
    })
    expect(result.target.redirectChain.map((h) => h.status)).toEqual([301, 200])
    expect(result.target.finalUrl).toBe('https://www.example.com/home')
    expect(inspected).toEqual(['www.example.com'])
  })

  it('TLS-HTTP-REDIRECT fails when http:// serves content without redirecting', async () => {
    httpsRoute = sendPerfect
    httpRoute = (_req, res) => res.end('plain')
    const result = await scan('example.com', deps())
    expect(result.findings.find((f) => f.id === 'TLS-HTTP-REDIRECT')).toMatchObject({
      status: 'fail',
      deduction: 10,
    })
    expect(result).toMatchObject({ score: 90, grade: 'A' })
  })

  it('TLS-HTTP-REDIRECT passes when port 80 is closed', async () => {
    httpsRoute = sendPerfect
    const http = await closedPort()
    const result = await scan('example.com', deps({}, { https: 0, http }))
    expect(result.findings.find((f) => f.id === 'TLS-HTTP-REDIRECT')?.messageKey).toBe(
      'TLS-HTTP-REDIRECT.httpUnavailable',
    )
    expect(result.grade).toBe('A+')
  })

  describe('ADR-039 the http:// probe never requests another site', () => {
    const OTHER = 'other.example.net'
    const resolver = () =>
      new MockResolver()
        .set('example.com', [PUBLIC_IP])
        .set('www.example.com', [PUBLIC_IP])
        .set(OTHER, [PUBLIC_IP])
        .set('a.github.io', [PUBLIC_IP])
        .set('b.github.io', [PUBLIC_IP])

    /** Records the Host header of every request the probe or page fetch makes. */
    function recordHosts(next: Handler): { hosts: string[]; handler: Handler } {
      const hosts: string[] = []
      return {
        hosts,
        handler: (req, res) => {
          hosts.push(req.headers.host ?? '')
          next(req, res)
        },
      }
    }

    const redirectFinding = (result: Awaited<ReturnType<typeof scan>>) =>
      result.findings.find((f) => f.id === 'TLS-HTTP-REDIRECT')

    it('follows a same-host http:// hop, then stops at HTTPS → pass', async () => {
      httpsRoute = sendPerfect
      const http = recordHosts((req, res) => {
        if (req.url === '/') redirect(res, 'http://example.com/start', 301)
        else toHttps(req, res)
      })
      httpRoute = http.handler
      const result = await scan('example.com', deps({ resolver: resolver() }))
      expect(http.hosts).toEqual(['example.com', 'example.com'])
      expect(redirectFinding(result)?.messageKey).toBe('TLS-HTTP-REDIRECT.ok')
    })

    it('follows a same-site http:// hop (www) → pass', async () => {
      httpsRoute = sendPerfect
      const http = recordHosts((req, res) => {
        if (req.headers.host === 'example.com') redirect(res, 'http://www.example.com/', 301)
        else toHttps(req, res)
      })
      httpRoute = http.handler
      const result = await scan('example.com', deps({ resolver: resolver() }))
      expect(http.hosts).toEqual(['example.com', 'www.example.com'])
      expect(redirectFinding(result)?.messageKey).toBe('TLS-HTTP-REDIRECT.ok')
    })

    it('stops before an http:// hop to another registrable domain → fail, no request sent', async () => {
      httpsRoute = sendPerfect
      const http = recordHosts((req, res) => {
        if (req.headers.host === 'example.com') redirect(res, `http://${OTHER}/landing`, 302)
        else toHttps(req, res)
      })
      httpRoute = http.handler
      const result = await scan('example.com', deps({ resolver: resolver() }))
      expect(http.hosts).toEqual(['example.com'])
      expect(redirectFinding(result)).toMatchObject({
        status: 'fail',
        deduction: 10,
        messageKey: 'TLS-HTTP-REDIRECT.noRedirect',
        evidence: { detail: `http://${OTHER}/landing` },
      })
    })

    it('stops before an https:// hop to another site without requesting it → otherSite', async () => {
      const https = recordHosts(sendPerfect)
      httpsRoute = https.handler
      httpRoute = (_req, res) => {
        redirect(res, `https://${OTHER}/`, 301)
      }
      const result = await scan('example.com', deps({ resolver: resolver() }))
      expect(https.hosts).not.toContain(OTHER)
      expect(redirectFinding(result)).toMatchObject({
        status: 'fail',
        messageKey: 'TLS-HTTP-REDIRECT.otherSite',
      })
    })

    it('treats tenants of a shared host as different sites (a.github.io → b.github.io)', async () => {
      httpsRoute = sendPerfect
      const http = recordHosts((req, res) => {
        if (req.headers.host === 'a.github.io') redirect(res, 'http://b.github.io/', 301)
        else toHttps(req, res)
      })
      httpRoute = http.handler
      const result = await scan('a.github.io', deps({ resolver: resolver() }))
      expect(http.hosts).toEqual(['a.github.io'])
      expect(redirectFinding(result)?.messageKey).toBe('TLS-HTTP-REDIRECT.noRedirect')
    })
  })

  it('TLS-HTTP-REDIRECT fails when http:// redirects into a blocked target', async () => {
    httpsRoute = sendPerfect
    httpRoute = (_req, res) => {
      redirect(res, 'http://169.254.169.254/')
    }
    const result = await scan('example.com', deps())
    expect(result.findings.find((f) => f.id === 'TLS-HTTP-REDIRECT')?.status).toBe('fail')
  })
})

describe('ADR-013 HTTPS → HTTP fallback', () => {
  it('untrusted certificate: scores the HTTP response and caps at F (CAP-CERT-INVALID)', async () => {
    httpsRoute = sendPerfect
    httpRoute = (_req, res) => {
      res.setHeader('x-content-type-options', 'nosniff')
      res.end('plain')
    }
    const result = await scan('example.com', deps({}, undefined, false))
    expect(result.target.finalUrl).toBe('http://example.com/')
    expect(result.tls).toMatchObject({ available: true, authorized: false })
    expect(result.capsApplied).toContain('CAP-CERT-INVALID')
    expect(result.grade).toBe('F')
  })

  it('port 443 closed: scores HTTP, TLS unavailable → F (CAP-NO-HTTPS), worked example 3', async () => {
    httpRoute = (_req, res) => res.end('plain')
    const https = await closedPort()
    const result = await scan('example.com', deps({}, { https, http: 0 }))
    expect(result.target.finalUrl).toBe('http://example.com/')
    expect(result.tls).toEqual({ available: false })
    expect(result.capsApplied).toEqual(['CAP-NO-HTTPS', 'CAP-NO-CSP'])
    expect(result.grade).toBe('F')
    expect(result.findings.find((f) => f.id === 'HDR-HSTS')?.messageKey).toBe('HDR-HSTS.notHttps')
  })

  it('falls back to http://<host>/ only: the input path and query never travel over HTTP', async () => {
    const seen: string[] = []
    httpRoute = (req, res) => {
      seen.push(req.url ?? '')
      res.end('plain')
    }
    const https = await closedPort()
    const result = await scan(
      'https://example.com/account/reset?token=secret-123&email=user%40example.com',
      deps({}, { https, http: 0 }),
    )
    expect(result.target.finalUrl).toBe('http://example.com/')
    expect(result.target.redirectChain).toEqual([{ url: 'http://example.com/', status: 200 }])
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.every((path) => path === '/')).toBe(true)
    expect(JSON.stringify(result.target.redirectChain)).not.toContain('secret-123')
  })

  it('both HTTPS and HTTP unreachable → TARGET_UNREACHABLE with the HTTPS reason', async () => {
    const https = await closedPort()
    const http = await closedPort()
    const error = await failure(scan('example.com', deps({}, { https, http })))
    expect(error.code).toBe('TARGET_UNREACHABLE')
    expect(error.detail).toBe('CONNECT_FAILED')
  })

  it('does not fall back for an explicit http:// input', async () => {
    httpRoute = (_req, res) => res.end('plain')
    const result = await scan('http://example.com/', deps())
    expect(result.target.redirectChain).toEqual([{ url: 'http://example.com/', status: 200 }])
  })
})

describe('scan() errors (02 §4)', () => {
  it('INVALID_URL before any DNS lookup', async () => {
    const resolver = new MockResolver()
    const error = await failure(scan('http://169.254.169.254/', deps({ resolver })))
    expect(error.code).toBe('INVALID_URL')
    expect(resolver.calls).toEqual([])
  })

  it('BLOCKED_TARGET when the domain resolves to a private address', async () => {
    const error = await failure(
      scan('example.com', deps({ resolver: new MockResolver().set('example.com', ['10.0.0.1']) })),
    )
    expect(error.code).toBe('BLOCKED_TARGET')
  })

  it('DNS_NOT_FOUND for an unknown domain', async () => {
    const error = await failure(scan('nx.example.net', deps()))
    expect(error.code).toBe('DNS_NOT_FOUND')
  })

  it('SC-18 TARGET_TIMEOUT within budget + 500 ms when the target hangs', async () => {
    httpsRoute = () => undefined
    httpRoute = () => undefined
    const started = Date.now()
    const error = await failure(scan('example.com', deps({ budgetMs: 1_000 })))
    expect(error.code).toBe('TARGET_TIMEOUT')
    expect(Date.now() - started).toBeLessThan(1_500)
  })

  it('TARGET_TIMEOUT when TLS inspection runs out of budget', async () => {
    httpsRoute = sendPerfect
    httpRoute = toHttps
    const error = await failure(
      scan(
        'example.com',
        deps({
          tlsInspector: () => Promise.resolve({ available: false, reason: 'BUDGET_EXCEEDED' }),
        }),
      ),
    )
    expect(error).toMatchObject({ code: 'TARGET_TIMEOUT', detail: 'BUDGET_EXCEEDED' })
  })

  it('TARGET_TIMEOUT when only the http:// check hangs past the budget', async () => {
    httpsRoute = sendPerfect
    httpRoute = () => undefined
    const error = await failure(scan('example.com', deps({ budgetMs: 800 })))
    expect(error).toMatchObject({ code: 'TARGET_TIMEOUT', detail: 'BUDGET_EXCEEDED' })
  })

  it('omits TLS summary fields the inspection could not provide', async () => {
    httpsRoute = sendPerfect
    httpRoute = toHttps
    const result = await scan(
      'example.com',
      deps({
        tlsInspector: () =>
          Promise.resolve({
            available: true,
            protocol: null,
            authorized: true,
            authorizationError: null,
            hostnameMatches: true,
            validFrom: null,
            validTo: null,
            issuer: null,
          }),
      }),
    )
    expect(result.tls).toEqual({ available: true, authorized: true })
  })

  it('uses the system clock, resolver and inspector by default (smoke: invalid input never reaches them)', async () => {
    const error = await failure(scan('localhost', { userAgent: 'x', budgetMs: 1_000 }))
    expect(error.code).toBe('INVALID_URL')
  })
})

describe('scan() production defaults (no injected connector or inspector)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the OS resolver by default — which the test network guard blocks', async () => {
    const error = await failure(scan('example.com', { userAgent: 'x', budgetMs: 2_000 }))
    expect(error.code).toBe('TARGET_UNREACHABLE')
    expect(error.detail).toBe('DNS_FAILURE')
  })

  it('pinned connector and real inspectTls dial the validated public IP (rerouted to local servers)', async () => {
    httpsRoute = sendPerfect
    httpRoute = toHttps
    const realNet = net.connect.bind(net)
    const realTls = tls.connect.bind(tls)
    const dialled: string[] = []
    const reroute = (options: unknown, port: number) => {
      const o = options as { host?: string }
      dialled.push(String(o.host))
      return { ...(options as object), host: '127.0.0.1', port }
    }
    vi.spyOn(net, 'connect').mockImplementation(((options: net.NetConnectOpts) =>
      realNet(reroute(options, httpServer.port) as net.NetConnectOpts)) as typeof net.connect)
    vi.spyOn(tls, 'connect').mockImplementation(((options: tls.ConnectionOptions) =>
      realTls({
        ...(reroute(options, httpsServer.port) as tls.ConnectionOptions),
        ca: ca.cert,
      })) as typeof tls.connect)

    const result = await scan('example.com', {
      userAgent: 'x',
      budgetMs: 5_000,
      resolver: new MockResolver().set('example.com', [PUBLIC_IP]),
    })
    expect(result.grade).toBe('A+')
    expect(new Date(result.scannedAt).getTime()).toBeGreaterThan(Date.parse('2026-01-01'))
    expect(new Set(dialled)).toEqual(new Set([PUBLIC_IP]))
  })
})
