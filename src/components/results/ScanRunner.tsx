'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { ErrorBodySchema, ScanResultSchema } from '@/lib/schemas'
import { SCAN_ERROR_CODES, type ScanErrorCode } from '@/lib/scanner/errors'
import type { ScanResult } from '@/lib/scanner/types'
import { displayText } from '@/lib/sanitize'

import { ErrorState } from './ErrorState'
import { LoadingState } from './LoadingState'
import { ScanReport } from './ScanReport'

type State =
  | { kind: 'loading' }
  | { kind: 'error'; code: string; retryAfterSeconds?: number | undefined }
  | { kind: 'done'; result: ScanResult }

/** When the body is not our JSON (e.g. a platform 429, T-16), infer the code from status. */
const STATUS_FALLBACK = new Map<number, ScanErrorCode>([
  [400, 'INVALID_URL'],
  [403, 'FORBIDDEN_ORIGIN'],
  [413, 'PAYLOAD_TOO_LARGE'],
  [415, 'UNSUPPORTED_MEDIA_TYPE'],
  [429, 'RATE_LIMITED'],
  [502, 'TARGET_UNREACHABLE'],
  [504, 'TARGET_TIMEOUT'],
])

function retryAfter(response: Response): number | undefined {
  const value = Number(response.headers.get('retry-after'))
  return Number.isInteger(value) && value > 0 ? value : undefined
}

async function runScan(url: string, signal: AbortSignal): Promise<State> {
  let response: Response
  try {
    response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
      signal,
    })
  } catch {
    return { kind: 'error', code: 'NETWORK' }
  }
  const body: unknown = await response.json().catch(() => null)
  if (response.ok) {
    // The API is ours, but its content describes an untrusted site: validate it anyway.
    const parsed = ScanResultSchema.safeParse(body)
    return parsed.success
      ? { kind: 'done', result: parsed.data }
      : { kind: 'error', code: 'INTERNAL' }
  }
  const error = ErrorBodySchema.safeParse(body)
  const code = error.success
    ? error.data.error.code
    : (STATUS_FALLBACK.get(response.status) ?? 'INTERNAL')
  return { kind: 'error', code, retryAfterSeconds: retryAfter(response) }
}

/**
 * Results page client (FR-06): reads `?url=`, POSTs to the API (the single scan path),
 * shows loading, error or the report, and moves focus to the result heading (`06` §5).
 */
export function ScanRunner({ url }: { url: string | null }) {
  const [state, setState] = useState<State>(
    url ? { kind: 'loading' } : { kind: 'error', code: 'MISSING_URL' },
  )
  const [attempt, setAttempt] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const retry = useCallback(() => {
    setState({ kind: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!url) return
    const controller = new AbortController()
    void runScan(url, controller.signal).then((next) => {
      if (!controller.signal.aborted) setState(next)
    })
    return () => {
      controller.abort()
    }
  }, [url, attempt])

  useEffect(() => {
    if (state.kind === 'done') headingRef.current?.focus()
  }, [state])

  const host = url ? displayText(url) : ''
  if (state.kind === 'loading') return <LoadingState host={host} />
  if (state.kind === 'error') {
    const known =
      state.code === 'NETWORK' ||
      state.code === 'MISSING_URL' ||
      (SCAN_ERROR_CODES as readonly string[]).includes(state.code)
    return (
      <ErrorState
        code={known ? state.code : 'INTERNAL'}
        retryAfterSeconds={state.retryAfterSeconds}
        onRetry={url ? retry : undefined}
        {...(url ? { defaultUrl: url } : {})}
      />
    )
  }
  return <ScanReport ref={headingRef} result={state.result} onRescan={retry} />
}
