/**
 * Public error codes of the scan API (`02` §4). They are the only error information that
 * ever leaves the server (SC-26).
 */
export const SCAN_ERROR_CODES = [
  'INVALID_URL',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'BLOCKED_TARGET',
  'DNS_NOT_FOUND',
  'RATE_LIMITED',
  'TARGET_UNREACHABLE',
  'TARGET_TIMEOUT',
  'INTERNAL',
] as const

export type ScanErrorCode = (typeof SCAN_ERROR_CODES)[number]

/**
 * Internal reason attached to a {@link ScanError} for logs and tests only. Never sent to
 * clients (SC-26), and never contains URLs, IPs or upstream messages (SC-37).
 */
export type ScanErrorDetail =
  | 'INPUT_TYPE'
  | 'TOO_LONG'
  | 'CONTROL_CHARS'
  | 'SCHEME'
  | 'PARSE'
  | 'CREDENTIALS'
  | 'PORT'
  | 'IP_LITERAL'
  | 'HOSTNAME_SHAPE'
  | 'RESERVED_NAME'
  | 'NON_PUBLIC_ADDRESS'
  | 'NO_ADDRESSES'
  | 'DNS_FAILURE'
  | 'DNS_TIMEOUT'
  | 'TOO_MANY_REDIRECTS'
  | 'REDIRECT_LOOP'
  | 'CONNECT_FAILED'
  | 'CONNECT_TIMEOUT'
  | 'HEADERS_TIMEOUT'
  | 'HEADERS_TOO_LARGE'
  | 'TLS_FAILURE'
  | 'BUDGET_EXCEEDED'
  | 'PROTOCOL_ERROR'

/** Typed failure of a scan step. `code` is public, `detail` is internal. */
export class ScanError extends Error {
  readonly code: ScanErrorCode
  readonly detail: ScanErrorDetail | undefined

  constructor(code: ScanErrorCode, detail?: ScanErrorDetail) {
    super(detail ? `${code} (${detail})` : code)
    this.name = 'ScanError'
    this.code = code
    this.detail = detail
  }
}

/** Type guard that also narrows to a specific code when one is given. */
export function isScanError(value: unknown, code?: ScanErrorCode): value is ScanError {
  return value instanceof ScanError && (code === undefined || value.code === code)
}

/** HTTP status for each public error code (`02` §4). */
export function httpStatusFor(code: ScanErrorCode): number {
  switch (code) {
    case 'INVALID_URL':
      return 400
    case 'PAYLOAD_TOO_LARGE':
      return 413
    case 'UNSUPPORTED_MEDIA_TYPE':
      return 415
    case 'BLOCKED_TARGET':
    case 'DNS_NOT_FOUND':
      return 422
    case 'RATE_LIMITED':
      return 429
    case 'TARGET_UNREACHABLE':
      return 502
    case 'TARGET_TIMEOUT':
      return 504
    case 'INTERNAL':
      return 500
    default: {
      const exhaustive: never = code
      throw new Error(`Unhandled scan error code: ${String(exhaustive)}`)
    }
  }
}
