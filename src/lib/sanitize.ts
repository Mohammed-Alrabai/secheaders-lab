/**
 * Display sanitizer for untrusted upstream text (SC-29…SC-31): header names and values,
 * redirect URLs, certificate issuer, cookie names. Output is rendered as React text only.
 */

// SC-31: bidi embeddings/overrides/isolates (Trojan Source) and invisible direction marks.
// Numeric code points on purpose: the characters themselves must never appear in source.
const BIDI_CONTROLS: ReadonlySet<number> = new Set([
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0x200e, 0x200f, 0x061c,
])

/** U+FFFD, shown in place of a control character so its presence stays visible. */
export const REPLACEMENT = String.fromCharCode(0xfffd)

const TAB = 0x09

/**
 * T-11: HTTP header values are bytes; undici exposes them latin1-decoded. If the bytes form
 * valid UTF-8, decode them so that hidden characters (e.g. U+202E arriving as three latin1
 * characters) become real code points that the filter below can see. Otherwise keep the
 * text as is.
 */
export function decodeLatin1Utf8(value: string): string {
  let hasHigh = false
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code > 0xff) return value // already real Unicode, not a byte string
    if (code >= 0x80) hasHigh = true
  }
  if (!hasHigh) return value
  const bytes = Uint8Array.from(value, (c) => c.charCodeAt(0))
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return value
  }
}

/** Drops bidi controls and replaces other C0/C1 controls (except tab) with U+FFFD. */
function clean(value: string): string {
  let out = ''
  for (const char of value) {
    // Every character acted on is in the BMP, so the first code unit identifies it.
    const code = char.charCodeAt(0)
    if (BIDI_CONTROLS.has(code)) continue
    const isControl = code <= 0x1f || (code >= 0x7f && code <= 0x9f)
    out += isControl && code !== TAB ? REPLACEMENT : char
  }
  return out
}

/** Upstream string → safe display text (decode bytes, drop bidi controls, mark controls). */
export function displayText(value: string): string {
  return clean(decodeLatin1Utf8(value))
}

/** Applies {@link displayText} to every string value in message parameters. */
export function sanitizeParams(
  params: Record<string, string | number> | undefined,
): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(params ?? {})) {
    // defineProperty, not assignment: a "__proto__" key can never touch the prototype.
    Object.defineProperty(out, key, {
      value: typeof value === 'string' ? displayText(value) : value,
      enumerable: true,
    })
  }
  return out
}
