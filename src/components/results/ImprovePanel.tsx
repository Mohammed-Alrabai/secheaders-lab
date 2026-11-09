'use client'

import { ChevronDown, Wrench } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { actionableFindings, fixPlan, projectScore } from '@/lib/fix-plan'
import { type Platform, combinedHeaderFix, isHeaderRule } from '@/lib/remediation'
import type { Finding, Grade, RuleId } from '@/lib/scanner/types'
import { cn } from '@/lib/utils'

import { PlatformTabs, SnippetView } from './FixTabs'
import { GRADE_BADGE } from './ui-maps'

function GradeChip({ grade }: { grade: Grade }) {
  return (
    <span
      aria-hidden
      className={cn(
        'print-exact inline-flex min-w-9 justify-center rounded-md px-1.5 py-0.5 font-heading text-sm font-bold',
        GRADE_BADGE.get(grade),
      )}
    >
      {grade}
    </span>
  )
}

function RuleTitle({ id }: { id: RuleId }) {
  const tRule = useTranslations(`rules.${id}`)
  return <>{tRule('title')}</>
}

interface ImprovePanelProps {
  findings: readonly Finding[]
  platform: Platform
  onPlatformChange: (platform: Platform) => void
}

/**
 * "Improve your grade" (ADR-043, ADR-044): the top fixes with their projected score, a
 * what-if selector, and every header fix in one block. Everything is computed in the
 * browser from the result already on the page.
 */
export function ImprovePanel({ findings, platform, onPlatformChange }: ImprovePanelProps) {
  const t = useTranslations('results.improve')
  const tRules = useTranslations('rules')
  const actionable = useMemo(() => actionableFindings(findings), [findings])
  const plan = useMemo(() => fixPlan(findings), [findings])
  if (actionable.length === 0) return null

  const headerRules = actionable.map((f) => f.id).filter(isHeaderRule)
  const hasOthers = actionable.some((f) => !isHeaderRule(f.id))

  return (
    <section aria-labelledby="improve-title" className="flex flex-col gap-4">
      <h2 id="improve-title" className="flex items-center gap-2 text-xl font-semibold">
        <Wrench strokeWidth={1.75} className="size-5 text-link" aria-hidden />
        {t('title')}
      </h2>
      <p className="text-muted-foreground">{t('intro')}</p>

      <ol className="flex flex-col gap-2" data-testid="fix-plan">
        {plan.map((step, index) => (
          <li
            key={step.id}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="font-mono text-sm text-muted-foreground tabular-nums" aria-hidden>
                {index + 1}
              </span>
              <span className="min-w-0">{t('step', { rule: tRules(`${step.id}.title`) })}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2 font-mono text-sm tabular-nums">
              <span className="sr-only">
                {t('projectedLabel', { score: step.score, grade: step.grade })}
              </span>
              <span aria-hidden>{step.score}/100</span>
              <GradeChip grade={step.grade} />
            </span>
          </li>
        ))}
      </ol>

      <WhatIf findings={findings} actionable={actionable} />

      {headerRules.length > 0 ? (
        <section aria-labelledby="combined-title" className="flex flex-col gap-2">
          <h3 id="combined-title" className="text-lg font-semibold">
            {t('combined.title')}
          </h3>
          <p className="text-sm text-muted-foreground">{t('combined.intro')}</p>
          <PlatformTabs platform={platform} onPlatformChange={onPlatformChange}>
            {(p) => {
              const snippet = combinedHeaderFix(headerRules, p)
              return snippet ? (
                <SnippetView snippet={snippet} />
              ) : (
                <p className="leading-relaxed">{t('combined.cloudflare')}</p>
              )
            }}
          </PlatformTabs>
          {hasOthers ? (
            <p className="text-sm text-muted-foreground">{t('combined.others')}</p>
          ) : null}
        </section>
      ) : null}
    </section>
  )
}

/** What-if selector: interactive, so hidden in print. */
function WhatIf({
  findings,
  actionable,
}: {
  findings: readonly Finding[]
  actionable: readonly Finding[]
}) {
  const t = useTranslations('results.improve.whatIf')
  const [selected, setSelected] = useState<ReadonlySet<RuleId>>(new Set())
  const projected = useMemo(() => projectScore(findings, selected), [findings, selected])
  const baseId = useId()
  const [open, setOpen] = useState(false)

  const toggle = (id: RuleId, on: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="print:hidden">
      <CollapsibleTrigger className="inline-flex w-fit items-center gap-1 rounded-md text-sm font-medium text-link hover:underline">
        {t('title')}
        <ChevronDown
          strokeWidth={1.75}
          className={cn(
            'size-4 transition-transform motion-reduce:transition-none',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3 pt-3">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t('legend')}</legend>
          {actionable.map((f) => {
            const id = `${baseId}-${f.id}`
            return (
              <div key={f.id} className="flex items-center gap-2">
                <input
                  id={id}
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={selected.has(f.id)}
                  onChange={(event) => {
                    toggle(f.id, event.target.checked)
                  }}
                />
                <label htmlFor={id}>
                  <RuleTitle id={f.id} />
                </label>
              </div>
            )
          })}
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <p
            aria-live="polite"
            className="flex items-center gap-2 font-medium"
            data-testid="what-if-result"
          >
            {t('result', { score: projected.score, grade: projected.grade })}
          </p>
          {selected.size > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelected(new Set())
              }}
            >
              {t('reset')}
            </Button>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
