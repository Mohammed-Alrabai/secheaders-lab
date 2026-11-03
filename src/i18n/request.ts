import { locale as rootLocale } from 'next/root-params'
import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'

import { type Locale, routing } from './routing'

// Message files are chosen from a fixed allowlist, never from a request-derived path.
async function loadMessages(locale: Locale) {
  return locale === 'ar'
    ? (await import('../../messages/ar.json')).default
    : (await import('../../messages/en.json')).default
}

export default getRequestConfig(async ({ locale: explicitLocale }) => {
  // An explicit `getTranslations({ locale })` wins; otherwise use the `[locale]` root segment.
  const requested = explicitLocale ?? (await rootLocale())
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
  return { locale, messages: await loadMessages(locale) }
})
