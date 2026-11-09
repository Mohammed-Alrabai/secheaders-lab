import { describe, expect, it } from 'vitest'

import { SITE, evaluate, summaryMarkdown } from '../../scripts/self-scan.mjs'
import { sampleResult } from '../e2e/fixtures'

const perfect = { ...sampleResult(), grade: 'A+', score: 100, findings: [] }

describe('self-scan evaluate (ADR-048)', () => {
  it('passes only an A+ / 100 result', () => {
    expect(evaluate(perfect)).toEqual({
      ok: true,
      grade: 'A+',
      score: 100,
      problems: [],
      error: null,
    })
    expect(evaluate({ ...perfect, score: 99 }).ok).toBe(false)
    expect(evaluate({ ...perfect, grade: 'A' }).ok).toBe(false)
  })

  it('lists the findings that cost points', () => {
    const result = evaluate(sampleResult())
    expect(result.ok).toBe(false)
    expect(result.problems.length).toBeGreaterThan(0)
    expect(result.problems.every((p) => /^[A-Z-]+: (fail|warn) \(\d+ points\)$/.test(p))).toBe(true)
  })

  it.each([
    [null, 'No JSON body'],
    ['text', 'No JSON body'],
    [{ error: { code: 'RATE_LIMITED' } }, 'API error: RATE_LIMITED'],
    [{ error: null }, 'API error: unknown'],
    [{ grade: 'A+' }, 'Unexpected response shape'],
  ])('fails closed on %j', (body, error) => {
    expect(evaluate(body)).toMatchObject({ ok: false, error })
  })
})

describe('self-scan summaryMarkdown (ADR-048)', () => {
  it('reports success with the target and run link', () => {
    const text = summaryMarkdown(evaluate(perfect), 'https://github.com/o/r/actions/runs/1')
    expect(text).toContain(`Target: ${SITE}`)
    expect(text).toContain('✅ Grade **A+**, score **100/100**')
    expect(text).toContain('Run: https://github.com/o/r/actions/runs/1')
  })

  it('reports failures with their findings, and errors on their own', () => {
    expect(summaryMarkdown(evaluate(sampleResult()))).toContain('Findings that cost points:')
    expect(summaryMarkdown(evaluate(null))).toContain('❌ No JSON body')
  })
})
