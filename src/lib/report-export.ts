import type { ScanResult } from '@/lib/scanner/types'

/** MIME type of the downloaded report (ADR-040). */
export const REPORT_JSON_TYPE = 'application/json'

/**
 * `secheaders-<host>-<YYYY-MM-DD>.json` from the final URL and the scan date (UTC). The
 * hostname is reduced to `[a-z0-9.-]`, so the name is safe on every file system.
 */
export function reportFileName(result: Pick<ScanResult, 'target' | 'scannedAt'>): string {
  let host = 'report'
  try {
    host = new URL(result.target.finalUrl).hostname
  } catch {
    // Keep the fallback; a validated result always has an absolute final URL.
  }
  const safeHost =
    host
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, '') || 'report'
  const date = /^\d{4}-\d{2}-\d{2}/.exec(result.scannedAt)?.[0] ?? 'undated'
  return `secheaders-${safeHost}-${date}.json`
}

/**
 * The report exactly as the API returned it: the same validated `ScanResult` the page
 * renders, with cookie values already redacted (ADR-015). Pretty-printed, newline-terminated.
 */
export function reportJson(result: ScanResult): string {
  return `${JSON.stringify(result, null, 2)}\n`
}
