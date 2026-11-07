import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { NextIntlClientProvider } from 'next-intl'
import { getTranslations } from 'next-intl/server'

import '../globals.css'
import { fontVariables } from '../fonts'
import { Providers } from '@/components/Providers'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { resolveLocaleParam } from '@/i18n/locale-param'
import { localeDirection, routing } from '@/i18n/routing'
import { THEME_COOKIE, parseThemePreference, themeClass } from '@/lib/theme'
import { cn } from '@/lib/utils'

interface LocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params)
  const t = await getTranslations({ locale, namespace: 'meta' })
  return {
    title: { default: t('title'), template: `%s · SecHeaders Lab` },
    description: t('description'),
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
  }
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const locale = await resolveLocaleParam(params)
  const [t, cookieStore] = await Promise.all([
    getTranslations({ locale, namespace: 'common' }),
    cookies(),
  ])
  const theme = parseThemePreference(cookieStore.get(THEME_COOKIE)?.value)
  const dir = localeDirection(locale)

  return (
    <html
      lang={locale}
      dir={dir}
      className={cn('antialiased', fontVariables(locale), themeClass(theme))}
    >
      <body className="flex min-h-svh flex-col">
        <NextIntlClientProvider>
          <Providers dir={dir}>
            <a
              href="#main"
              className="sr-only rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50"
            >
              {t('skipToContent')}
            </a>
            <SiteHeader theme={theme} />
            <main id="main" tabIndex={-1} className="flex-1 outline-none">
              {children}
            </main>
            <SiteFooter />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
