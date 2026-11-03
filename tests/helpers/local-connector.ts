import type { PinnedAddress } from '@/lib/scanner/dns'
import { type ConnectorFactory, createPinnedConnector } from '@/lib/scanner/safe-fetch'

export interface LocalRoute {
  http?: number
  https?: number
}

/**
 * Test connector factory: records the pinned address chosen for each hop (so tests can
 * assert SC-13), then dials the local test server instead of the public IP. TLS stays fully
 * verified against the hop's hostname, trusting only the test CA.
 */
export function localConnectorFactory(
  routes: LocalRoute,
  ca: string | undefined,
  log: { pinned: PinnedAddress; url: string }[] = [],
): ConnectorFactory {
  return (pinned, url) => {
    log.push({ pinned, url: url.href })
    const port = url.protocol === 'https:' ? routes.https : routes.http
    if (port === undefined) throw new Error(`no local route for ${url.protocol}`)
    return createPinnedConnector({
      address: '127.0.0.1',
      servername: url.hostname,
      port,
      ...(ca === undefined ? {} : { ca }),
    })
  }
}
