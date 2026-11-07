'use client'

import { Cookie } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSyncExternalStore } from 'react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { readNoticeDismissed, writeNoticeDismissed } from '@/lib/cookie-notice'

// If storage is unavailable the dismissal still holds for the rest of the visit.
let dismissedThisVisit = false
const listeners = new Set<() => void>()

const getStorage = () => window.localStorage

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

const isDismissed = () => dismissedThisVisit || readNoticeDismissed(getStorage)
// Never rendered on the server: whether it was dismissed is only known in the browser.
const isDismissedOnServer = () => true

function dismiss() {
  dismissedThisVisit = true
  writeNoticeDismissed(getStorage)
  for (const listener of listeners) listener()
  // The focused button disappears; hand focus back to the page instead of <body>.
  document.getElementById('main')?.focus({ preventScroll: true })
}

/**
 * First-visit cookie notice (ADR-037). Informational, not a consent wall: the site sets no
 * tracking cookies, so there is nothing to opt into. It does not block the page or trap focus.
 */
export function CookieNotice() {
  const t = useTranslations('cookieNotice')
  const dismissed = useSyncExternalStore(subscribe, isDismissed, isDismissedOnServer)
  if (dismissed) return null

  return (
    <section
      aria-labelledby="cookie-notice-title"
      aria-describedby="cookie-notice-body"
      data-testid="cookie-notice"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg animate-in rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl ring-1 ring-foreground/5 duration-300 fade-in slide-in-from-bottom-4 motion-reduce:animate-none sm:inset-x-auto sm:end-6 sm:bottom-6 sm:p-5 print:hidden"
    >
      <div className="flex gap-4">
        <span
          aria-hidden
          className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-link sm:flex"
        >
          <Cookie strokeWidth={1.75} className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 id="cookie-notice-title" className="font-heading text-base font-semibold">
            {t('title')}
          </h2>
          <p id="cookie-notice-body" className="text-sm leading-6 text-muted-foreground">
            {t('body')}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Link href="/cookies" className={buttonVariants({ variant: 'outline' })}>
          {t('policy')}
        </Link>
        <Button type="button" onClick={dismiss}>
          {t('accept')}
        </Button>
      </div>
    </section>
  )
}
