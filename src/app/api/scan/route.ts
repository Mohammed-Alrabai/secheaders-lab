import { createScanHandler, methodNotAllowed } from '@/lib/api/scan-handler'
import { getEnv } from '@/lib/env'
import { TokenBucketLimiter } from '@/lib/rate-limit'
import { scan } from '@/lib/scanner/index'
import { buildUserAgent } from '@/lib/scanner/safe-fetch'
import { APP_VERSION } from '@/lib/version'

// The scanner needs Node's dns/net/tls (`02` §1) and every request is a fresh scan.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let handler: ((request: Request) => Promise<Response>) | undefined

/** Built on first request so a build without env vars never evaluates `getEnv()`. */
function getHandler(): (request: Request) => Promise<Response> {
  if (handler === undefined) {
    const env = getEnv()
    const userAgent = buildUserAgent(APP_VERSION, env.siteUrl)
    handler = createScanHandler({
      siteUrl: env.siteUrl,
      limiter: new TokenBucketLimiter({ perMinute: env.scanRateLimitPerMin }),
      runScan: (url) => scan(url, { userAgent, budgetMs: env.scanTotalBudgetMs }),
    })
  }
  return handler
}

export function POST(request: Request): Promise<Response> {
  return getHandler()(request)
}

export const GET = methodNotAllowed
export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
export const OPTIONS = methodNotAllowed
