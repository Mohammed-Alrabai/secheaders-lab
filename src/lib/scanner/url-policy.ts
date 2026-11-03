import { isIP } from 'node:net'

import ipaddr from 'ipaddr.js'

import { ScanError } from './errors'

/** SC-01: maximum accepted URL length (after trimming). */
export const MAX_URL_LENGTH = 2048

/** SC-05: only default ports may be targeted. */
const ALLOWED_PORTS = new Set(['', '80', '443'])

/** SC-02: only plain web schemes. */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * SC-08: reserved / internal names and suffixes. A hostname is rejected if it equals one of
 * these or ends with `.<suffix>`. `example.com/.net/.org` are public and stay allowed.
 */
export const RESERVED_HOST_SUFFIXES: readonly string[] = [
  'localhost',
  'local',
  'internal',
  'intranet',
  'lan',
  'home.arpa',
  'corp',
  'test',
  'invalid',
  'example',
  'onion',
  'arpa',
]

// SC-01: percent-encoded control characters (covers encoded CR/LF header injection).
const ENCODED_CONTROL_CHARS = /%(?:[01][0-9a-f]|7f)/i

// An explicit scheme is present when the input starts with `name:` and that colon is not
// just a `host:port` separator (e.g. `example.com:443/path`).
const SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:/i
const HOST_PORT_PREFIX = /^[^/?#:@]+:\d+(?:[/?#]|$)/

const LABEL_CHARS = /^[a-z0-9_-]+$/

/**
 * SC-07: an LDH label (plus `_`, used by some real hostnames) of 1–63 characters that does
 * not start or end with a hyphen. Punycode `xn--` labels qualify.
 */
function isValidLabel(label: string): boolean {
  return (
    label.length >= 1 &&
    label.length <= 63 &&
    LABEL_CHARS.test(label) &&
    !label.startsWith('-') &&
    !label.endsWith('-')
  )
}

function reject(detail: ConstructorParameters<typeof ScanError>[1]): never {
  throw new ScanError('INVALID_URL', detail)
}

/** SC-01: rejects raw `\x00–\x1F`, `\x7F` and their percent-encoded forms. */
function assertNoControlChars(value: string): void {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) reject('CONTROL_CHARS')
  }
  if (ENCODED_CONTROL_CHARS.test(value)) reject('CONTROL_CHARS')
}

function isIpLiteral(hostname: string): boolean {
  if (hostname.startsWith('[')) return true
  return isIP(hostname) !== 0 || ipaddr.isValid(hostname)
}

function assertHostname(url: URL): void {
  // SC-07: strip a single trailing dot before any check.
  if (url.hostname.endsWith('.')) url.hostname = url.hostname.slice(0, -1)
  const hostname = url.hostname

  // SC-06: WHATWG already normalized decimal/hex/octal/short IPv4 forms into dotted quads.
  if (isIpLiteral(hostname)) reject('IP_LITERAL')

  // SC-08 before the shape check, so `localhost` is reported as reserved, not malformed.
  if (RESERVED_HOST_SUFFIXES.some((s) => hostname === s || hostname.endsWith(`.${s}`))) {
    reject('RESERVED_NAME')
  }

  const labels = hostname.split('.')
  if (
    hostname.length === 0 ||
    hostname.length > 253 ||
    labels.length < 2 ||
    !labels.every(isValidLabel)
  ) {
    reject('HOSTNAME_SHAPE')
  }
}

/**
 * Applies SC-02 (scheme), SC-04…SC-09 to an already-parsed URL and returns a normalized copy
 * (no fragment, no trailing dot). Used for user input and for every redirect hop (SC-17).
 *
 * @throws {ScanError} `INVALID_URL` with an internal detail.
 */
export function assertUrlPolicy(input: URL): URL {
  const url = new URL(input.href)
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) reject('SCHEME') // SC-02
  if (url.username !== '' || url.password !== '') reject('CREDENTIALS') // SC-04
  if (!ALLOWED_PORTS.has(url.port)) reject('PORT') // SC-05
  assertHostname(url) // SC-06, SC-07, SC-08
  if (url.href.length > MAX_URL_LENGTH) reject('TOO_LONG')
  url.hash = '' // SC-09
  return url
}

/**
 * Normalizes and validates user input (SC-01…SC-09). A bare domain gets `https://`.
 *
 * @example normalizeAndValidate('example.com').href === 'https://example.com/'
 * @throws {ScanError} `INVALID_URL` with an internal detail.
 */
export function normalizeAndValidate(input: unknown): URL {
  if (typeof input !== 'string') reject('INPUT_TYPE')
  const trimmed = input.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) reject('TOO_LONG') // SC-01
  assertNoControlChars(trimmed) // SC-01

  // SC-02: no scheme → https://
  const hasScheme = SCHEME_PREFIX.test(trimmed) && !HOST_PORT_PREFIX.test(trimmed)
  const candidate = hasScheme ? trimmed : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(candidate) // SC-03
  } catch {
    reject('PARSE')
  }
  return assertUrlPolicy(url)
}

/**
 * Resolves a redirect `Location` against the current URL and re-applies the full input
 * policy to the result (SC-17).
 *
 * @throws {ScanError} `INVALID_URL` with an internal detail.
 */
export function resolveRedirectTarget(location: string, base: URL): URL {
  if (location.length === 0 || location.length > MAX_URL_LENGTH) reject('TOO_LONG')
  assertNoControlChars(location)
  let url: URL
  try {
    url = new URL(location, base)
  } catch {
    reject('PARSE')
  }
  return assertUrlPolicy(url)
}
