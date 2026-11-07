import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

import { ScanRunner } from '@/components/results/ScanRunner'
import { resolveLocaleParam } from '@/i18n/locale-param'

interface ScanPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ url?: string | string[] }>
}

export async function generateMetadata({ params }: ScanPageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params)
  const t = await getTranslations({ locale, namespace: 'results' })
  // `06` §6: results depend on the query, so they are never indexed.
  return { title: t('metaTitle'), robots: { index: false, follow: false } }
}

/** `/{locale}/scan?url=…` (FR-06): the shell renders on the server, the scan runs in the client. */
export default async function ScanPage({ params, searchParams }: ScanPageProps) {
  const locale = await resolveLocaleParam(params)
  const [t, query] = await Promise.all([
    getTranslations({ locale, namespace: 'results' }),
    searchParams,
  ])
  const url = typeof query.url === 'string' && query.url.trim() !== '' ? query.url : null

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:px-6">
      <h1 className="sr-only">{t('pageTitle')}</h1>
      <Suspense>
        <ScanRunner key={url ?? ''} url={url} />
      </Suspense>
    </div>
  )
}
