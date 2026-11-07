import { CAP_IDS, type CapId, type Finding, type Grade, type RuleId } from './types'

/** Version of `04-SCORING-SPEC.md` implemented here. Bump on any weight or rule change. */
export const SCORING_VERSION = 1

const ONE_YEAR = 31_536_000

/** Grades from best to worst; a higher index is worse. */
const GRADE_ORDER: readonly Grade[] = ['A+', 'A', 'B', 'C', 'D', 'F']

/** `04` §3: the best grade each cap allows. */
export const CAP_MAX_GRADE: ReadonlyMap<CapId, Grade> = new Map<CapId, Grade>([
  ['CAP-NO-HTTPS', 'F'],
  ['CAP-CERT-INVALID', 'F'],
  ['CAP-OLD-TLS', 'C'],
  ['CAP-NO-HSTS', 'B'],
  ['CAP-NO-CSP', 'B'],
])

function byId(findings: readonly Finding[], id: RuleId): Finding | undefined {
  return findings.find((f) => f.id === id)
}

/** Which caps the findings trigger, in `04` §3 order. */
export function capsFor(findings: readonly Finding[]): CapId[] {
  const triggered = new Set<CapId>()
  if (byId(findings, 'TLS-AVAILABLE')?.status === 'fail') triggered.add('CAP-NO-HTTPS')
  if (byId(findings, 'TLS-CERT-VALID')?.status === 'fail') triggered.add('CAP-CERT-INVALID')
  if (byId(findings, 'TLS-PROTOCOL')?.status === 'fail') triggered.add('CAP-OLD-TLS')
  // `HDR-HSTS.missing` is only produced for HTTPS responses (`notHttps` covers plain HTTP).
  if (byId(findings, 'HDR-HSTS')?.messageKey === 'HDR-HSTS.missing') triggered.add('CAP-NO-HSTS')
  if (byId(findings, 'HDR-CSP')?.messageKey === 'HDR-CSP.missing') triggered.add('CAP-NO-CSP')
  return CAP_IDS.filter((id) => triggered.has(id))
}

/**
 * `04` §2 A+ extra requirements: no `fail` findings, HSTS `max-age` ≥ 31,536,000 and
 * `HDR-CSP` status `pass`.
 */
export function meetsAPlusRequirements(findings: readonly Finding[]): boolean {
  const maxAge = byId(findings, 'HDR-HSTS')?.params?.maxAge
  return (
    findings.every((f) => f.status !== 'fail') &&
    typeof maxAge === 'number' &&
    maxAge >= ONE_YEAR &&
    byId(findings, 'HDR-CSP')?.status === 'pass'
  )
}

/** `04` §2: minimum score per grade, best first. A+ also needs the extra requirements. */
export const GRADE_THRESHOLDS: readonly (readonly [Grade, number])[] = [
  ['A+', 95],
  ['A', 90],
  ['B', 80],
  ['C', 70],
  ['D', 60],
  ['F', 0],
]

/** `04` §2 thresholds. A score ≥ 95 is A+ only when the extra requirements hold. */
export function thresholdGrade(score: number, aPlusEligible: boolean): Grade {
  for (const [grade, min] of GRADE_THRESHOLDS) {
    if (score >= min && (grade !== 'A+' || aPlusEligible)) return grade
  }
  return 'F'
}

function worse(a: Grade, b: Grade): Grade {
  return GRADE_ORDER.indexOf(a) >= GRADE_ORDER.indexOf(b) ? a : b
}

export interface ScoreResult {
  score: number
  grade: Grade
  capsApplied: CapId[]
}

/**
 * `04` §1–§3: score = max(0, 100 − Σ deductions) as an integer; grade = the worse of the
 * threshold grade and the lowest triggered cap.
 */
export function computeScore(findings: readonly Finding[]): ScoreResult {
  const deducted = findings.reduce(
    (sum, f) => sum + (f.status === 'warn' || f.status === 'fail' ? f.deduction : 0),
    0,
  )
  const score = Math.max(0, Math.round(100 - deducted))
  const capsApplied = capsFor(findings)
  const grade = capsApplied.reduce<Grade>(
    (current, cap) => worse(current, CAP_MAX_GRADE.get(cap) ?? 'F'),
    thresholdGrade(score, meetsAPlusRequirements(findings)),
  )
  return { score, grade, capsApplied }
}
