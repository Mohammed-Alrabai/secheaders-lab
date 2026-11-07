import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { LegalPage } from '@/components/LegalPage'
import { alternatesFor } from '@/i18n/alternates'
import { resolveLocaleParam } from '@/i18n/locale-param'

interface TermsPageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: TermsPageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params)
  const t = await getTranslations({ locale, namespace: 'legal.terms' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesFor(locale, '/terms'),
  }
}

export default async function TermsPage({ params }: TermsPageProps) {
  return <LegalPage locale={await resolveLocaleParam(params)} page="terms" />
}
