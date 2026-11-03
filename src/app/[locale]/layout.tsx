import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getTranslations } from 'next-intl/server'

import '../globals.css'
import { fontVariables } from '../fonts'
import { resolveLocaleParam } from '@/i18n/locale-param'
import { localeDirection } from '@/i18n/routing'
import { cn } from '@/lib/utils'

interface LocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params)
  const t = await getTranslations({ locale, namespace: 'home' })
  return { title: t('metaTitle') }
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const locale = await resolveLocaleParam(params)
  return (
    <html
      lang={locale}
      dir={localeDirection(locale)}
      className={cn('antialiased', fontVariables(locale))}
    >
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
