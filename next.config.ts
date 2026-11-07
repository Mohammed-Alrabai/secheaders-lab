import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

import { LOCKED_DOWN_CSP, SECURITY_HEADERS, SVG_CSP } from './src/lib/security-headers'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // No framework fingerprint (`03` §6, INF-POWERED-BY).
  poweredByHeader: false,
  headers() {
    return Promise.resolve([
      // Every response; pages get their nonce CSP from proxy.ts.
      { source: '/:path*', headers: [...SECURITY_HEADERS] },
      {
        source: '/api/:path*',
        headers: [{ key: 'Content-Security-Policy', value: LOCKED_DOWN_CSP }],
      },
      { source: '/brand/:path*', headers: [{ key: 'Content-Security-Policy', value: SVG_CSP }] },
    ])
  },
}

export default withNextIntl(nextConfig)
