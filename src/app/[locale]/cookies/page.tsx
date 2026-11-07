import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { LegalPage } from '@/components/LegalPage'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { alternatesFor } from '@/i18n/alternates'
import { resolveLocaleParam } from '@/i18n/locale-param'
import type { Locale } from '@/i18n/routing'
import { COOKIE_NOTICE_KEY } from '@/lib/cookie-notice'
import { THEME_COOKIE } from '@/lib/theme'

interface CookiesPageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: CookiesPageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params)
  const t = await getTranslations({ locale, namespace: 'legal.cookies' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesFor(locale, '/cookies'),
  }
}

/** The names come from the code, so the table cannot drift from what the site stores. */
const STORED = [
  { name: THEME_COOKIE, key: 'theme' },
  { name: COOKIE_NOTICE_KEY, key: 'notice' },
] as const

async function StorageTable({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'legal.cookies.table' })
  return (
    <section aria-labelledby="stored" className="flex flex-col gap-3">
      <h2 id="stored" className="text-xl font-semibold md:text-2xl">
        {t('title')}
      </h2>
      <div
        tabIndex={0}
        role="region"
        aria-label={t('caption')}
        className="overflow-x-auto rounded-md border"
      >
        <Table>
          <TableCaption className="sr-only">{t('caption')}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('type')}</TableHead>
              <TableHead>{t('purpose')}</TableHead>
              <TableHead>{t('duration')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STORED.map((item) => (
              <TableRow key={item.name}>
                <TableCell className="align-top font-mono text-xs" dir="ltr">
                  {item.name}
                </TableCell>
                <TableCell className="align-top whitespace-normal">
                  {t(`${item.key}.type`)}
                </TableCell>
                <TableCell className="min-w-56 align-top whitespace-normal">
                  {t(`${item.key}.purpose`)}
                </TableCell>
                <TableCell className="align-top whitespace-normal">
                  {t(`${item.key}.duration`)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

export default async function CookiesPage({ params }: CookiesPageProps) {
  const locale = await resolveLocaleParam(params)
  return (
    <LegalPage
      locale={locale}
      page="cookies"
      afterFirstSection={<StorageTable locale={locale} />}
    />
  )
}
