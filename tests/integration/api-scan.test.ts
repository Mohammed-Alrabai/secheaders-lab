import type http from 'node:http'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createScanHandler, methodNotAllowed, type ScanHandlerDeps } from '@/lib/api/scan-handler'
import { TokenBucketLimiter } from '@/lib/rate-limit'
import { ErrorBodySchema, ScanResultSchema } from '@/lib/schemas'
import { scan } from '@/lib/scanner/index'
import { buildUserAgent } from '@/lib/scanner/safe-fetch'
import { inspectTls } from '@/lib/scanner/tls-inspect'
import type { ScanResult } from '@/lib/scanner/types'

import { type Pem, createTestCa, issueLeaf } from '../helpers/certs'
import { PERFECT_HEADERS } from '../helpers/check-input'
import { localConnectorFactory } from '../helpers/local-connector'
import { MockResolver } from '../helpers/mock-resolver'
import { type TestServer, redirect, startHttpServer, startHttpsServer } from '../helpers/servers'

const SITE = 'https://secheaders.example.org'
const PUBLIC_IP = '93.184.215.14'
type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void

let ca: Pem
let httpsServer: TestServer
let httpServer: TestServer
let httpsRoute: Handler = (_req, res) => res.end()
let httpRoute: Handler = (_req, res) => res.end()

beforeAll(async () => {
  ca = await createTestCa()
  const leaf = await issueLeaf(ca, { hostnames: ['example.com'] })
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

/** Real scan() wired to local servers, a mock resolver and a short budget. */
function realScan(budgetMs = 8_000, resolver = new MockResolver().set('example.com', [PUBLIC_IP])) {
  return (url: string) =>
    scan(url, {
      userAgent: buildUserAgent('0.0.1', SITE),
      budgetMs,
      resolver,
      connectorFactory: localConnectorFactory(
        { https: httpsServer.port, http: httpServer.port },
        ca.cert,
      ),
      tlsInspector: (pinned, signal) =>
        inspectTls(
          { ...pinned, address: '127.0.0.1' },
          { signal, port: httpsServer.port, ca: ca.cert },
        ),
    })
}

function handler(overrides: Partial<ScanHandlerDeps> = {}) {
  const logs: string[] = []
  const handle = createScanHandler({
    siteUrl: SITE,
    limiter: new TokenBucketLimiter({ perMinute: 100 }),
    runScan: realScan(),
    log: (line) => logs.push(line),
    ...overrides,
  })
  return { handle, logs }
}

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request(`${SITE}/api/scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: SITE, ...headers },
    body,
  })
}

async function errorCode(response: Response): Promise<string> {
  return ErrorBodySchema.parse(await response.json()).error.code
}

function expectApiHeaders(response: Response): void {
  expect(response.headers.get('cache-control')).toBe('no-store') // SC-27
  expect(response.headers.get('access-control-allow-origin')).toBeNull() // SC-25
}

describe('POST /api/scan — 200 success contract', () => {
  it('returns a validated ScanResult with no-store and logs only SC-37 fields', async () => {
    httpsRoute = (_req, res) => {
      for (const [name, value] of PERFECT_HEADERS) res.appendHeader(name, value)
      res.end()
    }
    httpRoute = (req, res) => {
      redirect(res, `https://example.com${req.url ?? '/'}`, 301)
    }
    const { handle, logs } = handler()
    const response = await handle(post(JSON.stringify({ url: 'example.com/path?secret=1' })))

    expect(response.status).toBe(200)
    expectApiHeaders(response)
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    const body = ScanResultSchema.parse(await response.json())
    expect(body).toMatchObject({ grade: 'A+', score: 100 })

    const log = JSON.parse(logs[0] ?? '') as Record<string, unknown>
    expect(Object.keys(log).sort()).toEqual([
      'durationMs',
      'event',
      'hostname',
      'outcome',
      'ruleCount',
      'ts',
    ])
    expect(log).toMatchObject({ outcome: 'ok', hostname: 'example.com' })
    expect(logs.join('\n')).not.toContain('secret')
  })

  it('accepts a request without Origin (non-browser clients)', async () => {
    const { handle } = handler({ runScan: () => Promise.reject(new Error('unused')) })
    const request = new Request(`${SITE}/api/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: '{"url":"localhost"}',
    })
    expect((await handle(request)).status).toBe(400)
  })
})

describe('POST /api/scan — error codes (02 §4, SC-26)', () => {
  it.each([
    ['not JSON', 'nope'],
    ['missing url', '{}'],
    ['unknown field (SC-23 strict)', '{"url":"example.com","x":1}'],
    ['wrong type', '{"url":42}'],
    ['policy rejection', '{"url":"http://169.254.169.254/"}'],
  ])('400 INVALID_URL — %s', async (_name, body) => {
    const { handle } = handler()
    const response = await handle(post(body))
    expect(response.status).toBe(400)
    expect(await errorCode(response)).toBe('INVALID_URL')
    expectApiHeaders(response)
  })

  it('403 FORBIDDEN_ORIGIN — cross-origin request (SC-25)', async () => {
    const { handle } = handler()
    const response = await handle(
      post('{"url":"example.com"}', { origin: 'https://evil.example.net' }),
    )
    expect(response.status).toBe(403)
    expect(await errorCode(response)).toBe('FORBIDDEN_ORIGIN')
  })

  it('413 PAYLOAD_TOO_LARGE — declared Content-Length over 4 KB', async () => {
    const { handle } = handler()
    const response = await handle(post('{"url":"example.com"}', { 'content-length': '5000' }))
    expect(response.status).toBe(413)
    expect(await errorCode(response)).toBe('PAYLOAD_TOO_LARGE')
  })

  it('413 PAYLOAD_TOO_LARGE — body over 4 KB without a Content-Length', async () => {
    const { handle } = handler()
    const big = JSON.stringify({ url: `example.com/${'a'.repeat(5000)}` })
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(big))
        controller.close()
      },
    })
    const request = new Request(`${SITE}/api/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: SITE },
      body: stream,
      duplex: 'half',
    } as RequestInit)
    const response = await handle(request)
    expect(response.status).toBe(413)
  })

  it('400 INVALID_URL — empty body', async () => {
    const { handle } = handler()
    const request = new Request(`${SITE}/api/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: SITE },
    })
    expect((await handle(request)).status).toBe(400)
  })

  it.each([undefined, 'text/plain', 'application/x-www-form-urlencoded', 'application/jsonp'])(
    '415 UNSUPPORTED_MEDIA_TYPE — content-type %s',
    async (contentType) => {
      const { handle } = handler()
      const headers: Record<string, string> = { origin: SITE }
      if (contentType) headers['content-type'] = contentType
      const response = await handle(
        new Request(`${SITE}/api/scan`, { method: 'POST', headers, body: '{"url":"example.com"}' }),
      )
      expect(response.status).toBe(415)
      expect(await errorCode(response)).toBe('UNSUPPORTED_MEDIA_TYPE')
    },
  )

  it('422 BLOCKED_TARGET — domain resolves to a private address', async () => {
    const { handle } = handler({
      runScan: realScan(8_000, new MockResolver().set('example.com', ['10.0.0.5'])),
    })
    const response = await handle(post('{"url":"example.com"}'))
    expect(response.status).toBe(422)
    expect(await errorCode(response)).toBe('BLOCKED_TARGET')
  })

  it('422 DNS_NOT_FOUND — unknown domain', async () => {
    const { handle } = handler()
    const response = await handle(post('{"url":"nx.example.net"}'))
    expect(response.status).toBe(422)
    expect(await errorCode(response)).toBe('DNS_NOT_FOUND')
  })

  it('429 RATE_LIMITED with Retry-After (SC-24)', async () => {
    const { handle } = handler({
      limiter: new TokenBucketLimiter({ perMinute: 1 }),
      runScan: realScan(),
    })
    httpsRoute = (_req, res) => res.end()
    httpRoute = (_req, res) => res.end()
    const first = await handle(post('{"url":"example.com"}', { 'x-forwarded-for': '198.51.100.1' }))
    expect(first.status).toBe(200)
    const second = await handle(
      post('{"url":"example.com"}', { 'x-forwarded-for': '198.51.100.1' }),
    )
    expect(second.status).toBe(429)
    expect(second.headers.get('retry-after')).toBe('60')
    expect(await errorCode(second)).toBe('RATE_LIMITED')
    const other = await handle(post('{"url":"localhost"}', { 'x-forwarded-for': '198.51.100.2' }))
    expect(other.status).toBe(400)
  })

  it('502 TARGET_UNREACHABLE — nothing listens on 443 or 80', async () => {
    const closed = await startHttpServer(() => undefined)
    const port = closed.port
    await closed.close()
    const { handle } = handler({
      runScan: (url) =>
        scan(url, {
          userAgent: 'x',
          budgetMs: 5_000,
          resolver: new MockResolver().set('example.com', [PUBLIC_IP]),
          connectorFactory: localConnectorFactory({ https: port, http: port }, ca.cert),
          tlsInspector: () => Promise.resolve({ available: false, reason: 'CONNECT_FAILED' }),
        }),
    })
    const response = await handle(post('{"url":"example.com"}'))
    expect(response.status).toBe(502)
    expect(await errorCode(response)).toBe('TARGET_UNREACHABLE')
  })

  it('504 TARGET_TIMEOUT — target never answers within the budget', async () => {
    httpsRoute = () => undefined
    httpRoute = () => undefined
    const { handle } = handler({ runScan: realScan(800) })
    const response = await handle(post('{"url":"example.com"}'))
    expect(response.status).toBe(504)
    expect(await errorCode(response)).toBe('TARGET_TIMEOUT')
  })

  it('500 INTERNAL — unexpected error, logged without its message', async () => {
    const { handle, logs } = handler({
      runScan: () => Promise.reject(new TypeError('boom at https://example.com/?token=abc')),
    })
    const response = await handle(post('{"url":"example.com"}'))
    expect(response.status).toBe(500)
    expect(await errorCode(response)).toBe('INTERNAL')
    expect(logs.join('\n')).not.toContain('token=abc')
    expect(logs.some((l) => l.includes('"internal_error"'))).toBe(true)
  })

  it('500 INTERNAL — a result with unexpected fields never leaves the server (SC-28)', async () => {
    const leaky = { schemaVersion: 1, resolvedIp: PUBLIC_IP } as unknown as ScanResult
    const { handle } = handler({ runScan: () => Promise.resolve(leaky) })
    const response = await handle(post('{"url":"example.com"}'))
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain(PUBLIC_IP)
  })

  it('error bodies never contain stack traces, IPs or upstream text', async () => {
    const { handle } = handler({
      runScan: realScan(8_000, new MockResolver().set('example.com', ['10.0.0.5'])),
    })
    const text = await (await handle(post('{"url":"example.com"}'))).text()
    expect(text).toBe('{"error":{"code":"BLOCKED_TARGET"}}')
  })
})

describe('405 for other methods (02 §4)', () => {
  it('returns 405 with Allow: POST and no body', async () => {
    const response = methodNotAllowed()
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).toBe('')
  })
})
