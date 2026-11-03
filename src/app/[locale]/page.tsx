import { getTranslations } from 'next-intl/server'

import { resolveLocaleParam } from '@/i18n/locale-param'

interface HomePageProps {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: HomePageProps) {
  const locale = await resolveLocaleParam(params)
  const [t, tc] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    getTranslations({ locale, namespace: 'common' }),
  ])
  return (
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col justify-center gap-3 px-4 md:px-6">
      <h1 className="text-3xl font-bold">
        <bdi>{tc('appName')}</bdi>
      </h1>
      <p className="text-lg">{t('tagline')}</p>
      <p className="text-muted-foreground">{t('placeholder')}</p>
    </main>
  )
}
