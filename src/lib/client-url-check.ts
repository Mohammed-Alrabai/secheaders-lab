import { MAX_URL_LENGTH, RESERVED_HOST_SUFFIXES } from './scanner/limits'

/** Form error keys, at `home.form.errors.<key>` in the message files. */
export type FormError =
  | 'empty'
  | 'tooLong'
  | 'controlChars'
  | 'scheme'
  | 'credentials'
  | 'port'
  | 'ipLiteral'
  | 'hostname'
  | 'reserved'

const SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:/i
const HOST_PORT_PREFIX = /^[^/?#:@]+:\d+(?:[/?#]|$)/
const ENCODED_CONTROL = /%(?:[01][0-9a-f]|7f)/i
const DIGITS = /^\d{1,3}$/
const LABEL = /^[a-z0-9_-]{1,63}$/

/** WHATWG has already normalized decimal/hex/octal/short IPv4 forms to dotted quads. */
function isDottedIpv4(hostname: string): boolean {
  const parts = hostname.split('.')
  return parts.length === 4 && parts.every((p) => DIGITS.test(p))
}

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return ENCODED_CONTROL.test(value)
}

/**
 * Browser-side mirror of SC-01…SC-08 for instant form feedback. The server policy
 * (`url-policy.ts`) stays authoritative; this never needs DNS and never weakens it.
 */
export function checkUrlInput(raw: string): FormError | null {
  const value = raw.trim()
  if (value.length === 0) return 'empty'
  if (value.length > MAX_URL_LENGTH) return 'tooLong'
  if (hasControlChar(value)) return 'controlChars'

  const hasScheme = SCHEME_PREFIX.test(value) && !HOST_PORT_PREFIX.test(value)
  let url: URL
  try {
    url = new URL(hasScheme ? value : `https://${value}`)
  } catch {
    return 'hostname'
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'scheme'
  if (url.username !== '' || url.password !== '') return 'credentials'
  if (!['', '80', '443'].includes(url.port)) return 'port'

  const hostname = url.hostname.endsWith('.') ? url.hostname.slice(0, -1) : url.hostname
  if (hostname.startsWith('[') || isDottedIpv4(hostname)) return 'ipLiteral'
  if (RESERVED_HOST_SUFFIXES.some((s) => hostname === s || hostname.endsWith(`.${s}`))) {
    return 'reserved'
  }
  const labels = hostname.split('.')
  const shapeOk =
    hostname.length <= 253 &&
    labels.length >= 2 &&
    labels.every((l) => LABEL.test(l) && !l.startsWith('-') && !l.endsWith('-'))
  return shapeOk ? null : 'hostname'
}
