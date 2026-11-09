import { describe, expect, it } from 'vitest'

import { actionableFindings, applyFixes, fixPlan, isActionable, projectScore } from '@/lib/fix-plan'
import { runChecks } from '@/lib/scanner/checks/index'
import { computeScore } from '@/lib/scanner/scoring'
import type { Finding, Grade, RuleId } from '@/lib/scanner/types'

import { PERFECT_HEADERS, makeInput } from '../helpers/check-input'

const GRADES: readonly Grade[] = ['A+', 'A', 'B', 'C', 'D', 'F']
const rank = (g: Grade) => GRADES.indexOf(g)

/** No security headers at all: HSTS and CSP caps hold the grade at B or worse. */
const bare = (): Finding[] => runChecks(makeInput({ headers: [] }))
const perfect = (): Finding[] => runChecks(makeInput({ headers: [...PERFECT_HEADERS] }))
const without = (name: string): Finding[] =>
  runChecks(makeInput({ headers: PERFECT_HEADERS.filter(([n]) => n !== name) }))

describe('actionableFindings (ADR-043)', () => {
  it('keeps only warn and fail, fail first', () => {
    const list = actionableFindings(bare())
    expect(list.length).toBeGreaterThan(0)
    expect(list.every(isActionable)).toBe(true)
    const firstWarn = list.findIndex((f) => f.status === 'warn')
    if (firstWarn >= 0) expect(list.slice(firstWarn).every((f) => f.status === 'warn')).toBe(true)
  })

  it('is empty for a perfect site', () => {
    expect(actionableFindings(perfect())).toEqual([])
  })
})

describe('applyFixes / projectScore (ADR-043)', () => {
  it('changes nothing for an empty set', () => {
    const findings = bare()
    expect(applyFixes(findings, new Set())).toEqual(findings)
    expect(projectScore(findings, new Set())).toEqual(computeScore(findings))
  })

  it('ignores rules that are not actionable', () => {
    const findings = perfect()
    expect(applyFixes(findings, new Set<RuleId>(['HDR-HSTS', 'HDR-CSP']))).toEqual(findings)
  })

  it('fixing every actionable header finding reaches A+ / 100', () => {
    const findings = bare()
    const all = new Set(actionableFindings(findings).map((f) => f.id))
    expect(projectScore(findings, all)).toEqual({ score: 100, grade: 'A+', capsApplied: [] })
  })

  it('a fixed HSTS carries the recommended two-year max-age, so A+ is reachable', () => {
    const findings = without('strict-transport-security')
    expect(computeScore(findings).capsApplied).toContain('CAP-NO-HSTS')
    const projected = projectScore(findings, new Set<RuleId>(['HDR-HSTS']))
    expect(projected.capsApplied).toEqual([])
    expect(projected.grade).toBe('A+')
  })

  it('clears the CSP cap when CSP is fixed', () => {
    const findings = without('content-security-policy')
    expect(computeScore(findings).grade).toBe('B')
    expect(projectScore(findings, new Set<RuleId>(['HDR-CSP'])).grade).toBe('A+')
  })
})

describe('fixPlan (ADR-043)', () => {
  it('returns nothing for a perfect site', () => {
    expect(fixPlan(perfect())).toEqual([])
  })

  it('gives at most three steps whose projected grade and score never get worse', () => {
    const findings = bare()
    const plan = fixPlan(findings)
    expect(plan).toHaveLength(3)
    let previous = computeScore(findings)
    for (const step of plan) {
      expect(rank(step.grade)).toBeLessThanOrEqual(rank(previous.grade))
      if (step.grade === previous.grade) expect(step.score).toBeGreaterThanOrEqual(previous.score)
      previous = { ...previous, score: step.score, grade: step.grade }
    }
    expect(new Set(plan.map((s) => s.id)).size).toBe(plan.length)
  })

  it('starts with a fix that lifts a grade cap when one applies', () => {
    const [first] = fixPlan(bare())
    expect(['HDR-HSTS', 'HDR-CSP']).toContain(first?.id)
  })

  it('each step equals projectScore of the fixes so far', () => {
    const findings = bare()
    const chosen = new Set<RuleId>()
    for (const step of fixPlan(findings, 5)) {
      chosen.add(step.id)
      const { score, grade } = projectScore(findings, chosen)
      expect({ score, grade }).toEqual({ score: step.score, grade: step.grade })
    }
  })

  it('stops as soon as A+ is reached', () => {
    const plan = fixPlan(without('content-security-policy'), 3)
    expect(plan).toEqual([{ id: 'HDR-CSP', score: 100, grade: 'A+' }])
  })

  it('respects the limit and is deterministic', () => {
    expect(fixPlan(bare(), 1)).toHaveLength(1)
    expect(fixPlan(bare())).toEqual(fixPlan(bare()))
  })
})
