import type { HeaderMap } from './header-utils'
import type { TlsInspection } from './tls-inspect'

export type Status = 'pass' | 'warn' | 'fail' | 'info'
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type Category = 'headers' | 'tls' | 'cookies' | 'disclosure'
export type Grade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'

/** Every rule in `04` §4, plus the `HDR-DUPLICATE` info finding from `04` §1. */
export const RULE_IDS = [
  'HDR-HSTS',
  'HDR-CSP',
  'HDR-FRAME',
  'HDR-XCTO',
  'HDR-REFERRER',
  'HDR-PERMISSIONS',
  'HDR-COOP',
  'HDR-XXSS',
  'HDR-DUPLICATE',
  'TLS-AVAILABLE',
  'TLS-CERT-VALID',
  'TLS-CERT-EXPIRY',
  'TLS-PROTOCOL',
  'TLS-HTTP-REDIRECT',
  'CK-SECURE',
  'CK-HTTPONLY',
  'CK-SAMESITE',
  'CK-PREFIX',
  'INF-SERVER',
  'INF-POWERED-BY',
  'INF-ASPNET',
] as const

export type RuleId = (typeof RULE_IDS)[number]

/** Grade caps from `04` §3. */
export const CAP_IDS = [
  'CAP-NO-HTTPS',
  'CAP-CERT-INVALID',
  'CAP-OLD-TLS',
  'CAP-NO-HSTS',
  'CAP-NO-CSP',
] as const

export type CapId = (typeof CAP_IDS)[number]

export type MessageParams = Record<string, string | number>

/** Upstream values are untrusted text (SC-29); values are truncated to 512 chars. */
export interface Evidence {
  header?: string
  value?: string
  detail?: string
}

/** Extra informational line attached to a finding (e.g. CSP without `base-uri`). */
export interface FindingNote {
  messageKey: string
  params?: MessageParams
}

export interface Finding {
  id: RuleId
  category: Category
  status: Status
  severity: Severity
  /** Points actually deducted after per-rule caps; 0 for pass/info. */
  deduction: number
  evidence?: Evidence
  /** i18n key variant, e.g. `HDR-HSTS.missing`. */
  messageKey: string
  params?: MessageParams
  notes?: FindingNote[]
}

/** Outcome of fetching `http://<host>/` for TLS-HTTP-REDIRECT. */
export type HttpRedirectCheck =
  { kind: 'response'; finalUrl: string } | { kind: 'unreachable' } | { kind: 'error' }

/** Everything the pure checks need; produced by `scan()` or by test fixtures. */
export interface CheckInput {
  /** Hostname the user asked for (after normalization). */
  inputHostname: string
  finalUrl: URL
  headers: HeaderMap
  tls: TlsInspection
  httpRedirect: HttpRedirectCheck
  now: Date
}

export interface ScanResult {
  schemaVersion: 1
  scoringVersion: number
  scannedAt: string
  durationMs: number
  target: {
    input: string
    finalUrl: string
    redirectChain: { url: string; status: number }[]
    httpStatus: number
  }
  tls: {
    available: boolean
    protocol?: string
    validTo?: string
    issuer?: string
    authorized?: boolean
  }
  score: number
  grade: Grade
  capsApplied: CapId[]
  summary: Record<Status, number>
  findings: Finding[]
  rawHeaders: { name: string; value: string }[]
}
