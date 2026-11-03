import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

import { SECURITY_HEADERS } from './src/lib/security-headers'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // No framework fingerprint (`03` §6, INF-POWERED-BY).
  poweredByHeader: false,
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: [...SECURITY_HEADERS] }])
  },
}

export default withNextIntl(nextConfig)
