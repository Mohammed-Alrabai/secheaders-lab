import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { buttonVariants } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type { ThemePreference } from '@/lib/theme'

export async function SiteHeader({ theme }: { theme: ThemePreference }) {
  const t = await getTranslations('common')
  return (
    <header className="border-b print:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        {/* 08 §8: the name is never translated. The optional Arabic subtitle was removed (ADR-037). */}
        <Link href="/" className="flex items-center rounded-md" aria-label={t('homeLink')}>
          <Logo />
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
