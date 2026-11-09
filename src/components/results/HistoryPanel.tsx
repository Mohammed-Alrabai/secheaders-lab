'use client'

import { History } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type Comparison,
  compareScans,
  disableHistory,
  earlierScans,
  enableHistory,
  parseHistory,
  readHistoryRaw,
  saveToHistory,
} from '@/lib/scan-history'
import type { ScanResult, Status } from '@/lib/scanner/types'

import { formatDate, signed } from './format'

// Same-tab changes notify listeners directly; other tabs arrive as `storage` events.
const listeners = new Set<() => void>()
const notify = () => {
  for (const listener of listeners) listener()
}
function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}
const getStorage = () => window.localStorage
const getSnapshot = () => readHistoryRaw(getStorage)
const getServerSnapshot = () => null

/**
 * "Compare with earlier scans" (ADR-045): opt-in history kept in this browser only. When on,
 * the current result is saved and earlier scans of the same host can be compared with it.
 */
export function HistoryPanel({ result }: { result: ScanResult }) {
  const t = useTranslations('results.history')
  const locale = useLocale()
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const history = useMemo(() => parseHistory(raw), [raw])
  const enabled = history !== null
  const [unavailable, setUnavailable] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (enabled && saveToHistory(getStorage, result)) notify()
  }, [enabled, result])

  const earlier = useMemo(() => (history ? earlierScans(history, result) : []), [history, result])
  const chosen = earlier.find((r) => r.scannedAt === selected) ?? null

  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-3 print:hidden">
      <h2 id="history-title" className="flex items-center gap-2 text-xl font-semibold">
        <History strokeWidth={1.75} className="size-5 text-link" aria-hidden />
        {t('title')}
      </h2>

      {!enabled ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground">{t('off')}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (enableHistory(getStorage)) notify()
              else setUnavailable(true)
            }}
          >
            {t('enable')}
          </Button>
          {unavailable ? (
            <p role="alert" className="text-sm">
              {t('unavailable')}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {earlier.length === 0 ? (
            <p className="text-muted-foreground">{t('empty')}</p>
          ) : (
            <ul aria-label={t('listLabel')} className="flex flex-col gap-2">
              {earlier.map((r) => (
                <li
                  key={r.scannedAt}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <span className="font-mono text-sm tabular-nums">
                    {t('entry', {
                      date: formatDate(r.scannedAt, locale),
                      score: r.score,
                      grade: r.grade,
                    })}
                  </span>
                  <Button
                    type="button"
                    variant={selected === r.scannedAt ? 'default' : 'outline'}
                    size="sm"
                    aria-pressed={selected === r.scannedAt}
                    onClick={() => {
                      setSelected(selected === r.scannedAt ? null : r.scannedAt)
                    }}
                  >
                    {t('compare')}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {chosen ? (
            <ComparisonView
              comparison={compareScans(chosen, result)}
              date={formatDate(chosen.scannedAt, locale)}
              before={chosen.score}
              after={result.score}
            />
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => {
              disableHistory(getStorage)
              setSelected(null)
              notify()
            }}
          >
            {t('disable')}
          </Button>
        </div>
      )}
    </section>
  )
}

function ComparisonView({
  comparison,
  date,
  before,
  after,
}: {
  comparison: Comparison
  date: string
  before: number
  after: number
}) {
  const t = useTranslations('results.history')
  const tStatus = useTranslations('results.status')
  const tRules = useTranslations('rules')
  const status = (s: Status | null) => (s === null ? t('table.absent') : tStatus(s))

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3" data-testid="comparison">
      <p className="font-medium">{t('comparing', { date })}</p>
      <p>
        {t('scoreChange', { before, after, delta: signed(comparison.scoreDelta) })}
        {' · '}
        {t('gradeChange', { before: comparison.gradeBefore, after: comparison.gradeAfter })}
      </p>
      {comparison.changes.length === 0 ? (
        <p className="text-muted-foreground">{t('noChanges')}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableCaption className="sr-only">{t('table.caption')}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.check')}</TableHead>
                <TableHead>{t('table.before')}</TableHead>
                <TableHead>{t('table.after')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparison.changes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="whitespace-normal">{tRules(`${c.id}.title`)}</TableCell>
                  <TableCell>{status(c.before)}</TableCell>
                  <TableCell>{status(c.after)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
