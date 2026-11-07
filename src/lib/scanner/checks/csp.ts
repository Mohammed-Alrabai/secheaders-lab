import {
  type CspPolicy,
  type HeaderMap,
  hasKeyword,
  hasNonceOrHash,
  parseCsp,
  scriptSources,
} from '../header-utils'
import type { CheckInput, Finding, FindingNote, Severity } from '../types'

import { finding } from './finding'

const HEADER = 'content-security-policy'
const REPORT_ONLY = 'content-security-policy-report-only'
const MAX_CSP_DEDUCTION = 20

interface Weakness {
  key: 'noScriptControl' | 'unsafeInline' | 'unsafeEval' | 'broadSource' | 'objectSrc'
  points: number
  severity: Severity
}

const WEAKNESSES: readonly Weakness[] = [
  { key: 'noScriptControl', points: 10, severity: 'medium' },
  { key: 'unsafeInline', points: 10, severity: 'medium' },
  { key: 'unsafeEval', points: 5, severity: 'medium' },
  { key: 'broadSource', points: 5, severity: 'medium' },
  { key: 'objectSrc', points: 3, severity: 'low' },
]

const BROAD_SOURCES = ['*', 'http:', 'https:', 'data:']

/** Enforced policies on the response (all CSP headers, comma-split). */
export function enforcedPolicies(headers: HeaderMap): CspPolicy[] {
  return headers.getAll(HEADER).flatMap(parseCsp)
}

/** Which weaknesses one policy has (`04` §4.1 with ADR-021 strict-dynamic semantics). */
function weaknessesOf(policy: CspPolicy): Set<Weakness['key']> {
  const found = new Set<Weakness['key']>()
  const scripts = scriptSources(policy)
  if (scripts === undefined) {
    found.add('noScriptControl')
  } else {
    const nonceOrHash = hasNonceOrHash(scripts)
    // A nonce/hash makes browsers ignore 'unsafe-inline'; 'strict-dynamic' (with a
    // nonce/hash) additionally ignores host and scheme sources.
    const strictDynamic = nonceOrHash && hasKeyword(scripts, "'strict-dynamic'")
    if (hasKeyword(scripts, "'unsafe-inline'") && !nonceOrHash) found.add('unsafeInline')
    if (hasKeyword(scripts, "'unsafe-eval'")) found.add('unsafeEval')
    if (!strictDynamic && scripts.some((s) => BROAD_SOURCES.includes(s.toLowerCase()))) {
      found.add('broadSource')
    }
  }
  const objects = policy.get('object-src') ?? policy.get('default-src')
  if (!(objects?.length === 1 && hasKeyword(objects, "'none'"))) found.add('objectSrc')
  return found
}

/** True when any enforced policy restricts framing (used by HDR-FRAME). */
export function frameAncestorsProtects(headers: HeaderMap): boolean {
  return enforcedPolicies(headers).some((policy) => {
    const ancestors = policy.get('frame-ancestors')
    return (
      ancestors !== undefined && !ancestors.some((s) => BROAD_SOURCES.includes(s.toLowerCase()))
    )
  })
}

/** HDR-CSP (`04` §4.1, ADR-021, ADR-022). */
export function checkCsp(input: CheckInput): Finding[] {
  const values = input.headers.getAll(HEADER)
  const policies = values.flatMap(parseCsp)
  const evidence = { header: HEADER, value: values.join('\n') }

  if (policies.length === 0) {
    const notes: FindingNote[] = input.headers.has(REPORT_ONLY)
      ? [{ messageKey: 'HDR-CSP.reportOnlyIgnored' }]
      : []
    return [
      finding('HDR-CSP', {
        status: 'fail',
        severity: 'high',
        deduction: 20,
        variant: 'missing',
        evidence: { header: HEADER },
        notes,
      }),
    ]
  }

  // ADR-021: browsers enforce every policy, so a weakness counts only if all have it.
  const perPolicy = policies.map(weaknessesOf)
  const present = WEAKNESSES.filter((w) => perPolicy.every((set) => set.has(w.key)))
  const notes: FindingNote[] = present.map((w) => ({ messageKey: `HDR-CSP.${w.key}` }))
  if (!policies.some((p) => p.has('base-uri'))) notes.push({ messageKey: 'HDR-CSP.noBaseUri' })

  if (present.length === 0) {
    return [finding('HDR-CSP', { status: 'pass', variant: 'ok', evidence, notes })]
  }
  const deduction = Math.min(
    MAX_CSP_DEDUCTION,
    present.reduce((sum, w) => sum + w.points, 0),
  )
  const severity: Severity = present.some((w) => w.severity === 'medium') ? 'medium' : 'low'
  return [
    finding('HDR-CSP', { status: 'warn', severity, deduction, variant: 'weak', evidence, notes }),
  ]
}
