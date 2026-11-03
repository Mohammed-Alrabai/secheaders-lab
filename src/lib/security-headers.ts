/**
 * SecHeaders Lab's own response headers (`03` §6). Single source of truth: applied by
 * `next.config.ts` and, in Phase 5, scored by our own checks to prove A+.
 *
 * The nonce-based `script-src`/`style-src` CSP is added per request in Phase 5. Until then
 * the baseline CSP only carries directives that cannot break Next.js rendering.
 */
export const BASELINE_CSP = [
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

export const SECURITY_HEADERS: readonly { key: string; value: string }[] = [
  { key: 'Content-Security-Policy', value: BASELINE_CSP },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    // `interest-cohort=()` is kept as specified in `03` §6; removal is pending approval (T-5).
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
]
