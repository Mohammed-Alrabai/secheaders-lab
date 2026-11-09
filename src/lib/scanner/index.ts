import { runChecks } from './checks/index'
import { type PinnedAddress, type Resolver, resolvePinnedAddress, systemResolver } from './dns'
import { ScanError, type ScanErrorDetail, isScanError } from './errors'
import { HeaderMap, redactSetCookie, truncate } from './header-utils'
import { RAW_HEADER_MAX } from './limits'
import {
  type ConnectorFactory,
  type SafeFetchDeps,
  type SafeFetchResult,
  safeFetch,
} from './safe-fetch'
import { SCORING_VERSION, computeScore } from './scoring'
import { isSameSite } from './site'
import { type TlsInspection, inspectTls } from './tls-inspect'
import type { Finding, HttpRedirectCheck, ScanResult, Status } from './types'
import { normalizeAndValidate } from './url-policy'

export { RAW_HEADER_MAX } from './limits'

/** Transport failures on HTTPS after which plain HTTP is tried (ADR-013). */
const HTTPS_FALLBACK_DETAILS = new Set<ScanErrorDetail | undefined>([
  'TLS_FAILURE',
  'CONNECT_FAILED',
  'CONNECT_TIMEOUT',
])

/** Failures of `http://host/` that mean "port 80 not served" (TLS-HTTP-REDIRECT pass). */
const HTTP_UNREACHABLE_DETAILS = new Set<ScanErrorDetail | undefined>([
  'CONNECT_FAILED',
  'CONNECT_TIMEOUT',
])

export type TlsInspector = (pinned: PinnedAddress, signal: AbortSignal) => Promise<TlsInspection>

export interface ScanDeps {
  /** `SecHeadersLab/<version> (+<site>/about)` (SC-16). */
  userAgent: string
  /** Whole-scan budget in ms (SC-18), from `SCAN_TOTAL_BUDGET_MS`. */
  budgetMs: number
  /** Injected in tests (`03` §9); defaults to the OS resolver. */
  resolver?: Resolver
  /** Injected in tests to reach local servers; defaults to the pinned connector. */
  connectorFactory?: ConnectorFactory
  /** Injected in tests; defaults to {@link inspectTls} on port 443. */
  tlsInspector?: TlsInspector
  /** Clock for `scannedAt` and certificate expiry; defaults to `new Date()`. */
  now?: () => Date
}

const budgetExceeded = () => new ScanError('TARGET_TIMEOUT', 'BUDGET_EXCEEDED')

/**
 * Main page fetch with the HTTPS → HTTP fallback of ADR-013. The fallback requests only
 * `http://<host>/`: the input's path and query may carry tokens and must never be sent
 * in plaintext (ADR-039).
 */
async function fetchPage(url: URL, deps: SafeFetchDeps): Promise<SafeFetchResult> {
  try {
    return await safeFetch(url, deps)
  } catch (error) {
    const canFallBack =
      url.protocol === 'https:' && isScanError(error) && HTTPS_FALLBACK_DETAILS.has(error.detail)
    if (!canFallBack) throw error
    const plain = new URL(`http://${url.hostname}/`)
    try {
      return await safeFetch(plain, deps)
    } catch {
      throw error // TARGET_UNREACHABLE only when both fail (ADR-013)
    }
  }
}

/**
 * TLS-HTTP-REDIRECT input: where does `http://<host>/` lead? (`04` §4.2) The probe stops
 * before the first HTTPS hop and before any hop to another site, so it never sends a
 * request to an unrelated host (ADR-039).
 */
async function checkHttpRedirect(
  hostname: string,
  deps: SafeFetchDeps,
): Promise<HttpRedirectCheck> {
  try {
    const result = await safeFetch(new URL(`http://${hostname}/`), deps, {
      stopBefore: (next) => next.protocol === 'https:' || !isSameSite(next.hostname, hostname),
    })
    return { kind: 'response', finalUrl: result.finalUrl.href }
  } catch (error) {
    if (deps.signal.aborted) throw budgetExceeded()
    if (isScanError(error, 'TARGET_UNREACHABLE') || isScanError(error, 'TARGET_TIMEOUT')) {
      if (HTTP_UNREACHABLE_DETAILS.has(error.detail)) return { kind: 'unreachable' }
    }
    return { kind: 'error' }
  }
}

function summarize(findings: readonly Finding[]): Record<Status, number> {
  const summary: Record<Status, number> = { pass: 0, warn: 0, fail: 0, info: 0 }
  for (const f of findings) summary[f.status] += 1
  return summary
}

function tlsSummary(tls: TlsInspection): ScanResult['tls'] {
  if (!tls.available) return { available: false }
  const out: ScanResult['tls'] = { available: true, authorized: tls.authorized }
  if (tls.protocol !== null) out.protocol = tls.protocol
  if (tls.validTo !== null) out.validTo = tls.validTo
  if (tls.issuer !== null) out.issuer = tls.issuer
  if (tls.key !== null) out.key = { ...tls.key }
  return out
}

/** SC-20 + ADR-015: lowercase names, values truncated, cookie values redacted. */
function rawHeaders(headers: readonly [string, string][]): ScanResult['rawHeaders'] {
  return headers.map(([name, value]) => ({
    name,
    value: truncate(name === 'set-cookie' ? redactSetCookie(value) : value, RAW_HEADER_MAX),
  }))
}

/**
 * One passive scan (`02` §2, FR-02): validate input → fetch the page (≤ 5 validated
 * redirects, HTTPS → HTTP fallback) and `http://host/` in parallel → inspect TLS on the
 * pinned address → run checks → score. The whole run shares one budget (SC-18).
 *
 * Framework-agnostic (ADR-002): no Next.js imports; every external effect is injectable.
 *
 * @throws {ScanError} with a public code from `02` §4.
 */
export async function scan(input: string, deps: ScanDeps): Promise<ScanResult> {
  const started = performance.now()
  const now = deps.now ?? (() => new Date())
  const url = normalizeAndValidate(input) // SC-01…SC-09, before any network activity

  // One controller for the whole scan: the budget, plus cancelling stragglers on exit.
  const controller = new AbortController()
  const signal = AbortSignal.any([AbortSignal.timeout(deps.budgetMs), controller.signal])
  const resolver = deps.resolver ?? systemResolver
  const fetchDeps: SafeFetchDeps = {
    resolver,
    signal,
    userAgent: deps.userAgent,
    ...(deps.connectorFactory ? { connectorFactory: deps.connectorFactory } : {}),
  }
  const inspector: TlsInspector =
    deps.tlsInspector ?? ((pinned, s) => inspectTls(pinned, { signal: s }))

  try {
    const [page, httpRedirect] = await Promise.all([
      fetchPage(url, fetchDeps),
      checkHttpRedirect(url.hostname, fetchDeps),
    ])

    // TLS is inspected where HTTPS was actually served; otherwise on the requested host.
    const tlsTarget =
      page.finalUrl.protocol === 'https:'
        ? page.pinned
        : await resolvePinnedAddress(url.hostname, resolver, signal)
    const tls = await inspector(tlsTarget, signal)
    if (signal.aborted || (!tls.available && tls.reason === 'BUDGET_EXCEEDED')) {
      throw budgetExceeded()
    }

    const findings = runChecks({
      inputHostname: url.hostname,
      finalUrl: page.finalUrl,
      headers: new HeaderMap(page.headers),
      tls,
      httpRedirect,
      now: now(),
    })
    const { score, grade, capsApplied } = computeScore(findings)

    return {
      schemaVersion: 1,
      scoringVersion: SCORING_VERSION,
      scannedAt: now().toISOString(),
      durationMs: Math.round(performance.now() - started),
      target: {
        input: input.trim(),
        finalUrl: page.finalUrl.href,
        redirectChain: page.chain,
        httpStatus: page.status,
      },
      tls: tlsSummary(tls),
      score,
      grade,
      capsApplied,
      summary: summarize(findings),
      findings,
      rawHeaders: rawHeaders(page.headers),
    }
  } catch (error) {
    // Only the budget can have aborted `signal` here; `controller` aborts in `finally`.
    if (signal.aborted) throw budgetExceeded()
    throw error
  } finally {
    controller.abort() // SC-18: no request outlives the scan
  }
}
