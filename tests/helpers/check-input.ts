import { HeaderMap } from '@/lib/scanner/header-utils'
import type { TlsInspection } from '@/lib/scanner/tls-inspect'
import type { CheckInput, Finding, HttpRedirectCheck, RuleId } from '@/lib/scanner/types'

export const NOW = new Date('2026-11-07T12:00:00Z')
const DAY = 86_400_000

/** Valid TLS 1.3 with a trusted certificate expiring in `days` days. */
export function validTls(
  days = 90,
  protocol = 'TLSv1.3',
): Extract<TlsInspection, { available: true }> {
  return {
    available: true,
    protocol,
    authorized: true,
    authorizationError: null,
    hostnameMatches: true,
    validFrom: new Date(NOW.getTime() - 30 * DAY).toISOString(),
    validTo: new Date(NOW.getTime() + days * DAY).toISOString(),
    issuer: 'Test CA',
  }
}

export interface InputOptions {
  headers?: [string, string][]
  finalUrl?: string
  inputHostname?: string
  tls?: TlsInspection
  httpRedirect?: HttpRedirectCheck
}

/** Neutral baseline: HTTPS, valid TLS 1.3, http→https redirect OK, no headers. */
export function makeInput(options: InputOptions = {}): CheckInput {
  const finalUrl = new URL(options.finalUrl ?? 'https://example.com/')
  return {
    inputHostname: options.inputHostname ?? 'example.com',
    finalUrl,
    headers: new HeaderMap(options.headers ?? []),
    tls: options.tls ?? validTls(),
    httpRedirect: options.httpRedirect ?? { kind: 'response', finalUrl: 'https://example.com/' },
    now: NOW,
  }
}

/** Picks the single finding for a rule; fails loudly when absent or duplicated. */
export function only(findings: Finding[], id: RuleId): Finding {
  const matches = findings.filter((f) => f.id === id)
  const [match] = matches
  if (matches.length !== 1 || match === undefined) {
    throw new Error(`expected exactly one ${id}, got ${String(matches.length)}`)
  }
  return match
}

/** The headers of worked example 1 (`04` §6): a perfect site. */
export const PERFECT_HEADERS: [string, string][] = [
  ['strict-transport-security', 'max-age=63072000; includeSubDomains; preload'],
  [
    'content-security-policy',
    "default-src 'self'; script-src 'nonce-r4nd0m' 'strict-dynamic'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  ],
  ['x-frame-options', 'DENY'],
  ['x-content-type-options', 'nosniff'],
  ['referrer-policy', 'strict-origin-when-cross-origin'],
  ['permissions-policy', 'camera=(), microphone=(), geolocation=()'],
  ['cross-origin-opener-policy', 'same-origin'],
  ['set-cookie', '__Host-sid=abc; Path=/; Secure; HttpOnly; SameSite=Lax'],
]
