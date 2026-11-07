import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { LegalPage } from '@/components/LegalPage'
import { alternatesFor } from '@/i18n/alternates'
import { resolveLocaleParam } from '@/i18n/locale-param'

interface PrivacyPageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PrivacyPageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params)
  const t = await getTranslations({ locale, namespace: 'legal.privacy' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesFor(locale, '/privacy'),
  }
}

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  return <LegalPage locale={await resolveLocaleParam(params)} page="privacy" />
}
