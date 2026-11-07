import type { MetadataRoute } from 'next'

import { routing } from '@/i18n/routing'
import { getEnv } from '@/lib/env'

// Built per request from the runtime site origin (ADR-014), not at build time.
export const dynamic = 'force-dynamic'

/** `06` §6: home and methodology in every locale, with hreflang alternates. */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = getEnv().siteUrl
  return ['', '/about'].flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${site}/${locale}${path}`,
      alternates: {
        languages: Object.fromEntries(routing.locales.map((l) => [l, `${site}/${l}${path}`])),
      },
    })),
  )
}
