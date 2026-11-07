import { ExternalLink } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { alternatesFor } from '@/i18n/alternates'
import { resolveLocaleParam } from '@/i18n/locale-param'
import { ruleMeta } from '@/lib/scanner/rules'
import { CAP_MAX_GRADE, GRADE_THRESHOLDS, SCORING_VERSION } from '@/lib/scanner/scoring'
import { CAP_IDS, type Category, RULE_IDS } from '@/lib/scanner/types'

interface AboutPageProps {
  params: Promise<{ locale: string }>
}

const CATEGORIES: readonly Category[] = ['headers', 'tls', 'cookies', 'disclosure']

const SOURCES = [
  { label: 'OWASP Secure Headers Project', url: 'https://owasp.org/www-project-secure-headers/' },
  {
    label: 'OWASP HTTP Headers Cheat Sheet',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html',
  },
  {
    label: 'MDN Web Docs: Content-Security-Policy',
    url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy',
  },
] as const

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params)
  const t = await getTranslations({ locale, namespace: 'about' })
  return { title: t('title'), alternates: alternatesFor(locale, '/about') }
}

/** Methodology (FR-12, `06` §2): checks and weights are rendered from the code, not copied. */
export default async function AboutPage({ params }: AboutPageProps) {
  const locale = await resolveLocaleParam(params)
  const [t, tResults, tRules] = await Promise.all([
    getTranslations({ locale, namespace: 'about' }),
    getTranslations({ locale, namespace: 'results' }),
    getTranslations({ locale, namespace: 'rules' }),
  ])

  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-12 px-4 py-12 md:px-6">
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold md:text-4xl">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">{t('intro')}</p>
      </header>

      <section aria-labelledby="what" className="flex flex-col gap-3">
        <h2 id="what" className="text-2xl font-semibold">
          {t('what.title')}
        </h2>
        <ul className="flex list-disc flex-col gap-2 ps-5">
          <li>{t('what.fetch')}</li>
          <li>{t('what.tls')}</li>
          <li>{t('what.redirect')}</li>
          <li>{t('what.never')}</li>
        </ul>
      </section>

      <section aria-labelledby="checks" className="flex flex-col gap-4">
        <h2 id="checks" className="text-2xl font-semibold">
          {t('checks.title')}
        </h2>
        <p className="text-muted-foreground">{t('checks.intro')}</p>
        {CATEGORIES.map((category) => (
          <div key={category} className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold">{tResults(`categories.${category}`)}</h3>
            <div
              tabIndex={0}
              role="region"
              aria-label={tResults(`categories.${category}`)}
              className="overflow-x-auto rounded-md border"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('checks.rule')}</TableHead>
                    <TableHead>{t('checks.severity')}</TableHead>
                    <TableHead className="text-end">{t('checks.maxPoints')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RULE_IDS.filter((id) => ruleMeta(id).category === category).map((id) => {
                    const meta = ruleMeta(id)
                    return (
                      <TableRow key={id}>
                        <TableCell className="whitespace-normal">
                          <span className="font-medium">{tRules(`${id}.title`)}</span>
                          <span className="block text-xs text-muted-foreground" dir="ltr">
                            {id}
                          </span>
                        </TableCell>
                        <TableCell>{tResults(`severity.${meta.maxSeverity}`)}</TableCell>
                        <TableCell className="text-end font-mono tabular-nums">
                          {meta.maxDeduction}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </section>

      <section aria-labelledby="grading" className="flex flex-col gap-4">
        <h2 id="grading" className="text-2xl font-semibold">
          {t('grading.title')}
        </h2>
        <p>{t('grading.formula')}</p>
        <div
          tabIndex={0}
          role="region"
          aria-label={t('grading.title')}
          className="overflow-x-auto rounded-md border"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('grading.grade')}</TableHead>
                <TableHead>{t('grading.minScore')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {GRADE_THRESHOLDS.map(([grade, min]) => (
                <TableRow key={grade}>
                  <TableCell className="font-heading font-bold">{grade}</TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {grade === 'F' ? t('grading.below', { score: 60 }) : `≥ ${String(min)}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p>{t('grading.aPlus')}</p>
        <h3 className="text-lg font-semibold">{t('grading.capsTitle')}</h3>
        <ul className="flex list-disc flex-col gap-1 ps-5">
          {CAP_IDS.map((cap) => (
            <li key={cap}>
              {tResults(`caps.${cap}`)}{' '}
              <span className="text-xs text-muted-foreground" dir="ltr">
                ({cap} → {CAP_MAX_GRADE.get(cap)})
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          {t('grading.version', { version: SCORING_VERSION })}
        </p>
      </section>

      <section aria-labelledby="limits" className="flex flex-col gap-3">
        <h2 id="limits" className="text-2xl font-semibold">
          {t('limits.title')}
        </h2>
        <ul className="flex list-disc flex-col gap-2 ps-5">
          <li>{t('limits.passive')}</li>
          <li>{t('limits.single')}</li>
          <li>{t('limits.meta')}</li>
          <li>{t('limits.compliance')}</li>
        </ul>
      </section>

      <section aria-labelledby="privacy" className="flex flex-col gap-3">
        <h2 id="privacy" className="text-2xl font-semibold">
          {t('privacy.title')}
        </h2>
        <p>{t('privacy.body')}</p>
      </section>

      <section aria-labelledby="terms" className="flex flex-col gap-3">
        <h2 id="terms" className="text-2xl font-semibold">
          {t('terms.title')}
        </h2>
        <p>{t('terms.body')}</p>
      </section>

      <section aria-labelledby="standards" className="flex flex-col gap-3">
        <h2 id="standards" className="text-2xl font-semibold">
          {t('standards.title')}
        </h2>
        <p>{t('standards.body')}</p>
        <ul className="flex flex-col gap-1">
          {SOURCES.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-link underline-offset-4 hover:underline"
              >
                {source.label}
                <ExternalLink strokeWidth={1.75} className="size-3.5" aria-hidden />
                <span className="sr-only">{tResults('opensInNewTab')}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="rounded-md border border-dashed p-4 text-sm">
          {t('standards.nca')} <strong>{t('standards.informational')}</strong>
        </p>
      </section>
    </article>
  )
}
