'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { Skeleton } from '@/components/ui/skeleton'

const STEPS = ['resolving', 'connecting', 'analyzing'] as const
const STEP_MS = 1500

/** `06` §2: skeleton plus cosmetic, time-based step text announced politely. */
export function LoadingState({ host }: { host: string }) {
  const t = useTranslations('results.loading')
  const [step, setStep] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1))
    }, STEP_MS)
    return () => {
      clearInterval(timer)
    }
  }, [])

  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <p role="status" aria-live="polite" className="text-muted-foreground">
        {t('scanning', { host })} {t(`steps.${STEPS.at(step) ?? 'analyzing'}`)}
      </p>
      <div className="flex items-center gap-6">
        <Skeleton className="size-28 rounded-lg" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-11" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  )
}
