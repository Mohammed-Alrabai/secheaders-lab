import { NextRequest, type NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'

import { routing } from './i18n/routing'
import { buildPageCsp, generateNonce } from './lib/security-headers'

const handleI18nRouting = createMiddleware(routing)

/**
 * Locale routing plus a per-request nonce CSP (`03` §6). Next.js reads the nonce from the
 * request's `Content-Security-Policy` header and applies it to its own scripts and styles;
 * next-intl forwards the incoming request headers, so they are set before it runs.
 */
export default function proxy(request: NextRequest): NextResponse {
  const nonce = generateNonce()
  const csp = buildPageCsp(nonce, { dev: process.env.NODE_ENV === 'development' })

  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('content-security-policy', csp)

  const response = handleI18nRouting(new NextRequest(request, { headers }))
  response.headers.set('content-security-policy', csp)
  return response
}

export const config = {
  // Skip API routes, Next internals and files with an extension (icons, brand SVGs).
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
