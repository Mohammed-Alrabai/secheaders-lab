import { notFound } from 'next/navigation'
import { hasLocale } from 'next-intl'

import { type Locale, routing } from './routing'

/**
 * Validates the `[locale]` route segment against the allowlist and returns it.
 * Unknown locales render the 404 page.
 */
export async function resolveLocaleParam(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  return locale
}
