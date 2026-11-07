import { ExternalLink } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'

/** Author profile (PROGRESS T-2). The GitHub link is added once the repository exists. */
const LINKEDIN_URL = 'https://www.linkedin.com/in/mohammed-alrabai'

export async function SiteFooter() {
  const t = await getTranslations('common.footer')
  return (
    <footer className="mt-16 border-t print:hidden">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground md:px-6">
        <p>{t('disclaimer')}</p>
        <p>{t('privacy')}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/about" className="underline underline-offset-4 hover:text-foreground">
            {t('methodology')}
          </Link>
          <a
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
          >
            {t('author')}
            <ExternalLink strokeWidth={1.75} className="size-3.5" aria-hidden />
            <span className="sr-only">{t('opensInNewTab')}</span>
          </a>
        </div>
      </div>
    </footer>
  )
}
