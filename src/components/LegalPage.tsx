import { ExternalLink } from 'lucide-react'
import { getFormatter, getTranslations } from 'next-intl/server'
import { Fragment, type ReactNode } from 'react'

import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import {
  LEGAL_PAGES,
  LEGAL_UPDATED,
  type LegalPage as LegalPageId,
  REPO_ISSUES_URL,
  REPO_SECURITY_URL,
  parseLegalSections,
} from '@/lib/legal'

const LINK_KEYS = new Map<LegalPageId, 'privacyLink' | 'termsLink' | 'cookiesLink'>([
  ['privacy', 'privacyLink'],
  ['terms', 'termsLink'],
  ['cookies', 'cookiesLink'],
])

interface LegalPageProps {
  locale: Locale
  page: LegalPageId
  /** Extra content placed after the first section (the cookie table). */
  afterFirstSection?: ReactNode
}

/** Shared layout for the privacy, terms and cookie pages (ADR-037). */
export async function LegalPage({ locale, page, afterFirstSection }: LegalPageProps) {
  const [t, tLegal, tFooter, tResults, format] = await Promise.all([
    getTranslations({ locale, namespace: `legal.${page}` }),
    getTranslations({ locale, namespace: 'legal' }),
    getTranslations({ locale, namespace: 'common.footer' }),
    getTranslations({ locale, namespace: 'results' }),
    getFormatter({ locale }),
  ])
  const sections = parseLegalSections(t.raw('sections'))
  const updated = new Date(`${LEGAL_UPDATED}T00:00:00Z`)

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-12 md:px-6 md:py-16">
      <header className="flex flex-col gap-4 border-b pb-8">
        <h1 className="text-3xl font-bold md:text-4xl">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">{t('intro')}</p>
        <p className="text-sm text-muted-foreground">
          <time dateTime={LEGAL_UPDATED}>
            {tLegal('updated', {
              date: format.dateTime(updated, { dateStyle: 'long', timeZone: 'UTC' }),
            })}
          </time>
        </p>
      </header>

      {sections.map((section, index) => {
        const id = `section-${String(index + 1)}`
        return (
          <Fragment key={id}>
            <section aria-labelledby={id} className="flex flex-col gap-3">
              <h2 id={id} className="text-xl font-semibold md:text-2xl">
                {section.title}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="leading-7">
                  {paragraph}
                </p>
              ))}
              {section.items.length > 0 ? (
                <ul className="flex list-disc flex-col gap-2 ps-5 leading-7">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
            {index === 0 ? afterFirstSection : null}
          </Fragment>
        )
      })}

      <section aria-labelledby="contact" className="flex flex-col gap-3 rounded-lg border p-5">
        <h2 id="contact" className="text-lg font-semibold">
          {tLegal('contactTitle')}
        </h2>
        <p className="leading-7 text-muted-foreground">{tLegal('contactBody')}</p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {[
            { href: REPO_ISSUES_URL, label: tLegal('issues') },
            { href: REPO_SECURITY_URL, label: tLegal('security') },
          ].map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-link underline-offset-4 hover:underline"
              >
                {link.label}
                <ExternalLink strokeWidth={1.75} className="size-3.5" aria-hidden />
                <span className="sr-only">{tResults('opensInNewTab')}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <nav aria-label={tLegal('related')} className="flex flex-col gap-2 print:hidden">
        <h2 className="text-sm font-medium text-muted-foreground">{tLegal('related')}</h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {LEGAL_PAGES.filter((other) => other !== page).map((other) => (
            <li key={other}>
              <Link href={`/${other}`} className="text-link underline-offset-4 hover:underline">
                {tFooter(LINK_KEYS.get(other) ?? 'privacyLink')}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  )
}
