import { getTranslations } from 'next-intl/server'

export default async function NotFound() {
  const t = await getTranslations('notFound')
  return (
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col justify-center gap-3 px-4 md:px-6">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('description')}</p>
    </main>
  )
}
