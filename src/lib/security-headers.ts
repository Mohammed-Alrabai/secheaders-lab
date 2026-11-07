/**
 * SecHeaders Lab's own response headers (`03` §6). Single source of truth: the static set is
 * applied by `next.config.ts`; the per-request page CSP is built here and set by `proxy.ts`.
 * A unit test scores this exact set with our own checks and requires 100 / A+ (task 5.4).
 */

export const SECURITY_HEADERS: readonly { key: string; value: string }[] = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // ADR-029: the obsolete `interest-cohort` directive was removed with the user's approval.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
]

/** JSON API responses and static files never need to load anything. */
export const LOCKED_DOWN_CSP =
  "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"

/** Brand SVGs may carry internal `<style>` elements but never scripts. */
export const SVG_CSP = "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"

/** A fresh, unguessable nonce per request (128 bits, base64). */
export function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

/**
 * The page CSP from `03` §6. `style-src-attr 'unsafe-inline'` is approved in ADR-009 for
 * inline style attributes from React/Base UI. In development only, React needs
 * `'unsafe-eval'` for its debugging stacks (Next.js CSP guide); production never has it.
 */
export function buildPageCsp(nonce: string, options: { dev: boolean }): string {
  const n = `'nonce-${nonce}'`
  return [
    "default-src 'self'",
    `script-src 'self' ${n} 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' ${n}`,
    `style-src-elem 'self' ${n}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}
