import { ExternalLink } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import { REPO_URL } from '@/lib/legal'

/** Author profile (PROGRESS T-2). */
const LINKEDIN_URL = 'https://www.linkedin.com/in/mohammed-alrabai'

const LINK_CLASS = 'underline-offset-4 hover:text-foreground hover:underline'

export async function SiteFooter() {
  const t = await getTranslations('common.footer')
  const external = [
    { href: REPO_URL, label: t('source') },
    { href: LINKEDIN_URL, label: t('author') },
  ]
  return (
    <footer className="mt-16 border-t print:hidden">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 text-sm text-muted-foreground md:px-6">
        <div className="flex flex-col gap-2">
          <p>{t('disclaimer')}</p>
          <p>{t('privacy')}</p>
        </div>
        <div className="flex flex-col gap-4 border-t pt-6 md:flex-row md:items-center md:justify-between">
          <nav aria-label={t('legalLabel')}>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <li>
                <Link href="/about" className={LINK_CLASS}>
                  {t('methodology')}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className={LINK_CLASS}>
                  {t('privacyLink')}
                </Link>
              </li>
              <li>
                <Link href="/terms" className={LINK_CLASS}>
                  {t('termsLink')}
                </Link>
              </li>
              <li>
                <Link href="/cookies" className={LINK_CLASS}>
                  {t('cookiesLink')}
                </Link>
              </li>
            </ul>
          </nav>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {external.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 ${LINK_CLASS}`}
                >
                  {link.label}
                  <ExternalLink strokeWidth={1.75} className="size-3.5" aria-hidden />
                  <span className="sr-only">{t('opensInNewTab')}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
