'use client'

import { ChevronDown, ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { Platform } from '@/lib/remediation'
import { ruleMeta } from '@/lib/scanner/rules'
import type { Finding } from '@/lib/scanner/types'
import { displayText, sanitizeParams } from '@/lib/sanitize'
import { cn } from '@/lib/utils'

import { FixTabs } from './FixTabs'
import { StatusIcon } from './icons'
import { SEVERITY_CHIP, STATUS_CHIP, variantOf } from './ui-maps'

interface FindingCardProps {
  finding: Finding
  platform: Platform
  onPlatformChange: (platform: Platform) => void
}

/**
 * One finding (FR-05, `06` §2): status icon + label, title, severity, points, evidence (LTR,
 * sanitized), and expandable "why", "how to fix" and references. Failing and warning
 * findings are expanded in print.
 */
export function FindingCard({ finding, platform, onPlatformChange }: FindingCardProps) {
  const t = useTranslations('results')
  const tRule = useTranslations(`rules.${finding.id}`)
  const [open, setOpen] = useState(false)
  const headingId = useId()
  const params = sanitizeParams(finding.params)
  const evidenceValue = finding.evidence?.value ?? finding.evidence?.detail
  const actionable = finding.status === 'fail' || finding.status === 'warn'

  return (
    <Card
      aria-labelledby={headingId}
      className={cn('break-inside-avoid gap-0 p-0', actionable && 'print-expand')}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className={cn('mt-0.5 rounded-md p-1', STATUS_CHIP.get(finding.status))}>
                <StatusIcon status={finding.status} className="size-4" />
              </span>
              <div className="min-w-0">
                <h3 id={headingId} className="font-heading font-semibold">
                  {tRule('title')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {tRule(`states.${variantOf(finding.messageKey)}`, params)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge className={cn('print-exact rounded-md', STATUS_CHIP.get(finding.status))}>
                {t(`status.${finding.status}`)}
              </Badge>
              {actionable ? (
                <Badge
                  className={cn('print-exact rounded-md', SEVERITY_CHIP.get(finding.severity))}
                >
                  {t(`severity.${finding.severity}`)}
                </Badge>
              ) : null}
              <span className="font-mono tabular-nums">
                {t('deduction', { points: finding.deduction })}
              </span>
            </div>
          </div>

          {finding.notes?.length ? (
            <ul className="flex list-disc flex-col gap-1 ps-5 text-sm">
              {finding.notes.map((note) => (
                <li key={note.messageKey}>
                  {tRule(`states.${variantOf(note.messageKey)}`, sanitizeParams(note.params))}
                </li>
              ))}
            </ul>
          ) : null}

          {finding.evidence?.header !== undefined || evidenceValue !== undefined ? (
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">{t('evidence')}</span>
              <code
                dir="ltr"
                className="block overflow-x-auto rounded-md bg-muted px-2 py-1 font-mono text-xs break-all whitespace-pre-wrap ltr-isolate"
              >
                {finding.evidence?.header ? `${displayText(finding.evidence.header)}: ` : ''}
                {evidenceValue === undefined ? (
                  <span className="text-muted-foreground italic">{t('notPresent')}</span>
                ) : (
                  displayText(evidenceValue)
                )}
              </code>
            </div>
          ) : null}

          <CollapsibleTrigger className="inline-flex w-fit items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline print:hidden">
            {open ? t('details.hide') : t('details.show')}
            <ChevronDown
              strokeWidth={1.75}
              className={cn(
                'size-4 transition-transform motion-reduce:transition-none',
                open && 'rotate-180',
              )}
              aria-hidden
            />
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent keepMounted className="flex flex-col gap-5 border-t p-5">
          <section className="flex flex-col gap-2">
            <h4 className="font-heading text-sm font-semibold">{t('why')}</h4>
            <p className="leading-relaxed">{tRule('why')}</p>
          </section>
          <section className="flex flex-col gap-2">
            <h4 className="font-heading text-sm font-semibold">{t('fix')}</h4>
            <FixTabs rule={finding.id} platform={platform} onPlatformChange={onPlatformChange} />
          </section>
          <section className="flex flex-col gap-2 print:hidden">
            <h4 className="font-heading text-sm font-semibold">{t('references')}</h4>
            <ul className="flex flex-col gap-1 text-sm">
              {ruleMeta(finding.id).references.map((ref) => (
                <li key={ref.url}>
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                  >
                    {ref.label}
                    <ExternalLink strokeWidth={1.75} className="size-3.5" aria-hidden />
                    <span className="sr-only">{t('opensInNewTab')}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
