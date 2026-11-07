import { parseFrameOptions, parseReferrerPolicy } from '../header-utils'
import type { CheckInput, Finding } from '../types'

import { frameAncestorsProtects } from './csp'
import { finding, headerEvidence } from './finding'

/** HDR-FRAME (`04` §4.1): X-Frame-Options or CSP `frame-ancestors`. */
export function checkFrame(input: CheckInput): Finding[] {
  const value = input.headers.get('x-frame-options')
  const evidence = headerEvidence('x-frame-options', value)
  const xfo = value === undefined ? undefined : parseFrameOptions(value)
  if (xfo === 'DENY' || xfo === 'SAMEORIGIN' || frameAncestorsProtects(input.headers)) {
    return [finding('HDR-FRAME', { status: 'pass', variant: 'ok', evidence })]
  }
  if (xfo === 'ALLOW-FROM') {
    return [
      finding('HDR-FRAME', {
        status: 'warn',
        severity: 'medium',
        deduction: 8,
        variant: 'allowFrom',
        evidence,
      }),
    ]
  }
  return [
    finding('HDR-FRAME', {
      status: 'fail',
      severity: 'medium',
      deduction: 10,
      variant: 'missing',
      evidence,
    }),
  ]
}

/** HDR-XCTO (`04` §4.1). */
export function checkXcto(input: CheckInput): Finding[] {
  const value = input.headers.get('x-content-type-options')
  const evidence = headerEvidence('x-content-type-options', value)
  if (value?.trim().toLowerCase() === 'nosniff') {
    return [finding('HDR-XCTO', { status: 'pass', variant: 'ok', evidence })]
  }
  const variant = value === undefined ? 'missing' : 'invalid'
  return [
    finding('HDR-XCTO', { status: 'fail', severity: 'medium', deduction: 8, variant, evidence }),
  ]
}

/** HDR-REFERRER (`04` §4.1). An unrecognised value leaves the browser default in place. */
export function checkReferrer(input: CheckInput): Finding[] {
  const value = input.headers.get('referrer-policy')
  const evidence = headerEvidence('referrer-policy', value)
  const policy = value === undefined ? undefined : parseReferrerPolicy(value)
  if (policy === undefined) {
    const variant = value === undefined ? 'missing' : 'invalid'
    return [
      finding('HDR-REFERRER', { status: 'warn', severity: 'low', deduction: 3, variant, evidence }),
    ]
  }
  if (policy === 'unsafe-url' || policy === 'no-referrer-when-downgrade') {
    return [
      finding('HDR-REFERRER', {
        status: 'warn',
        severity: 'medium',
        deduction: 5,
        variant: 'leaky',
        params: { policy },
        evidence,
      }),
    ]
  }
  return [finding('HDR-REFERRER', { status: 'pass', variant: 'ok', params: { policy }, evidence })]
}

/** HDR-PERMISSIONS (`04` §4.1). */
export function checkPermissions(input: CheckInput): Finding[] {
  const value = input.headers.get('permissions-policy')
  const evidence = headerEvidence('permissions-policy', value)
  if (value === undefined) {
    return [
      finding('HDR-PERMISSIONS', {
        status: 'warn',
        severity: 'low',
        deduction: 3,
        variant: 'missing',
        evidence,
      }),
    ]
  }
  return [finding('HDR-PERMISSIONS', { status: 'pass', variant: 'ok', evidence })]
}

/** HDR-COOP (`04` §4.1): informational only. */
export function checkCoop(input: CheckInput): Finding[] {
  const value = input.headers.get('cross-origin-opener-policy')
  const evidence = headerEvidence('cross-origin-opener-policy', value)
  return [
    finding('HDR-COOP', {
      status: value === undefined ? 'info' : 'pass',
      variant: value === undefined ? 'missing' : 'ok',
      evidence,
    }),
  ]
}

/** HDR-XXSS (`04` §4.1): the deprecated filter enabled is an info finding. */
export function checkXxss(input: CheckInput): Finding[] {
  const value = input.headers.get('x-xss-protection')
  const evidence = headerEvidence('x-xss-protection', value)
  if (value?.trim().startsWith('1')) {
    return [finding('HDR-XXSS', { status: 'info', variant: 'enabled', evidence })]
  }
  return [
    finding('HDR-XXSS', {
      status: 'pass',
      variant: value === undefined ? 'absent' : 'disabled',
      evidence,
    }),
  ]
}

/** HDR-DUPLICATE (`04` §1): only emitted when a header repeats unexpectedly. */
export function checkDuplicates(input: CheckInput): Finding[] {
  const names = input.headers.duplicates()
  if (names.length === 0) return []
  return [
    finding('HDR-DUPLICATE', {
      status: 'info',
      variant: 'found',
      params: { headers: names.join(', ') },
      evidence: { detail: names.join(', ') },
    }),
  ]
}
