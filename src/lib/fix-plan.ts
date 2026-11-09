import { computeScore, type ScoreResult } from '@/lib/scanner/scoring'
import type { Finding, Grade, RuleId } from '@/lib/scanner/types'

/**
 * Fix planning and "what if" estimates (ADR-043). Both reuse the scoring model itself:
 * a fixed finding is replaced by a passing one and the result is scored again, so the
 * estimate can never disagree with `04-SCORING-SPEC.md`.
 */

/** The `max-age` the recommended HSTS fix sets (`RECOMMENDED_HEADERS`, two years). */
const FIXED_HSTS_MAX_AGE = 63_072_000

const GRADE_ORDER: readonly Grade[] = ['A+', 'A', 'B', 'C', 'D', 'F']
const STATUS_RANK = { fail: 0, warn: 1 } as const
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const

/** A finding the visitor can act on: it costs points or blocks a grade. */
export function isActionable(finding: Finding): boolean {
  return finding.status === 'fail' || finding.status === 'warn'
}

/** Actionable findings, most serious first (status, severity, points). */
export function actionableFindings(findings: readonly Finding[]): Finding[] {
  return findings
    .filter(isActionable)
    .sort(
      (a, b) =>
        STATUS_RANK[a.status as 'fail' | 'warn'] - STATUS_RANK[b.status as 'fail' | 'warn'] ||
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        b.deduction - a.deduction,
    )
}

/** The finding as it would look after applying the recommended fix. */
function fixed(finding: Finding): Finding {
  const out: Finding = {
    id: finding.id,
    category: finding.category,
    status: 'pass',
    severity: 'info',
    deduction: 0,
    messageKey: `${finding.id}.fixed`,
  }
  if (finding.id === 'HDR-HSTS') out.params = { maxAge: FIXED_HSTS_MAX_AGE }
  return out
}

/** Findings with the given rules fixed. Rules that are not actionable are left as they are. */
export function applyFixes(findings: readonly Finding[], ids: ReadonlySet<RuleId>): Finding[] {
  return findings.map((f) => (ids.has(f.id) && isActionable(f) ? fixed(f) : f))
}

/** Score and grade if the given rules were fixed (an estimate: see ADR-043). */
export function projectScore(findings: readonly Finding[], ids: ReadonlySet<RuleId>): ScoreResult {
  return computeScore(applyFixes(findings, ids))
}

export interface FixStep {
  id: RuleId
  /** Projected score and grade after this fix and every step before it. */
  score: number
  grade: Grade
}

const gradeRank = (grade: Grade) => GRADE_ORDER.indexOf(grade)

/**
 * Up to `limit` fixes, chosen greedily: each step takes the fix that improves the projected
 * grade most, then the score, then the most serious finding. Stops at A+ or when nothing is
 * left to fix. Deterministic for a given result.
 */
export function fixPlan(findings: readonly Finding[], limit = 3): FixStep[] {
  const candidates = actionableFindings(findings).map((f) => f.id)
  const chosen = new Set<RuleId>()
  const steps: FixStep[] = []
  while (steps.length < limit) {
    let best: FixStep | null = null
    for (const id of candidates) {
      if (chosen.has(id)) continue
      const { score, grade } = projectScore(findings, new Set([...chosen, id]))
      const better =
        best === null ||
        gradeRank(grade) < gradeRank(best.grade) ||
        (grade === best.grade && score > best.score)
      if (better) best = { id, score, grade }
    }
    if (best === null) break
    chosen.add(best.id)
    steps.push(best)
    if (best.grade === 'A+') break
  }
  return steps
}
