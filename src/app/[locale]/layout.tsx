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
import { getEnv } from '@/lib/env'
import { THEME_COOKIE, parseThemePreference, themeClass } from '@/lib/theme'
import { cn } from '@/lib/utils'

interface LocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params)
  const t = await getTranslations({ locale, namespace: 'meta' })
  const image = { url: `/og/${locale}.png`, width: 1200, height: 630, alt: t('title') }
  return {
    metadataBase: new URL(getEnv().siteUrl),
    title: { default: t('title'), template: `%s · SecHeaders Lab` },
    description: t('description'),
    // `06` §6: per-locale canonical and hreflang alternates.
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
    openGraph: {
      type: 'website',
      siteName: 'SecHeaders Lab',
      title: t('title'),
      description: t('description'),
      locale: locale === 'ar' ? 'ar' : 'en',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
      images: [image],
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
