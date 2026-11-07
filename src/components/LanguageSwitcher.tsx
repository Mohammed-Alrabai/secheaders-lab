'use client'

import { Languages } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

import { buttonVariants } from '@/components/ui/button'
import { Link, usePathname } from '@/i18n/navigation'

/** FR-10: switches EN ↔ AR, keeping the current page and its query string. */
export function LanguageSwitcher() {
  const t = useTranslations('common.language')
  const locale = useLocale()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const target = locale === 'ar' ? 'en' : 'ar'
  const query = Object.fromEntries(searchParams.entries())

  return (
    <Link
      href={{ pathname, query }}
      locale={target}
      hrefLang={target}
      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
      aria-label={t('switchTo')}
    >
      <Languages strokeWidth={1.75} className="size-4" aria-hidden />
      <span lang={target}>{t('other')}</span>
    </Link>
  )
}
