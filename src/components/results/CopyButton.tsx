'use client'

import { Check, Copy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

interface CopyButtonProps {
  value: string
  /** Visible label; omitted for an icon-only button (then used as the accessible name). */
  label?: string
  accessibleLabel?: string
  copiedLabel?: string
}

/** Copies text and announces the result in a polite live region (`06` §2). */
export function CopyButton({ value, label, accessibleLabel, copiedLabel }: CopyButtonProps) {
  const t = useTranslations('results.actions')
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => {
      setState('idle')
    }, 2000)
    return () => {
      clearTimeout(timer)
    }
  }, [state])

  const Icon = state === 'copied' ? Check : Copy
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={label ? 'sm' : 'icon-sm'}
        aria-label={label ? undefined : (accessibleLabel ?? t('copy'))}
        onClick={() => {
          navigator.clipboard.writeText(value).then(
            () => {
              setState('copied')
            },
            () => {
              setState('failed')
            },
          )
        }}
      >
        <Icon strokeWidth={1.75} className="size-4" aria-hidden />
        {label}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === 'copied'
          ? (copiedLabel ?? t('copied'))
          : state === 'failed'
            ? t('copyFailed')
            : ''}
      </span>
    </>
  )
}
