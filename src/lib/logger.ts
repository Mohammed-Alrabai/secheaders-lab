import type { ScanErrorCode } from './scanner/errors'

/**
 * SC-37: the only fields ever logged for a scan. No URL path or query, no client IP,
 * no headers, no upstream text.
 */
export interface ScanLogEntry {
  outcome: 'ok' | ScanErrorCode
  durationMs: number
  /** Target hostname only; omitted when the input never became a valid URL. */
  hostname?: string
  ruleCount?: number
}

export type LogWriter = (line: string) => void

const stdoutWriter: LogWriter = (line) => {
  process.stdout.write(`${line}\n`)
}

/** Writes one structured JSON line per scan. */
export function logScan(
  entry: ScanLogEntry,
  write: LogWriter = stdoutWriter,
  now = new Date(),
): void {
  const record: Record<string, string | number> = {
    ts: now.toISOString(),
    event: 'scan',
    outcome: entry.outcome,
    durationMs: Math.round(entry.durationMs),
  }
  if (entry.hostname !== undefined) record.hostname = entry.hostname
  if (entry.ruleCount !== undefined) record.ruleCount = entry.ruleCount
  write(JSON.stringify(record))
}

/** Unexpected failures: the error class only, never its message (it may contain a URL). */
export function logInternalError(
  error: unknown,
  write: LogWriter = stdoutWriter,
  now = new Date(),
): void {
  const kind = error instanceof Error ? error.name : typeof error
  write(JSON.stringify({ ts: now.toISOString(), event: 'internal_error', kind }))
}
