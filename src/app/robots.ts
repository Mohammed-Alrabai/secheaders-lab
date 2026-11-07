import type { MetadataRoute } from 'next'

import { getEnv } from '@/lib/env'

// Built per request from the runtime site origin (ADR-014), not at build time.
export const dynamic = 'force-dynamic'

/** `06` §6: crawl the site, never the API. Result pages also send `noindex`. */
export default function robots(): MetadataRoute.Robots {
  const site = getEnv().siteUrl
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${site}/sitemap.xml`,
  }
}
