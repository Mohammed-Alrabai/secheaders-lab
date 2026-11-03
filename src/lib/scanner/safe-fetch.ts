import { Client, buildConnector } from 'undici'

import { type PinnedAddress, type Resolver, resolvePinnedAddress } from './dns'
import { ScanError, type ScanErrorDetail } from './errors'
import { assertUrlPolicy, normalizeAndValidate, resolveRedirectTarget } from './url-policy'

/** SC-17: maximum number of redirects followed. */
export const MAX_REDIRECTS = 5
/** SC-18: TCP/TLS connect timeout per hop. */
export const CONNECT_TIMEOUT_MS = 3_000
/** SC-18: time allowed for response headers per hop. */
export const HEADERS_TIMEOUT_MS = 4_000
/** SC-20: total response header bytes accepted by the parser. */
export const MAX_HEADER_BYTES = 64 * 1024
/** SC-20: response header entries kept. */
export const MAX_KEPT_HEADERS = 100

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

/** A function that opens the socket for one hop. See {@link createPinnedConnector}. */
export type Connector = buildConnector.connector

/** Builds the connector for a hop from its validated address. Injected in tests. */
export type ConnectorFactory = (pinned: PinnedAddress, url: URL) => Connector

export interface PinnedConnectorOptions {
  /** The validated IP to connect to (SC-13). */
  address: string
  /** Hostname for TLS SNI and certificate verification. */
  servername: string
  /** Test-only port override; production always uses the URL's port. */
  port?: number
  /** Test-only extra trust anchors; production uses the system store. */
  ca?: string
}

/**
 * SC-13: a connector that dials the pre-validated IP and never resolves the hostname again,
 * so a DNS answer cannot change between check and connect. TLS keeps full validation
 * (SC-21) against `servername`.
 */
export function createPinnedConnector(options: PinnedConnectorOptions): Connector {
  const base = buildConnector({
    timeout: CONNECT_TIMEOUT_MS,
    rejectUnauthorized: true,
    maxCachedSessions: 0,
    ...(options.ca === undefined ? {} : { ca: options.ca }),
  })
  return (connectOptions, callback) => {
    const pinned: buildConnector.Options = {
      ...connectOptions,
      hostname: options.address,
      port: options.port === undefined ? connectOptions.port : String(options.port),
    }
    if (connectOptions.protocol === 'https:') pinned.servername = options.servername
    else delete pinned.servername
    base(pinned, callback)
  }
}

const defaultConnectorFactory: ConnectorFactory = (pinned, url) =>
  createPinnedConnector({ address: pinned.address, servername: url.hostname })

/** SC-16: the User-Agent string, `SecHeadersLab/<version> (+<site>/about)`. */
export function buildUserAgent(version: string, siteUrl: string): string {
  return `SecHeadersLab/${version} (+${siteUrl}/about)`
}

export interface SafeFetchDeps {
  resolver: Resolver
  /** One signal for the whole scan budget (SC-18). */
  signal: AbortSignal
  userAgent: string
  connectorFactory?: ConnectorFactory
}

export interface Hop {
  url: string
  status: number
}

export interface SafeFetchResult {
  finalUrl: URL
  status: number
  /** Every response in order, including the final one (FR-08). */
  chain: Hop[]
  /** Final response headers: lowercase names, original order, at most 100 entries. */
  headers: [string, string][]
  /** Address the final response came from; reused by TLS inspection (no second lookup). */
  pinned: PinnedAddress
}

const TIMEOUT_CODES = new Map<string, ScanErrorDetail>([
  ['UND_ERR_CONNECT_TIMEOUT', 'CONNECT_TIMEOUT'],
  ['UND_ERR_HEADERS_TIMEOUT', 'HEADERS_TIMEOUT'],
  ['UND_ERR_BODY_TIMEOUT', 'HEADERS_TIMEOUT'],
])

function errorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) return ''
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : ''
}

/** True for certificate / handshake failures (used for the HTTPS → HTTP fallback, ADR-013). */
function isTlsError(code: string): boolean {
  return (
    code.startsWith('ERR_TLS_') ||
    code.startsWith('ERR_SSL_') ||
    code.startsWith('CERT_') ||
    code.includes('SELF_SIGNED') ||
    code.startsWith('UNABLE_TO_') ||
    code === 'EPROTO'
  )
}

/**
 * SC-26: maps transport errors to public codes; upstream messages are dropped.
 * Exported for unit tests.
 */
export function mapTransportError(error: unknown, signal: AbortSignal): ScanError {
  if (error instanceof ScanError) return error
  if (signal.aborted) return new ScanError('TARGET_TIMEOUT', 'BUDGET_EXCEEDED')
  const code = errorCode(error)
  const timeout = TIMEOUT_CODES.get(code)
  if (timeout) return new ScanError('TARGET_TIMEOUT', timeout)
  if (code === 'UND_ERR_HEADERS_OVERFLOW') {
    return new ScanError('TARGET_UNREACHABLE', 'HEADERS_TOO_LARGE')
  }
  if (isTlsError(code)) return new ScanError('TARGET_UNREACHABLE', 'TLS_FAILURE')
  // undici 8 raises `HTTPParserError` without a `code` for malformed responses.
  if (code.startsWith('HPE_') || (error instanceof Error && error.name === 'HTTPParserError')) {
    return new ScanError('TARGET_UNREACHABLE', 'PROTOCOL_ERROR')
  }
  return new ScanError('TARGET_UNREACHABLE', 'CONNECT_FAILED')
}

/**
 * Turns undici's header record into ordered `[name, value]` pairs, expanding repeated
 * headers, capped at {@link MAX_KEPT_HEADERS} (SC-20). Exported for unit tests.
 */
export function flattenHeaders(
  raw: Record<string, string | string[] | undefined>,
): [string, string][] {
  const out: [string, string][] = []
  for (const [name, value] of Object.entries(raw)) {
    if (value === undefined) continue
    for (const v of Array.isArray(value) ? value : [value]) {
      if (out.length >= MAX_KEPT_HEADERS) return out // SC-20
      out.push([name.toLowerCase(), v])
    }
  }
  return out
}

async function requestOnce(
  url: URL,
  pinned: PinnedAddress,
  deps: SafeFetchDeps,
): Promise<{ status: number; headers: Record<string, string | string[] | undefined> }> {
  const factory = deps.connectorFactory ?? defaultConnectorFactory
  const client = new Client(url.origin, {
    connect: factory(pinned, url),
    headersTimeout: HEADERS_TIMEOUT_MS, // SC-18
    bodyTimeout: HEADERS_TIMEOUT_MS,
    maxHeaderSize: MAX_HEADER_BYTES, // SC-20
    pipelining: 1,
  })
  try {
    const response = await client.request({
      path: `${url.pathname}${url.search}`,
      method: 'GET', // SC-15: GET only, no body
      // SC-16: fixed headers only; nothing from the incoming request is forwarded.
      // SC-22: no cookie jar, so no Cookie header is ever sent.
      headers: {
        'user-agent': deps.userAgent,
        accept: 'text/html,*/*;q=0.8',
        'accept-language': 'en',
      },
      signal: deps.signal,
    })
    // SC-19: headers only; drop the body without reading it.
    response.body.on('error', () => undefined)
    response.body.destroy()
    return { status: response.statusCode, headers: response.headers }
  } catch (error) {
    throw mapTransportError(error, deps.signal)
  } finally {
    client.destroy().catch(() => undefined)
  }
}

function locationOf(headers: Record<string, string | string[] | undefined>): string | undefined {
  const value = headers.location
  return Array.isArray(value) ? value[0] : value
}

/**
 * Passive fetch of a user-supplied URL with every SSRF control applied (`03` §1–§3).
 * Each hop is re-validated (URL policy, DNS, IP policy) and connected to its pinned IP.
 *
 * @throws {ScanError} `INVALID_URL`, `BLOCKED_TARGET`, `DNS_NOT_FOUND`, `TARGET_UNREACHABLE`
 *   or `TARGET_TIMEOUT`.
 */
export async function safeFetch(
  input: string | URL,
  deps: SafeFetchDeps,
): Promise<SafeFetchResult> {
  let url = typeof input === 'string' ? normalizeAndValidate(input) : assertUrlPolicy(input)
  const visited = new Set<string>()
  const chain: Hop[] = []

  for (let hop = 0; ; hop++) {
    if (visited.has(url.href)) throw new ScanError('TARGET_UNREACHABLE', 'REDIRECT_LOOP') // SC-17
    visited.add(url.href)

    const pinned = await resolvePinnedAddress(url.hostname, deps.resolver, deps.signal)
    const { status, headers } = await requestOnce(url, pinned, deps)
    chain.push({ url: url.href, status })

    const location = REDIRECT_STATUSES.has(status) ? locationOf(headers) : undefined
    if (location === undefined) {
      return { finalUrl: url, status, chain, headers: flattenHeaders(headers), pinned }
    }
    if (hop >= MAX_REDIRECTS) throw new ScanError('TARGET_UNREACHABLE', 'TOO_MANY_REDIRECTS')
    url = nextHop(location, url)
  }
}

/**
 * SC-17: re-applies the full input policy to a redirect target. A hop to an IP literal or
 * reserved name is the *target* steering us somewhere forbidden, so it is reported as
 * `BLOCKED_TARGET` (`03` §9 case 15); other policy failures stay `INVALID_URL` (case 17).
 */
function nextHop(location: string, current: URL): URL {
  try {
    return resolveRedirectTarget(location, current)
  } catch (error) {
    if (
      error instanceof ScanError &&
      (error.detail === 'IP_LITERAL' || error.detail === 'RESERVED_NAME')
    ) {
      throw new ScanError('BLOCKED_TARGET', error.detail)
    }
    throw error
  }
}
