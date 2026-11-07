import { parseHsts } from '../header-utils'
import type { CheckInput, Finding } from '../types'

import { finding, headerEvidence } from './finding'

const HEADER = 'strict-transport-security'
const SIX_MONTHS = 15_552_000
const ONE_YEAR = 31_536_000

const days = (seconds: number) => Math.floor(seconds / 86_400)

/** HDR-HSTS (`04` §4.1, ADR-022). `params.maxAge` feeds the A+ requirement. */
export function checkHsts(input: CheckInput): Finding[] {
  const value = input.headers.get(HEADER)
  const evidence = headerEvidence(HEADER, value)

  // `04` §1: HSTS cannot be delivered over plain HTTP.
  if (input.finalUrl.protocol !== 'https:') {
    return [
      finding('HDR-HSTS', {
        status: 'fail',
        severity: 'high',
        deduction: 20,
        variant: 'notHttps',
        evidence,
      }),
    ]
  }
  if (value === undefined) {
    return [
      finding('HDR-HSTS', {
        status: 'fail',
        severity: 'high',
        deduction: 20,
        variant: 'missing',
        evidence,
      }),
    ]
  }

  const hsts = parseHsts(value)
  if (hsts.maxAge === null || hsts.maxAge === 0) {
    return [
      finding('HDR-HSTS', {
        status: 'fail',
        severity: 'high',
        deduction: 20,
        variant: 'invalidMaxAge',
        evidence,
      }),
    ]
  }
  const params = { maxAge: hsts.maxAge, days: days(hsts.maxAge) }
  if (hsts.maxAge < SIX_MONTHS) {
    return [
      finding('HDR-HSTS', {
        status: 'warn',
        severity: 'medium',
        deduction: 8,
        variant: 'short',
        params,
        evidence,
      }),
    ]
  }
  if (!hsts.includeSubDomains) {
    return [finding('HDR-HSTS', { status: 'pass', variant: 'noSubdomains', params, evidence })]
  }
  const variant = hsts.maxAge >= ONE_YEAR ? 'ok' : 'belowOneYear'
  return [finding('HDR-HSTS', { status: 'pass', variant, params, evidence })]
}
