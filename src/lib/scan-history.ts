import { z } from 'zod'

import { ScanResultSchema } from '@/lib/schemas'
import {
  RULE_IDS,
  type Grade,
  type RuleId,
  type ScanResult,
  type Status,
} from '@/lib/scanner/types'

/**
 * Opt-in scan history kept only in this browser (ADR-045, PRD §7). One `localStorage` key:
 * its presence means history is on; removing it turns history off and deletes everything.
 * Nothing is sent to the server. Raw headers are dropped before saving to keep entries small.
 */
export const HISTORY_KEY = 'secheaders-history'
export const HISTORY_LIMIT = 20

type StorageGetter = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const StoredHistorySchema = z.strictObject({
  v: z.literal(1),
  entries: z.array(ScanResultSchema).max(HISTORY_LIMIT),
})

/**
 * Parses the stored value. `null` means history is off. A value that does not validate
 * (edited by hand, older format) counts as on and empty, so it is replaced on the next save.
 */
export function parseHistory(raw: string | null): ScanResult[] | null {
  if (raw === null) return null
  try {
    const parsed = StoredHistorySchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data.entries : []
  } catch {
    return []
  }
}

/** The stored value, or `null` when history is off or storage is unavailable. */
export function readHistoryRaw(getStorage: StorageGetter): string | null {
  try {
    return getStorage().getItem(HISTORY_KEY)
  } catch {
    return null
  }
}

function write(getStorage: StorageGetter, entries: ScanResult[]): boolean {
  try {
    getStorage().setItem(HISTORY_KEY, JSON.stringify({ v: 1, entries }))
    return true
  } catch {
    return false
  }
}

/** Turns history on (empty). Returns false when storage is unavailable. */
export function enableHistory(getStorage: StorageGetter): boolean {
  return parseHistory(readHistoryRaw(getStorage)) !== null || write(getStorage, [])
}

/** Turns history off and deletes every saved scan. */
export function disableHistory(getStorage: StorageGetter): boolean {
  try {
    getStorage().removeItem(HISTORY_KEY)
    return true
  } catch {
    return false
  }
}

const entryKey = (r: Pick<ScanResult, 'scannedAt' | 'target'>) =>
  `${r.scannedAt}|${r.target.finalUrl}`

/**
 * Saves a result when history is on: newest first, no duplicates, at most `HISTORY_LIMIT`.
 * If storage is full, older entries are dropped until it fits. Returns false when history
 * is off or nothing could be saved.
 */
export function saveToHistory(getStorage: StorageGetter, result: ScanResult): boolean {
  const current = parseHistory(readHistoryRaw(getStorage))
  if (current === null) return false
  const compact: ScanResult = { ...result, rawHeaders: [] }
  const key = entryKey(compact)
  let entries = [compact, ...current.filter((r) => entryKey(r) !== key)].slice(0, HISTORY_LIMIT)
  while (entries.length > 0) {
    if (write(getStorage, entries)) return true
    entries = entries.slice(0, -1)
  }
  return false
}

const hostOf = (url: string): string | null => {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

/** Earlier scans of the same host as `result`, newest first, excluding `result` itself. */
export function earlierScans(history: readonly ScanResult[], result: ScanResult): ScanResult[] {
  const host = hostOf(result.target.finalUrl)
  const key = entryKey(result)
  return history.filter((r) => hostOf(r.target.finalUrl) === host && entryKey(r) !== key)
}

export interface RuleChange {
  id: RuleId
  /** `null` when the check did not appear in that scan. */
  before: Status | null
  after: Status | null
}

export interface Comparison {
  scoreDelta: number
  gradeBefore: Grade
  gradeAfter: Grade
  /** Only the checks whose status changed, in `RULE_IDS` order. */
  changes: RuleChange[]
}

/** What changed between an earlier scan and the current one. */
export function compareScans(earlier: ScanResult, current: ScanResult): Comparison {
  const statusOf = (r: ScanResult, id: RuleId) =>
    r.findings.find((f) => f.id === id)?.status ?? null
  const changes = RULE_IDS.map((id) => ({
    id,
    before: statusOf(earlier, id),
    after: statusOf(current, id),
  })).filter((c) => c.before !== c.after)
  return {
    scoreDelta: current.score - earlier.score,
    gradeBefore: earlier.grade,
    gradeAfter: current.grade,
    changes,
  }
}
