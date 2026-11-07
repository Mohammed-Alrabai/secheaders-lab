'use client'

import { ChevronDown, Printer, RotateCcw, Route } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { forwardRef, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Platform } from '@/lib/remediation'
import type { Category, ScanResult } from '@/lib/scanner/types'
import { displayText } from '@/lib/sanitize'
import { cn } from '@/lib/utils'

import { CopyButton } from './CopyButton'
import { FindingCard } from './FindingCard'
import { CategoryIcon, StatusIcon } from './icons'
import { CATEGORY_ORDER, GRADE_BADGE, STATUS_CHIP, sortFindings } from './ui-maps'

const DAY_MS = 86_400_000

/** Gregorian calendar and Western digits in both locales (`06` §3). */
function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(`${locale}-u-ca-gregory-nu-latn`, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

interface ScanReportProps {
  result: ScanResult
  onRescan: () => void
}

/** The full report (FR-05…FR-09). Every upstream string passes through `displayText`. */
export const ScanReport = forwardRef<HTMLHeadingElement, ScanReportProps>(function ScanReport(
  { result, onRescan },
  headingRef,
) {
  const t = useTranslations('results')
  const locale = useLocale()
  const [platform, setPlatform] = useState<Platform>('nginx')
  const finalUrl = displayText(result.target.finalUrl)

  return (
    <div className="flex flex-col gap-8">
      {/* Print-only page header (06 §2): product, target and scan date. */}
      <p className="hidden border-b pb-2 text-sm print:block">
        <strong>SecHeaders Lab</strong> ·{' '}
        <bdi dir="ltr" className="ltr-isolate">
          {finalUrl}
        </bdi>{' '}
        · {formatDate(result.scannedAt, locale)}
      </p>
      {/* Summary header */}
      <section
        aria-labelledby="summary-title"
        className="flex flex-col gap-6 md:flex-row md:items-center"
      >
        <div
          className={cn(
            'print-exact flex size-28 shrink-0 items-center justify-center rounded-lg font-heading text-6xl font-bold',
            GRADE_BADGE.get(result.grade),
          )}
          role="img"
          aria-label={t('summary.gradeLabel', { grade: result.grade })}
        >
          <span aria-hidden>{result.grade}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2
            id="summary-title"
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-bold outline-none"
          >
            {t('summary.heading', { host: displayText(new URL(result.target.finalUrl).hostname) })}
          </h2>
          <p className="font-mono text-3xl tabular-nums">
            {result.score}
            <span className="text-base text-muted-foreground">/100</span>
          </p>
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('summary.finalUrl')}</span>
            <bdi dir="ltr" className="truncate font-mono text-sm ltr-isolate">
              {finalUrl}
            </bdi>
            <CopyButton value={finalUrl} accessibleLabel={t('actions.copyUrl')} />
          </div>
          <p className="text-sm text-muted-foreground">
            {t('summary.scannedAt', { date: formatDate(result.scannedAt, locale) })} ·{' '}
            {t('summary.duration', { seconds: (result.durationMs / 1000).toFixed(1) })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button type="button" variant="outline" onClick={onRescan}>
            <RotateCcw strokeWidth={1.75} className="size-4" aria-hidden />
            {t('actions.rescan')}
          </Button>
          <CopyButton
            value={typeof window === 'undefined' ? '' : window.location.href}
            label={t('actions.share')}
            copiedLabel={t('actions.linkCopied')}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.print()
            }}
          >
            <Printer strokeWidth={1.75} className="size-4" aria-hidden />
            {t('actions.print')}
          </Button>
        </div>
      </section>

      {/* Caps notice */}
      {result.capsApplied.length > 0 ? (
        <Alert>
          <AlertTitle>{t('caps.title')}</AlertTitle>
          <AlertDescription>
            <ul className="flex list-disc flex-col gap-1 ps-5">
              {result.capsApplied.map((cap) => (
                <li key={cap}>{t(`caps.${cap}`)}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Summary counts */}
      <ul aria-label={t('counts.label')} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ['fail', result.summary.fail],
            ['warn', result.summary.warn],
            ['info', result.summary.info],
            ['pass', result.summary.pass],
          ] as const
        ).map(([status, count]) => {
          return (
            <li
              key={status}
              className={cn(
                'print-exact flex items-center gap-2 rounded-md px-3 py-2',
                STATUS_CHIP.get(status),
              )}
            >
              <StatusIcon status={status} className="size-4" />
              <span className="font-mono text-lg tabular-nums">{count}</span>
              <span className="text-sm">{t(`counts.${status}`)}</span>
            </li>
          )
        })}
      </ul>

      {/* Findings by category */}
      {CATEGORY_ORDER.map((category) => (
        <CategorySection
          key={category}
          category={category}
          result={result}
          platform={platform}
          onPlatformChange={setPlatform}
        />
      ))}

      <TlsPanel result={result} locale={locale} />
      <RedirectChain result={result} />
      <RawHeaders result={result} />
    </div>
  )
})

function CategorySection({
  category,
  result,
  platform,
  onPlatformChange,
}: {
  category: Category
  result: ScanResult
  platform: Platform
  onPlatformChange: (p: Platform) => void
}) {
  const t = useTranslations('results')
  const [showPassed, setShowPassed] = useState(false)
  const findings = sortFindings(result.findings.filter((f) => f.category === category))
  const open = findings.filter((f) => f.status !== 'pass')
  const passed = findings.filter((f) => f.status === 'pass')
  const titleId = `category-${category}`

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="flex items-center gap-2 text-xl font-semibold">
        <CategoryIcon category={category} className="size-5 text-link" />
        {t(`categories.${category}`)}
      </h2>
      {open.map((f) => (
        <FindingCard
          key={f.id}
          finding={f}
          platform={platform}
          onPlatformChange={onPlatformChange}
        />
      ))}
      {passed.length > 0 ? (
        <Collapsible open={showPassed} onOpenChange={setShowPassed}>
          <CollapsibleTrigger className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-link hover:underline print:hidden">
            {showPassed ? t('passed.hide') : t('passed.show', { count: passed.length })}
            <ChevronDown
              strokeWidth={1.75}
              className={cn(
                'size-4 transition-transform motion-reduce:transition-none',
                showPassed && 'rotate-180',
              )}
              aria-hidden
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 flex flex-col gap-3">
            {passed.map((f) => (
              <FindingCard
                key={f.id}
                finding={f}
                platform={platform}
                onPlatformChange={onPlatformChange}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  )
}

function TlsPanel({ result, locale }: { result: ScanResult; locale: string }) {
  const t = useTranslations('results.tls')
  const { tls } = result
  const days =
    tls.validTo === undefined
      ? undefined
      : Math.floor((Date.parse(tls.validTo) - Date.parse(result.scannedAt)) / DAY_MS)

  return (
    <Card className="break-inside-avoid">
      <CardHeader>
        <CardTitle className="font-heading">
          <h2>{t('title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tls.available ? (
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
            <dt className="text-muted-foreground">{t('protocol')}</dt>
            <dd className="font-mono">{tls.protocol ?? '—'}</dd>
            <dt className="text-muted-foreground">{t('trust')}</dt>
            <dd>{tls.authorized ? t('trusted') : t('notTrusted')}</dd>
            <dt className="text-muted-foreground">{t('issuer')}</dt>
            <dd>
              <bdi dir="ltr" className="ltr-isolate">
                {tls.issuer === undefined ? '—' : displayText(tls.issuer)}
              </bdi>
            </dd>
            <dt className="text-muted-foreground">{t('validUntil')}</dt>
            <dd>
              {tls.validTo === undefined ? '—' : formatDate(tls.validTo, locale)}
              {days === undefined ? null : (
                <span className="text-muted-foreground">
                  {' '}
                  ({days < 0 ? t('expired') : t('daysRemaining', { days })})
                </span>
              )}
            </dd>
          </dl>
        ) : (
          <p>{t('unavailable')}</p>
        )}
      </CardContent>
    </Card>
  )
}

function RedirectChain({ result }: { result: ScanResult }) {
  const t = useTranslations('results.redirects')
  const chain = result.target.redirectChain
  return (
    <section aria-labelledby="redirects-title" className="flex break-inside-avoid flex-col gap-3">
      <h2 id="redirects-title" className="flex items-center gap-2 text-xl font-semibold">
        <Route strokeWidth={1.75} className="size-5 text-link" aria-hidden />
        {t('title')}
      </h2>
      {chain.length <= 1 ? <p className="text-muted-foreground">{t('none')}</p> : null}
      {/* SC-30: plain text, never links. */}
      <ol className="flex flex-col gap-1">
        {chain.map((hop, index) => (
          <li key={`${String(index)}-${hop.url}`} className="flex items-baseline gap-3">
            <span className="w-10 shrink-0 font-mono text-sm tabular-nums">{hop.status}</span>
            <bdi dir="ltr" className="font-mono text-sm break-all ltr-isolate">
              {displayText(hop.url)}
            </bdi>
          </li>
        ))}
      </ol>
    </section>
  )
}

function RawHeaders({ result }: { result: ScanResult }) {
  const t = useTranslations('results.rawHeaders')
  const [open, setOpen] = useState(false)
  return (
    <section aria-labelledby="raw-title" className="flex flex-col gap-3 print:hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <h2 id="raw-title" className="text-xl font-semibold">
          <CollapsibleTrigger className="inline-flex items-center gap-2 rounded-md">
            {t('title', { count: result.rawHeaders.length })}
            <ChevronDown
              strokeWidth={1.75}
              className={cn(
                'size-5 transition-transform motion-reduce:transition-none',
                open && 'rotate-180',
              )}
              aria-hidden
            />
          </CollapsibleTrigger>
        </h2>
        <CollapsibleContent className="mt-3 flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{t('note')}</p>
          <div className="overflow-x-auto rounded-md border">
            <Table dir="ltr" className="font-mono text-xs ltr-isolate">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('value')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rawHeaders.map((h, index) => (
                  <TableRow key={`${String(index)}-${h.name}`}>
                    <TableCell className="align-top whitespace-nowrap">
                      {displayText(h.name)}
                    </TableCell>
                    <TableCell className="break-all whitespace-pre-wrap">
                      {displayText(h.value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  )
}
