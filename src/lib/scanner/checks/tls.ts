import { getDomain } from 'tldts'

import type { CheckInput, Finding } from '../types'

import { finding } from './finding'

const DAY_MS = 86_400_000
const OLD_PROTOCOLS = new Set(['SSLv2', 'SSLv3', 'TLSv1', 'TLSv1.1'])

function certProblem(code: string | null, hostnameMatches: boolean): string {
  if (code === 'CERT_HAS_EXPIRED') return 'expired'
  if (code === 'CERT_NOT_YET_VALID') return 'notYetValid'
  if (code === 'ERR_TLS_CERT_ALTNAME_INVALID' || !hostnameMatches) return 'hostnameMismatch'
  return 'untrusted'
}

/** TLS-AVAILABLE, TLS-CERT-VALID, TLS-CERT-EXPIRY, TLS-PROTOCOL (`04` §4.2). */
export function checkTls(input: CheckInput): Finding[] {
  const tls = input.tls
  if (!tls.available) {
    const notEvaluated = { status: 'info' as const, variant: 'notEvaluated' }
    return [
      finding('TLS-AVAILABLE', {
        status: 'fail',
        severity: 'critical',
        deduction: 30,
        variant: 'unavailable',
        params: { reason: tls.reason },
      }),
      finding('TLS-CERT-VALID', notEvaluated),
      finding('TLS-CERT-EXPIRY', notEvaluated),
      finding('TLS-PROTOCOL', notEvaluated),
    ]
  }

  const findings = [finding('TLS-AVAILABLE', { status: 'pass', variant: 'ok' })]
  const certEvidence = { detail: [tls.issuer, tls.validTo].filter(Boolean).join(' · ') }

  if (tls.authorized) {
    findings.push(
      finding('TLS-CERT-VALID', { status: 'pass', variant: 'ok', evidence: certEvidence }),
    )
    findings.push(checkExpiry(tls.validTo, input.now))
  } else {
    findings.push(
      finding('TLS-CERT-VALID', {
        status: 'fail',
        severity: 'critical',
        deduction: 30,
        variant: certProblem(tls.authorizationError, tls.hostnameMatches),
        evidence: certEvidence,
      }),
    )
    findings.push(finding('TLS-CERT-EXPIRY', { status: 'info', variant: 'notEvaluated' }))
  }

  findings.push(checkProtocol(tls.protocol))
  return findings
}

function checkExpiry(validTo: string | null, now: Date): Finding {
  const expires = validTo === null ? Number.NaN : Date.parse(validTo)
  if (Number.isNaN(expires))
    return finding('TLS-CERT-EXPIRY', { status: 'info', variant: 'notEvaluated' })
  const remaining = (expires - now.getTime()) / DAY_MS
  const params = { days: Math.max(0, Math.floor(remaining)) }
  if (remaining < 14) {
    return finding('TLS-CERT-EXPIRY', {
      status: 'warn',
      severity: 'high',
      deduction: 10,
      variant: 'soon',
      params,
    })
  }
  if (remaining <= 30) {
    return finding('TLS-CERT-EXPIRY', {
      status: 'warn',
      severity: 'medium',
      deduction: 5,
      variant: 'month',
      params,
    })
  }
  return finding('TLS-CERT-EXPIRY', { status: 'pass', variant: 'ok', params })
}

function checkProtocol(protocol: string | null): Finding {
  const evidence = protocol === null ? undefined : { detail: protocol }
  if (protocol === null) return finding('TLS-PROTOCOL', { status: 'info', variant: 'notEvaluated' })
  if (OLD_PROTOCOLS.has(protocol)) {
    return finding('TLS-PROTOCOL', {
      status: 'fail',
      severity: 'high',
      deduction: 15,
      variant: 'old',
      params: { protocol },
      ...(evidence ? { evidence } : {}),
    })
  }
  const variant = protocol === 'TLSv1.3' ? 'tls13' : 'tls12'
  return finding('TLS-PROTOCOL', {
    status: 'pass',
    variant,
    params: { protocol },
    ...(evidence ? { evidence } : {}),
  })
}

/**
 * Registrable domain per the Public Suffix List, including its private section: tenants of
 * shared hosts (`a.github.io` vs `b.github.io`) are different owners (ADR-020).
 */
function registrableDomain(hostname: string): string | null {
  return getDomain(hostname, { allowPrivateDomains: true })
}

/** TLS-HTTP-REDIRECT (`04` §4.2, ADR-020): http:// must reach https:// on the same site. */
export function checkHttpRedirect(input: CheckInput): Finding[] {
  const check = input.httpRedirect
  if (check.kind === 'unreachable') {
    return [finding('TLS-HTTP-REDIRECT', { status: 'pass', variant: 'httpUnavailable' })]
  }
  if (check.kind === 'error') {
    return [
      finding('TLS-HTTP-REDIRECT', {
        status: 'fail',
        severity: 'medium',
        deduction: 10,
        variant: 'noRedirect',
      }),
    ]
  }
  const final = new URL(check.finalUrl)
  const finalSite = registrableDomain(final.hostname)
  const sameSite =
    final.protocol === 'https:' &&
    finalSite !== null &&
    finalSite === registrableDomain(input.inputHostname)
  const evidence = { detail: check.finalUrl }
  if (sameSite) return [finding('TLS-HTTP-REDIRECT', { status: 'pass', variant: 'ok', evidence })]
  const variant = final.protocol === 'https:' ? 'otherSite' : 'noRedirect'
  return [
    finding('TLS-HTTP-REDIRECT', {
      status: 'fail',
      severity: 'medium',
      deduction: 10,
      variant,
      evidence,
    }),
  ]
}
