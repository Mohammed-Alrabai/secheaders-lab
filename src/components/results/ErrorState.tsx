'use client'

import { CircleX, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { ScanForm } from '@/components/ScanForm'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/** Public API codes plus two client-side ones. */
export type ClientErrorCode = string

interface ErrorStateProps {
  code: ClientErrorCode
  retryAfterSeconds?: number | undefined
  onRetry?: (() => void) | undefined
  defaultUrl?: string
}

/** FR-13: a friendly, localized message for every error code, with a way forward. */
export function ErrorState({ code, retryAfterSeconds, onRetry, defaultUrl }: ErrorStateProps) {
  const t = useTranslations('errors')
  const retryable = onRetry !== undefined && code !== 'INVALID_URL' && code !== 'MISSING_URL'

  return (
    <div className="flex flex-col gap-8">
      <Alert variant="destructive">
        <CircleX strokeWidth={1.75} aria-hidden />
        <AlertTitle>
          <h2>{t(`${code}.title`)}</h2>
        </AlertTitle>
        <AlertDescription>
          <p>{t(`${code}.description`)}</p>
          {code === 'RATE_LIMITED' && retryAfterSeconds !== undefined ? (
            <p>{t('retryAfter', { seconds: retryAfterSeconds })}</p>
          ) : null}
        </AlertDescription>
      </Alert>
      {retryable ? (
        <Button type="button" variant="outline" className="w-fit" onClick={onRetry}>
          <RotateCcw strokeWidth={1.75} className="size-4" aria-hidden />
          {t('retry')}
        </Button>
      ) : null}
      <section aria-labelledby="scan-another" className="flex max-w-2xl flex-col gap-3">
        <h2 id="scan-another" className="text-lg font-semibold">
          {t('scanAnother')}
        </h2>
        <ScanForm {...(defaultUrl === undefined ? {} : { defaultValue: defaultUrl })} />
      </section>
    </div>
  )
}
