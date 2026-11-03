import { describe, expect, it } from 'vitest'

import {
  SCAN_ERROR_CODES,
  ScanError,
  type ScanErrorCode,
  httpStatusFor,
  isScanError,
} from '@/lib/scanner/errors'

describe('ScanError', () => {
  it('carries a public code and an internal detail', () => {
    const error = new ScanError('INVALID_URL', 'PORT')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ScanError')
    expect(error.code).toBe('INVALID_URL')
    expect(error.detail).toBe('PORT')
    expect(error.message).toBe('INVALID_URL (PORT)')
  })

  it('works without a detail', () => {
    const error = new ScanError('INTERNAL')
    expect(error.detail).toBeUndefined()
    expect(error.message).toBe('INTERNAL')
  })

  it('isScanError narrows by type and optional code', () => {
    const error = new ScanError('BLOCKED_TARGET')
    expect(isScanError(error)).toBe(true)
    expect(isScanError(error, 'BLOCKED_TARGET')).toBe(true)
    expect(isScanError(error, 'INVALID_URL')).toBe(false)
    expect(isScanError(new Error('BLOCKED_TARGET'))).toBe(false)
    expect(isScanError('BLOCKED_TARGET')).toBe(false)
  })
})

describe('httpStatusFor (02 §4)', () => {
  it.each([
    ['INVALID_URL', 400],
    ['PAYLOAD_TOO_LARGE', 413],
    ['UNSUPPORTED_MEDIA_TYPE', 415],
    ['BLOCKED_TARGET', 422],
    ['DNS_NOT_FOUND', 422],
    ['RATE_LIMITED', 429],
    ['TARGET_UNREACHABLE', 502],
    ['TARGET_TIMEOUT', 504],
    ['INTERNAL', 500],
  ] as const)('%s → %i', (code, status) => {
    expect(httpStatusFor(code)).toBe(status)
  })

  it('covers every code', () => {
    for (const code of SCAN_ERROR_CODES) {
      expect(httpStatusFor(code)).toBeGreaterThanOrEqual(400)
    }
  })

  it('throws instead of guessing for a value outside the union', () => {
    const bogus = JSON.parse('"NOT_A_CODE"') as ScanErrorCode
    expect(() => httpStatusFor(bogus)).toThrow(/Unhandled scan error code/)
  })
})
