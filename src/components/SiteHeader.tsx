import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { buttonVariants } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type { ThemePreference } from '@/lib/theme'

export async function SiteHeader({ theme }: { theme: ThemePreference }) {
  const [t, locale] = await Promise.all([getTranslations('common'), getLocale()])
  return (
    <header className="border-b print:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-3 rounded-md" aria-label={t('homeLink')}>
          <Logo />
          {/* 08 §8: the name is never translated; Arabic adds a subtitle beside it. */}
          {locale === 'ar' ? (
            <span className="hidden font-heading text-sm text-muted-foreground sm:inline">
              {t('subtitle')}
            </span>
          ) : null}
        </Link>
        <nav aria-label={t('navLabel')} className="flex items-center gap-1">
          <Link href="/about" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            {t('nav.about')}
          </Link>
          <Suspense>
            <LanguageSwitcher />
          </Suspense>
          <ThemeToggle initial={theme} />
        </nav>
      </div>
    </header>
  )
}
