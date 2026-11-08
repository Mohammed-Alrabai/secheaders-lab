import { type LogWriter, logInternalError, logScan } from '../logger'
import { type TokenBucketLimiter, clientKey } from '../rate-limit'
import { type ErrorBody, ScanRequestSchema, ScanResultSchema } from '../schemas'
import { type ScanErrorCode, httpStatusFor, isScanError } from '../scanner/errors'
import { MAX_REQUEST_BYTES } from '../scanner/limits'
import type { ScanResult } from '../scanner/types'
import { normalizeAndValidate } from '../scanner/url-policy'

export interface ScanHandlerDeps {
  /** The only accepted `Origin` (SC-25), normalized to an origin string. */
  siteUrl: string
  limiter: TokenBucketLimiter
  runScan: (url: string) => Promise<ScanResult>
  log?: LogWriter
}

// SC-27: API responses are never cached. No CORS headers are ever emitted (SC-25).
const BASE_HEADERS = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
} as const

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...extra } })
}

/** SC-26: the error body carries a public code and nothing else. */
function errorResponse(code: ScanErrorCode, extra?: Record<string, string>): Response {
  const body: ErrorBody = { error: { code } }
  return json(httpStatusFor(code), body, extra)
}

/** `02` §4: every method other than POST. */
export function methodNotAllowed(): Response {
  return new Response(null, {
    status: 405,
    headers: { allow: 'POST', 'cache-control': 'no-store' },
  })
}

function isJson(contentType: string | null): boolean {
  return contentType?.split(';')[0]?.trim().toLowerCase() === 'application/json'
}

/**
 * SC-23: reads at most `max` bytes. Returns null when the body is larger, whatever the
 * Content-Length claims, so a lying or absent length cannot bypass the limit.
 */
async function readLimited(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > max) return null
  if (request.body === null) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks))
}

/**
 * `POST /api/scan` (`02` §4, `03` §4): same-origin check → rate limit → content type →
 * size → strict body validation → scan → output validation. Framework-agnostic so it can
 * be tested without Next.js; `app/api/scan/route.ts` wires in the real environment.
 */
export function createScanHandler(deps: ScanHandlerDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    const started = performance.now()
    const done = (outcome: 'ok' | ScanErrorCode, hostname?: string, ruleCount?: number) => {
      logScan(
        {
          outcome,
          durationMs: performance.now() - started,
          ...(hostname === undefined ? {} : { hostname }),
          ...(ruleCount === undefined ? {} : { ruleCount }),
        },
        deps.log,
      )
    }

    // SC-25: same-origin only. Browsers always send Origin on a cross-origin POST.
    const origin = request.headers.get('origin')
    if (origin !== null && origin !== deps.siteUrl) {
      done('FORBIDDEN_ORIGIN')
      return errorResponse('FORBIDDEN_ORIGIN')
    }

    // SC-24: defense-in-depth limiter (the platform rule is primary, ADR-024).
    const decision = deps.limiter.take(clientKey(request.headers))
    if (!decision.allowed) {
      done('RATE_LIMITED')
      return errorResponse('RATE_LIMITED', { 'retry-after': String(decision.retryAfterSeconds) })
    }

    if (!isJson(request.headers.get('content-type'))) {
      done('UNSUPPORTED_MEDIA_TYPE')
      return errorResponse('UNSUPPORTED_MEDIA_TYPE')
    }

    // A body stream that errors or is cancelled is a malformed request, never a 500
    // (ADR-039). The stream error text is discarded: it may name internal addresses.
    let raw: string | null
    try {
      raw = await readLimited(request, MAX_REQUEST_BYTES)
    } catch {
      done('INVALID_URL')
      return errorResponse('INVALID_URL')
    }
    if (raw === null) {
      done('PAYLOAD_TOO_LARGE')
      return errorResponse('PAYLOAD_TOO_LARGE')
    }

    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      done('INVALID_URL')
      return errorResponse('INVALID_URL')
    }
    const parsed = ScanRequestSchema.safeParse(body)
    if (!parsed.success) {
      done('INVALID_URL')
      return errorResponse('INVALID_URL')
    }

    // SC-01…SC-09 up front: a rejected URL never reaches the scanner.
    let hostname: string
    try {
      hostname = normalizeAndValidate(parsed.data.url).hostname
    } catch {
      done('INVALID_URL')
      return errorResponse('INVALID_URL')
    }

    try {
      const result = await deps.runScan(parsed.data.url)
      // SC-28: only the documented contract leaves the server.
      const safe = ScanResultSchema.parse(result)
      done('ok', hostname, safe.findings.length)
      return json(200, safe)
    } catch (error) {
      if (isScanError(error)) {
        done(error.code, hostname)
        return errorResponse(error.code)
      }
      logInternalError(error, deps.log)
      done('INTERNAL', hostname)
      return errorResponse('INTERNAL')
    }
  }
}
