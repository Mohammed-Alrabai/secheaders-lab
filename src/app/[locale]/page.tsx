import { ArrowRight, Languages, ShieldCheck, Wrench } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { ScanForm } from '@/components/ScanForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'
import { resolveLocaleParam } from '@/i18n/locale-param'
import { checkUrlInput } from '@/lib/client-url-check'
import { getEnv } from '@/lib/env'

interface HomePageProps {
  params: Promise<{ locale: string }>
}

const FEATURES = [
  { key: 'passive', Icon: ShieldCheck },
  { key: 'fixes', Icon: Wrench },
  { key: 'bilingual', Icon: Languages },
] as const

export default async function HomePage({ params }: HomePageProps) {
  const locale = await resolveLocaleParam(params)
  const t = await getTranslations({ locale, namespace: 'home' })

  // "This site" is offered only when the configured origin is itself scannable.
  const ownHost = new URL(getEnv().siteUrl).hostname
  const examples = [
    { label: 'example.com', value: 'example.com' },
    ...(checkUrlInput(ownHost) === null ? [{ label: t('examples.self'), value: ownHost }] : []),
  ]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-12 md:px-6 md:py-20">
      <section aria-labelledby="hero-title" className="flex max-w-3xl flex-col gap-6">
        <h1 id="hero-title" className="text-3xl font-bold tracking-tight md:text-5xl">
          {t('title')}
        </h1>
        <p className="text-lg text-muted-foreground">{t('lead')}</p>
        <ScanForm examples={examples} />
      </section>

      <section aria-labelledby="features-title" className="flex flex-col gap-6">
        <h2 id="features-title" className="text-xl font-semibold">
          {t('features.title')}
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ key, Icon }) => (
            <li key={key}>
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center gap-3">
                  <Icon strokeWidth={1.75} className="size-6 shrink-0 text-link" aria-hidden />
                  <CardTitle className="font-heading">{t(`features.${key}.title`)}</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  {t(`features.${key}.body`)}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-title" className="flex flex-col gap-6">
        <h2 id="how-title" className="text-xl font-semibold">
          {t('how.title')}
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {(['step1', 'step2', 'step3'] as const).map((step, index) => (
            <li key={step} className="flex gap-3">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary font-mono text-sm text-primary-foreground tabular-nums"
              >
                {index + 1}
              </span>
              <p className="pt-1">{t(`how.${step}`)}</p>
            </li>
          ))}
        </ol>
        <Link
          href="/about"
          className="inline-flex w-fit items-center gap-1 text-link underline-offset-4 hover:underline"
        >
          {t('how.methodologyLink')}
          <ArrowRight strokeWidth={1.75} className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
      </section>
    </div>
  )
}
