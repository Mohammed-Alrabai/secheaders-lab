import { type CookieAttributes, parseSetCookie } from '../header-utils'
import type { CheckInput, Finding, RuleId, Severity, Status } from '../types'

import { finding } from './finding'

interface Violation {
  cookie: string
  status: Exclude<Status, 'pass' | 'info'>
  severity: Severity
  points: number
}

const RULE_CAPS = new Map<RuleId, number>([
  ['CK-SECURE', 10],
  ['CK-HTTPONLY', 6],
  ['CK-SAMESITE', 6],
  ['CK-PREFIX', 5],
])

const SAMESITE_VALUES = new Set(['strict', 'lax', 'none'])

function prefixViolated(c: CookieAttributes): boolean {
  const name = c.name.toLowerCase()
  if (name.startsWith('__host-')) return !c.secure || c.path !== '/' || c.domain !== undefined
  if (name.startsWith('__secure-')) return !c.secure
  return false
}

/** ADR-023: one finding per rule; worst status; per-cookie points capped by the rule cap. */
function aggregate(id: RuleId, violations: Violation[]): Finding {
  const [first] = violations
  if (first === undefined) return finding(id, { status: 'pass', variant: 'ok' })
  const worst = violations.find((v) => v.status === 'fail') ?? first
  const names = [...new Set(violations.map((v) => v.cookie || '(unnamed)'))].join(', ')
  const total = violations.reduce((sum, v) => sum + v.points, 0)
  return finding(id, {
    status: worst.status,
    severity: worst.severity,
    deduction: Math.min(RULE_CAPS.get(id) ?? 0, total),
    variant: worst.status === 'fail' && id === 'CK-SAMESITE' ? 'noneWithoutSecure' : 'violations',
    params: { count: violations.length, cookies: names },
    evidence: { header: 'set-cookie', detail: names },
  })
}

/** CK-SECURE, CK-HTTPONLY, CK-SAMESITE, CK-PREFIX (`04` §4.3). Values are never read. */
export function checkCookies(input: CheckInput): Finding[] {
  const cookies = input.headers.getAll('set-cookie').map(parseSetCookie)
  const ids: RuleId[] = ['CK-SECURE', 'CK-HTTPONLY', 'CK-SAMESITE', 'CK-PREFIX']
  if (cookies.length === 0)
    return ids.map((id) => finding(id, { status: 'info', variant: 'noCookies' }))

  const https = input.finalUrl.protocol === 'https:'
  const secure: Violation[] = []
  const httpOnly: Violation[] = []
  const sameSite: Violation[] = []
  const prefix: Violation[] = []

  for (const c of cookies) {
    if (https && !c.secure)
      secure.push({ cookie: c.name, status: 'fail', severity: 'medium', points: 5 })
    if (!c.httpOnly) httpOnly.push({ cookie: c.name, status: 'warn', severity: 'low', points: 3 })
    if (c.sameSite === 'none' && !c.secure) {
      sameSite.push({ cookie: c.name, status: 'fail', severity: 'medium', points: 5 })
    } else if (c.sameSite === undefined || !SAMESITE_VALUES.has(c.sameSite)) {
      // An unrecognised value is ignored by browsers, i.e. treated as absent.
      sameSite.push({ cookie: c.name, status: 'warn', severity: 'low', points: 3 })
    }
    if (prefixViolated(c))
      prefix.push({ cookie: c.name, status: 'fail', severity: 'medium', points: 5 })
  }

  return [
    https
      ? aggregate('CK-SECURE', secure)
      : finding('CK-SECURE', { status: 'info', variant: 'notHttps' }),
    aggregate('CK-HTTPONLY', httpOnly),
    aggregate('CK-SAMESITE', sameSite),
    aggregate('CK-PREFIX', prefix),
  ]
}
