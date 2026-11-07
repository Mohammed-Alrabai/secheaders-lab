import { getTranslations } from 'next-intl/server'

import { buttonVariants } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

export default async function NotFound() {
  const t = await getTranslations('notFound')
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-20 md:px-6">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('description')}</p>
      <Link href="/" className={buttonVariants({ variant: 'outline' })}>
        {t('home')}
      </Link>
    </div>
  )
}
