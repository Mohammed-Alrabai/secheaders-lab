import type { Metadata } from 'next'

import { type Locale, routing } from './routing'

/** `06` §6: canonical URL plus hreflang alternates for one page in every locale. */
export function alternatesFor(locale: Locale, path: '' | '/about'): Metadata['alternates'] {
  return {
    canonical: `/${locale}${path}`,
    languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}${path}`])),
  }
}
