import type http from 'node:http'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { PinnedAddress } from '@/lib/scanner/dns'
import { ScanError, type ScanErrorCode } from '@/lib/scanner/errors'
import { buildUserAgent, safeFetch, type SafeFetchDeps } from '@/lib/scanner/safe-fetch'
import { inspectTls } from '@/lib/scanner/tls-inspect'

import { type Pem, createTestCa, issueLeaf } from '../helpers/certs'
import { localConnectorFactory } from '../helpers/local-connector'
import { MockResolver } from '../helpers/mock-resolver'
import { type TestServer, redirect, startHttpServer, startHttpsServer } from '../helpers/servers'

/**
 * Mandatory SSRF test matrix (`03` §9). Every case runs through `safeFetch`, the single entry
 * point of the fetch layer. No real network: DNS is a MockResolver and every socket goes to a
 * local server via the test connector (the network guard enforces this).
 */

const PUBLIC_IP = '93.184.215.14'
const IDN = 'xn--r8jz45g.jp'

let ca: Pem
let route: (req: http.IncomingMessage, res: http.ServerResponse) => void = (_req, res) => res.end()
let httpsServer: TestServer
let httpServer: TestServer
let connectLog: { pinned: PinnedAddress; url: string }[] = []

beforeAll(async () => {
  ca = await createTestCa()
  const leaf = await issueLeaf(ca, {
    hostnames: ['example.com', 'public.example.com', 'rebind.example.com', IDN],
  })
  const handler = (req: http.IncomingMessage, res: http.ServerResponse) => {
    route(req, res)
  }
  httpsServer = await startHttpsServer(handler, leaf)
  httpServer = await startHttpServer(handler)
})

afterAll(async () => {
  await Promise.all([httpsServer.close(), httpServer.close()])
})

function deps(resolver: MockResolver, budgetMs = 8_000): SafeFetchDeps {
  connectLog = []
  return {
    resolver,
    signal: AbortSignal.timeout(budgetMs),
    userAgent: buildUserAgent('0.0.1', 'https://secheaders.example.org'),
    connectorFactory: localConnectorFactory(
      { https: httpsServer.port, http: httpServer.port },
      ca.cert,
      connectLog,
    ),
  }
}

function publicResolver(): MockResolver {
  return new MockResolver()
    .set('example.com', [PUBLIC_IP])
    .set('public.example.com', [PUBLIC_IP])
    .set(IDN, [PUBLIC_IP])
}

async function expectRejected(input: string, code: ScanErrorCode, resolver = publicResolver()) {
  let error: unknown
  try {
    await safeFetch(input, deps(resolver))
  } catch (e) {
    error = e
  }
  expect(error, input).toBeInstanceOf(ScanError)
  expect((error as ScanError).code, input).toBe(code)
  return error as ScanError
}

describe('SSRF matrix — input policy (cases 1–11, INVALID_URL, no DNS, no socket)', () => {
  const cases: [number, string, string[]][] = [
    [1, 'SC-08 localhost names', ['http://localhost', 'http://localhost.', 'http://app.localhost']],
    [
      2,
      'SC-06 IPv4 loopback in any encoding',
      [
        'http://127.0.0.1',
        'http://127.1',
        'http://2130706433',
        'http://0x7f000001',
        'http://0177.0.0.1',
      ],
    ],
    [
      3,
      'SC-06 IPv6 loopback literals',
      ['http://[::1]', 'http://[::ffff:127.0.0.1]', 'http://[::ffff:7f00:1]'],
    ],
    [
      4,
      'SC-06 private and unspecified IPv4 literals',
      [
        'http://0.0.0.0',
        'http://10.0.0.1',
        'http://192.168.1.1',
        'http://172.16.0.1',
        'http://100.64.0.1',
      ],
    ],
    [5, 'SC-06 cloud metadata endpoint', ['http://169.254.169.254/latest/meta-data/']],
    [
      6,
      'SC-08 internal suffixes',
      ['http://metadata.google.internal', 'http://printer.local', 'http://server.corp'],
    ],
    [
      7,
      'SC-02 non-web schemes',
      [
        'file:///etc/passwd',
        'ftp://example.com',
        'gopher://example.com',
        'javascript:alert(1)',
        'data:text/html,x',
      ],
    ],
    [8, 'SC-04 credentials', ['https://user:pass@example.com']],
    [9, 'SC-05 non-default ports', ['https://example.com:8443', 'http://example.com:22']],
    [
      10,
      'SC-01 CR/LF injection',
      ['https://example.com/%0d%0aX-Injected:1', 'https://example.com/\r\nX-Injected: 1'],
    ],
    [
      11,
      'SC-01 2,049-character URL',
      [`https://example.com/${'a'.repeat(2049 - 'https://example.com/'.length)}`],
    ],
  ]

  for (const [n, title, inputs] of cases) {
    it(`SSRF-${String(n).padStart(2, '0')} ${title} → INVALID_URL`, async () => {
      for (const input of inputs) {
        const resolver = publicResolver()
        await expectRejected(input, 'INVALID_URL', resolver)
        expect(resolver.calls, input).toEqual([])
        expect(connectLog, input).toEqual([])
      }
    })
  }
})

describe('SSRF matrix — DNS destination policy (cases 12–14, BLOCKED_TARGET, no socket)', () => {
  it('SSRF-12 SC-11 public-looking domain resolving to 10.0.0.5 → BLOCKED_TARGET', async () => {
    await expectRejected(
      'https://evil.example.com/',
      'BLOCKED_TARGET',
      new MockResolver().set('evil.example.com', ['10.0.0.5']),
    )
    expect(connectLog).toEqual([])
  })

  it('SSRF-13 SC-11 mixed answer [93.184.216.34, 127.0.0.1] → BLOCKED_TARGET', async () => {
    await expectRejected(
      'https://mixed.example.com/',
      'BLOCKED_TARGET',
      new MockResolver().set('mixed.example.com', ['93.184.216.34', '127.0.0.1']),
    )
    expect(connectLog).toEqual([])
  })

  it.each(['fd00::1', '::ffff:10.0.0.1'])(
    'SSRF-14 SC-12 IPv6 answer %s → BLOCKED_TARGET',
    async (address) => {
      await expectRejected(
        'https://v6.example.com/',
        'BLOCKED_TARGET',
        new MockResolver().set('v6.example.com', [address]),
      )
      expect(connectLog).toEqual([])
    },
  )
})

describe('SSRF matrix — redirect hops (cases 15–18, SC-17)', () => {
  it('SSRF-15 public target redirecting to http://169.254.169.254/ → BLOCKED_TARGET on hop', async () => {
    route = (_req, res) => {
      redirect(res, 'http://169.254.169.254/latest/meta-data/')
    }
    await expectRejected('https://public.example.com/', 'BLOCKED_TARGET')
    expect(connectLog.map((c) => c.url)).toEqual(['https://public.example.com/'])
  })

  it('SSRF-16 public target redirecting to a domain resolving private → BLOCKED_TARGET on hop', async () => {
    route = (_req, res) => {
      redirect(res, 'https://internal-alias.example.net/')
    }
    const resolver = publicResolver().set('internal-alias.example.net', ['192.168.10.20'])
    await expectRejected('https://public.example.com/', 'BLOCKED_TARGET', resolver)
    expect(resolver.calls).toEqual(['public.example.com', 'internal-alias.example.net'])
    expect(connectLog).toHaveLength(1)
  })

  it('SSRF-16b redirect to a reserved name (http://localhost/) → BLOCKED_TARGET on hop', async () => {
    route = (_req, res) => {
      redirect(res, 'http://localhost/admin')
    }
    await expectRejected('https://public.example.com/', 'BLOCKED_TARGET')
    expect(connectLog).toHaveLength(1)
  })

  it.each(['file:///etc/passwd', 'https://example.com:8080/'])(
    'SSRF-17 redirect to %s → INVALID_URL on hop',
    async (location) => {
      route = (_req, res) => {
        redirect(res, location)
      }
      await expectRejected('https://public.example.com/', 'INVALID_URL')
      expect(connectLog).toHaveLength(1)
    },
  )

  it('SSRF-18 chain of 6 redirects → TARGET_UNREACHABLE (TOO_MANY_REDIRECTS)', async () => {
    route = (req, res) => {
      const n = Number(req.url?.slice(1) ?? '0')
      redirect(res, `/${String(n + 1)}`)
    }
    const error = await expectRejected('https://public.example.com/', 'TARGET_UNREACHABLE')
    expect(error.detail).toBe('TOO_MANY_REDIRECTS')
    expect(connectLog).toHaveLength(6)
  })

  it('SSRF-18 redirect loop → TARGET_UNREACHABLE (REDIRECT_LOOP)', async () => {
    route = (req, res) => {
      redirect(res, req.url === '/a' ? '/b' : '/a')
    }
    const error = await expectRejected('https://public.example.com/a', 'TARGET_UNREACHABLE')
    expect(error.detail).toBe('REDIRECT_LOOP')
  })
})

describe('SSRF matrix — DNS rebinding / IP pinning (case 19, SC-13)', () => {
  it('SSRF-19 lookup #1 public, later lookups private → one resolution, socket uses pinned public IP', async () => {
    route = (_req, res) => res.end('ok')
    const resolver = new MockResolver().set('rebind.example.com', [PUBLIC_IP], ['127.0.0.1'])
    const result = await safeFetch('https://rebind.example.com/', deps(resolver))

    expect(result.status).toBe(200)
    expect(resolver.callsFor('rebind.example.com')).toBe(1)
    expect(connectLog).toHaveLength(1)
    expect(connectLog[0]?.pinned.address).toBe(PUBLIC_IP)
    expect(result.pinned.address).toBe(PUBLIC_IP)

    // TLS inspection takes the pinned address (an IP) and never resolves the hostname. Like
    // the test connector, we dial the local server in place of the public IP.
    const tlsResult = await inspectTls(
      { ...result.pinned, address: '127.0.0.1' },
      { signal: AbortSignal.timeout(3_000), port: httpsServer.port, ca: ca.cert },
    )
    expect(tlsResult).toMatchObject({ available: true, authorized: true, hostnameMatches: true })
    expect(resolver.callsFor('rebind.example.com')).toBe(1)
  })

  it('SSRF-19b a rebind on a later hop is caught because every hop is re-resolved and re-checked', async () => {
    route = (req, res) => {
      if (req.url === '/') redirect(res, '/again')
      else res.end()
    }
    const resolver = new MockResolver().set('rebind.example.com', [PUBLIC_IP], ['127.0.0.1'])
    await expectRejected('https://rebind.example.com/', 'BLOCKED_TARGET', resolver)
    expect(connectLog.map((c) => c.pinned.address)).toEqual([PUBLIC_IP])
  })
})

describe('SSRF matrix — resource limits (cases 20–21, SC-18, SC-19)', () => {
  it('SSRF-20 target that never sends headers → TARGET_TIMEOUT within budget + 500 ms', async () => {
    route = () => undefined // never respond
    const budget = 1_000
    const started = Date.now()
    let error: unknown
    try {
      await safeFetch('https://public.example.com/', deps(publicResolver(), budget))
    } catch (e) {
      error = e
    }
    const elapsed = Date.now() - started
    expect(error).toBeInstanceOf(ScanError)
    expect((error as ScanError).code).toBe('TARGET_TIMEOUT')
    expect(elapsed).toBeLessThan(budget + 500)
  })

  it('SSRF-21 target with a 200 KB body → completes, body is not read', async () => {
    route = (_req, res) => {
      res.setHeader('content-type', 'text/html')
      res.end('x'.repeat(200 * 1024))
    }
    const started = Date.now()
    const result = await safeFetch('https://public.example.com/', deps(publicResolver()))
    expect(result.status).toBe(200)
    expect(result.headers).toContainEqual(['content-type', 'text/html'])
    expect(Date.now() - started).toBeLessThan(2_000)
    // The result carries headers only; there is no body field to buffer into.
    expect(Object.keys(result).sort()).toEqual(['chain', 'finalUrl', 'headers', 'pinned', 'status'])
  })
})

describe('SSRF matrix — untrusted content and accepted inputs (cases 22–24)', () => {
  it('SSRF-22 header value with <script> and bidi bytes is returned as inert text', async () => {
    // HTTP header values are bytes; U+202E (RLO) arrives as its UTF-8 bytes E2 80 AE.
    const rloAsLatin1 = Buffer.from(String.fromCodePoint(0x202e), 'utf8').toString('latin1')
    route = (_req, res) => {
      res.setHeader('x-evil', `<script>alert(1)</script>${rloAsLatin1}gnp.exe`)
      res.end()
    }
    const result = await safeFetch('https://public.example.com/', deps(publicResolver()))
    const value = result.headers.find(([name]) => name === 'x-evil')?.[1]
    expect(typeof value).toBe('string')
    expect(value).toContain('<script>alert(1)</script>')
    // Stripping bidi characters for display is SC-31 in the UI layer (Phase 4, T-11).
    expect(value).toContain('gnp.exe')
  })

  it('SSRF-23 IDN 例え.jp → accepted, resolved and fetched as punycode', async () => {
    route = (_req, res) => res.end()
    const resolver = publicResolver()
    const result = await safeFetch('例え.jp', deps(resolver))
    expect(result.finalUrl.hostname).toBe(IDN)
    expect(resolver.calls).toEqual([IDN])
    expect(httpsServer.requests.at(-1)?.headers.host).toBe(IDN)
  })

  it('SSRF-24 bare example.com → accepted as https://example.com/', async () => {
    route = (_req, res) => res.end()
    const result = await safeFetch('example.com', deps(publicResolver()))
    expect(result.finalUrl.href).toBe('https://example.com/')
    expect(result.chain).toEqual([{ url: 'https://example.com/', status: 200 }])
  })
})
