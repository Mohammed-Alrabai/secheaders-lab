/**
 * Response header parsing for the checks (`04` §1). Pure functions, no I/O.
 * All inputs are untrusted upstream text; parsers never throw.
 */

/** Headers that may legitimately repeat and are not reported by HDR-DUPLICATE. */
const REPEATABLE_HEADERS = new Set([
  'set-cookie',
  'content-security-policy',
  'content-security-policy-report-only',
])

/** Case-insensitive, order-preserving multi-map of response headers. */
export class HeaderMap {
  private readonly entries: readonly (readonly [string, string])[]

  constructor(entries: readonly (readonly [string, string])[]) {
    this.entries = entries.map(([name, value]) => [name.toLowerCase(), value] as const)
  }

  /** First value of a header (`04` §1 default rule), or undefined. */
  get(name: string): string | undefined {
    const key = name.toLowerCase()
    return this.entries.find(([n]) => n === key)?.[1]
  }

  getAll(name: string): string[] {
    const key = name.toLowerCase()
    return this.entries.filter(([n]) => n === key).map(([, v]) => v)
  }

  has(name: string): boolean {
    return this.get(name) !== undefined
  }

  /** Header names that appear more than once, excluding legitimately repeated ones. */
  duplicates(): string[] {
    const counts = new Map<string, number>()
    for (const [name] of this.entries) counts.set(name, (counts.get(name) ?? 0) + 1)
    return [...counts]
      .filter(([name, count]) => count > 1 && !REPEATABLE_HEADERS.has(name))
      .map(([name]) => name)
  }

  toArray(): [string, string][] {
    return this.entries.map(([n, v]) => [n, v])
  }
}

function unquote(value: string): string {
  const v = value.trim()
  return v.length >= 2 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v
}

// ---------------------------------------------------------------- HSTS (RFC 6797)

export interface Hsts {
  /** Seconds, or null when missing, unparsable or duplicated. */
  maxAge: number | null
  includeSubDomains: boolean
  preload: boolean
}

export function parseHsts(value: string): Hsts {
  let maxAge: number | null = null
  let maxAgeSeen = 0
  let includeSubDomains = false
  let preload = false
  for (const part of value.split(';')) {
    const [rawName = '', ...rest] = part.split('=')
    const name = rawName.trim().toLowerCase()
    if (name === 'max-age') {
      maxAgeSeen++
      const digits = unquote(rest.join('='))
      maxAge = /^\d{1,15}$/.test(digits) ? Number(digits) : null
    } else if (name === 'includesubdomains') {
      includeSubDomains = true
    } else if (name === 'preload') {
      preload = true
    }
  }
  // RFC 6797 §6.1: a repeated directive makes the header invalid.
  return { maxAge: maxAgeSeen === 1 ? maxAge : null, includeSubDomains, preload }
}

// ---------------------------------------------------------------- CSP

/** One policy: directive name (lowercase) → source tokens. First occurrence wins. */
export type CspPolicy = ReadonlyMap<string, readonly string[]>

/** Parses one header value; commas separate multiple policies (CSP3 §2.2). */
export function parseCsp(value: string): CspPolicy[] {
  const policies: CspPolicy[] = []
  for (const serialized of value.split(',')) {
    const policy = new Map<string, string[]>()
    for (const directive of serialized.split(';')) {
      const [name, ...sources] = directive.trim().split(/\s+/)
      if (!name) continue
      const key = name.toLowerCase()
      if (!policy.has(key)) policy.set(key, sources)
    }
    if (policy.size > 0) policies.push(policy)
  }
  return policies
}

const NONCE_OR_HASH = /^'(?:nonce-|sha256-|sha384-|sha512-)/i

/** Sources governing scripts: `script-src`, else `default-src`, else undefined. */
export function scriptSources(policy: CspPolicy): readonly string[] | undefined {
  return policy.get('script-src') ?? policy.get('default-src')
}

export function hasNonceOrHash(sources: readonly string[]): boolean {
  return sources.some((s) => NONCE_OR_HASH.test(s))
}

export function hasKeyword(sources: readonly string[], keyword: string): boolean {
  const k = keyword.toLowerCase()
  return sources.some((s) => s.toLowerCase() === k)
}

// ---------------------------------------------------------------- Set-Cookie

export interface CookieAttributes {
  /** Cookie name only; the value is discarded on parse (`04` §4.3). */
  name: string
  secure: boolean
  httpOnly: boolean
  /** Lowercased SameSite value, or undefined when absent. */
  sameSite: string | undefined
  path: string | undefined
  domain: string | undefined
}

export function parseSetCookie(header: string): CookieAttributes {
  const [pair = '', ...attributes] = header.split(';')
  const eq = pair.indexOf('=')
  const cookie: CookieAttributes = {
    name: (eq === -1 ? '' : pair.slice(0, eq)).trim(),
    secure: false,
    httpOnly: false,
    sameSite: undefined,
    path: undefined,
    domain: undefined,
  }
  for (const attribute of attributes) {
    const i = attribute.indexOf('=')
    const key = (i === -1 ? attribute : attribute.slice(0, i)).trim().toLowerCase()
    const val = i === -1 ? '' : attribute.slice(i + 1).trim()
    if (key === 'secure') cookie.secure = true
    else if (key === 'httponly') cookie.httpOnly = true
    else if (key === 'samesite') cookie.sameSite = val.toLowerCase()
    else if (key === 'path') cookie.path = val
    else if (key === 'domain') cookie.domain = val
  }
  return cookie
}

/** `name=[redacted]; attributes…` for display (ADR-015): values never leave the scanner. */
export function redactSetCookie(header: string): string {
  const semi = header.indexOf(';')
  const pair = semi === -1 ? header : header.slice(0, semi)
  const eq = pair.indexOf('=')
  const name = (eq === -1 ? '' : pair.slice(0, eq)).trim()
  return `${name}=[redacted]${semi === -1 ? '' : header.slice(semi)}`
}

// ---------------------------------------------------------------- Referrer-Policy

export const REFERRER_POLICIES = [
  'no-referrer',
  'no-referrer-when-downgrade',
  'origin',
  'origin-when-cross-origin',
  'same-origin',
  'strict-origin',
  'strict-origin-when-cross-origin',
  'unsafe-url',
] as const

export type ReferrerPolicy = (typeof REFERRER_POLICIES)[number]

function isReferrerPolicy(token: string): token is ReferrerPolicy {
  return (REFERRER_POLICIES as readonly string[]).includes(token)
}

/** The last valid token wins (Referrer Policy §11.1); undefined when none is valid. */
export function parseReferrerPolicy(value: string): ReferrerPolicy | undefined {
  const tokens = value.split(',').map((t) => t.trim().toLowerCase())
  return tokens.filter(isReferrerPolicy).at(-1)
}

// ---------------------------------------------------------------- X-Frame-Options

export type FrameOption = 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM' | 'INVALID'

/** First token of X-Frame-Options, normalized. */
export function parseFrameOptions(value: string): FrameOption {
  const token = (value.split(',')[0] ?? '').trim().toUpperCase()
  if (token === 'DENY' || token === 'SAMEORIGIN') return token
  if (token.startsWith('ALLOW-FROM')) return 'ALLOW-FROM'
  return 'INVALID'
}

// ---------------------------------------------------------------- display helpers

/** SC-20 / `02` §4: truncate for display without splitting a surrogate pair. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  const last = value.charCodeAt(max - 1)
  const isHighSurrogate = last >= 0xd800 && last <= 0xdbff
  return value.slice(0, isHighSurrogate ? max - 1 : max)
}
