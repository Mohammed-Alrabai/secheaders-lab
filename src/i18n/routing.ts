import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'always',
  // ADR-017: no NEXT_LOCALE cookie; the URL prefix is the source of truth and our own
  // responses must not carry a Set-Cookie that our cookie rules would penalise.
  localeCookie: false,
})

export type Locale = (typeof routing.locales)[number]

/** Text direction for a locale; Arabic is right-to-left. */
export function localeDirection(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}
