import type { Metadata } from 'next'

import { type Locale, routing } from './routing'

/** `06` §6: canonical URL plus hreflang alternates for one page in every locale. */
/** Every indexable page path (without the locale prefix). */
export type PagePath = '' | '/about' | '/privacy' | '/terms' | '/cookies'

export function alternatesFor(locale: Locale, path: PagePath): Metadata['alternates'] {
  return {
    canonical: `/${locale}${path}`,
    languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}${path}`])),
  }
}
