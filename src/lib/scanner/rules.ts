import type { Category, RuleId, Severity } from './types'

export interface Reference {
  label: string
  url: string
}

export interface RuleMeta {
  category: Category
  /** Highest severity the rule can produce (`04` §4); drives methodology ordering. */
  maxSeverity: Severity
  /** Highest deduction the rule can produce, after its own cap. */
  maxDeduction: number
  references: readonly Reference[]
}

// Every URL below was verified to load the named page on 2026-11-07 (`CLAUDE.md` §6).
// OWASP ASVS section IDs are intentionally absent: TODO(verify-ref) — add only after
// verifying them against the official ASVS repository.
const MDN = 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers'
const CHEATSHEETS = 'https://cheatsheetseries.owasp.org/cheatsheets'

const REF = {
  secureHeaders: {
    label: 'OWASP Secure Headers Project',
    url: 'https://owasp.org/www-project-secure-headers/',
  },
  headersCs: {
    label: 'OWASP HTTP Headers Cheat Sheet',
    url: `${CHEATSHEETS}/HTTP_Headers_Cheat_Sheet.html`,
  },
  cspCs: {
    label: 'OWASP Content Security Policy Cheat Sheet',
    url: `${CHEATSHEETS}/Content_Security_Policy_Cheat_Sheet.html`,
  },
  hstsCs: {
    label: 'OWASP HTTP Strict Transport Security Cheat Sheet',
    url: `${CHEATSHEETS}/HTTP_Strict_Transport_Security_Cheat_Sheet.html`,
  },
  sessionCs: {
    label: 'OWASP Session Management Cheat Sheet',
    url: `${CHEATSHEETS}/Session_Management_Cheat_Sheet.html`,
  },
  tlsCs: {
    label: 'OWASP Transport Layer Security Cheat Sheet',
    url: `${CHEATSHEETS}/Transport_Layer_Security_Cheat_Sheet.html`,
  },
  clickjackingCs: {
    label: 'OWASP Clickjacking Defense Cheat Sheet',
    url: `${CHEATSHEETS}/Clickjacking_Defense_Cheat_Sheet.html`,
  },
  mdnTls: {
    label: 'MDN: Transport Layer Security',
    url: 'https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security',
  },
  mdn: (header: string, label = header) => ({ label: `MDN: ${label}`, url: `${MDN}/${header}` }),
} as const

/**
 * Registry: RuleId → metadata (`04` §4, §7). Text lives in `messages/*.json`. Typed as a
 * Record so a missing rule is a compile error; read it through {@link ruleMeta}.
 */
const RULES: Readonly<Record<RuleId, RuleMeta>> = {
  'HDR-HSTS': {
    category: 'headers',
    maxSeverity: 'high',
    maxDeduction: 20,
    references: [REF.mdn('Strict-Transport-Security'), REF.hstsCs, REF.secureHeaders],
  },
  'HDR-CSP': {
    category: 'headers',
    maxSeverity: 'high',
    maxDeduction: 20,
    references: [
      REF.mdn('Content-Security-Policy'),
      REF.mdn('Content-Security-Policy/base-uri', 'CSP base-uri'),
      REF.cspCs,
      REF.secureHeaders,
    ],
  },
  'HDR-FRAME': {
    category: 'headers',
    maxSeverity: 'medium',
    maxDeduction: 10,
    references: [
      REF.mdn('X-Frame-Options'),
      REF.mdn('Content-Security-Policy/frame-ancestors', 'CSP frame-ancestors'),
      REF.clickjackingCs,
    ],
  },
  'HDR-XCTO': {
    category: 'headers',
    maxSeverity: 'medium',
    maxDeduction: 8,
    references: [REF.mdn('X-Content-Type-Options'), REF.headersCs],
  },
  'HDR-REFERRER': {
    category: 'headers',
    maxSeverity: 'medium',
    maxDeduction: 5,
    references: [REF.mdn('Referrer-Policy'), REF.headersCs],
  },
  'HDR-PERMISSIONS': {
    category: 'headers',
    maxSeverity: 'low',
    maxDeduction: 3,
    references: [REF.mdn('Permissions-Policy'), REF.headersCs],
  },
  'HDR-COOP': {
    category: 'headers',
    maxSeverity: 'info',
    maxDeduction: 0,
    references: [REF.mdn('Cross-Origin-Opener-Policy'), REF.headersCs],
  },
  'HDR-XXSS': {
    category: 'headers',
    maxSeverity: 'info',
    maxDeduction: 0,
    references: [REF.mdn('X-XSS-Protection'), REF.headersCs],
  },
  'HDR-DUPLICATE': {
    category: 'headers',
    maxSeverity: 'info',
    maxDeduction: 0,
    references: [REF.headersCs],
  },
  'TLS-AVAILABLE': {
    category: 'tls',
    maxSeverity: 'critical',
    maxDeduction: 30,
    references: [REF.mdnTls, REF.tlsCs],
  },
  'TLS-CERT-VALID': {
    category: 'tls',
    maxSeverity: 'critical',
    maxDeduction: 30,
    references: [REF.mdnTls, REF.tlsCs],
  },
  'TLS-CERT-EXPIRY': {
    category: 'tls',
    maxSeverity: 'high',
    maxDeduction: 10,
    references: [REF.tlsCs],
  },
  'TLS-PROTOCOL': {
    category: 'tls',
    maxSeverity: 'high',
    maxDeduction: 15,
    references: [REF.mdnTls, REF.tlsCs],
  },
  'TLS-HTTP-REDIRECT': {
    category: 'tls',
    maxSeverity: 'medium',
    maxDeduction: 10,
    references: [REF.hstsCs, REF.tlsCs],
  },
  'CK-SECURE': {
    category: 'cookies',
    maxSeverity: 'medium',
    maxDeduction: 10,
    references: [REF.mdn('Set-Cookie'), REF.sessionCs],
  },
  'CK-HTTPONLY': {
    category: 'cookies',
    maxSeverity: 'low',
    maxDeduction: 6,
    references: [REF.mdn('Set-Cookie'), REF.sessionCs],
  },
  'CK-SAMESITE': {
    category: 'cookies',
    maxSeverity: 'medium',
    maxDeduction: 6,
    references: [REF.mdn('Set-Cookie'), REF.sessionCs],
  },
  'CK-PREFIX': {
    category: 'cookies',
    maxSeverity: 'medium',
    maxDeduction: 5,
    references: [REF.mdn('Set-Cookie')],
  },
  'INF-SERVER': {
    category: 'disclosure',
    maxSeverity: 'low',
    maxDeduction: 3,
    references: [REF.mdn('Server'), REF.headersCs],
  },
  'INF-POWERED-BY': {
    category: 'disclosure',
    maxSeverity: 'low',
    maxDeduction: 3,
    references: [REF.mdn('X-Powered-By'), REF.headersCs],
  },
  'INF-ASPNET': {
    category: 'disclosure',
    maxSeverity: 'low',
    maxDeduction: 3,
    references: [REF.headersCs],
  },
}

const RULE_MAP: ReadonlyMap<string, RuleMeta> = new Map(Object.entries(RULES))

/** Metadata for a rule. Throws for an unknown ID (only reachable with untyped input). */
export function ruleMeta(id: RuleId): RuleMeta {
  const meta = RULE_MAP.get(id)
  if (meta === undefined) throw new Error(`Unknown rule: ${id}`)
  return meta
}
