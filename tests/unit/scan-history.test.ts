import { describe, expect, it } from 'vitest'

import {
  HISTORY_KEY,
  HISTORY_LIMIT,
  compareScans,
  disableHistory,
  earlierScans,
  enableHistory,
  parseHistory,
  readHistoryRaw,
  saveToHistory,
} from '@/lib/scan-history'
import type { ScanResult } from '@/lib/scanner/types'

import { sampleResult } from '../e2e/fixtures'

/** In-memory Storage with an optional byte quota, like a full browser store. */
function memoryStorage(quota = Infinity) {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (v.length > quota) throw new DOMException('full', 'QuotaExceededError')
      map.set(k, v)
    },
    removeItem: (k: string) => {
      map.delete(k)
    },
  }
}
const throwing = () => {
  throw new DOMException('blocked', 'SecurityError')
}

const at = (iso: string, overrides: Partial<ScanResult> = {}): ScanResult => ({
  ...sampleResult(),
  scannedAt: iso,
  ...overrides,
})

describe('scan history storage (ADR-045)', () => {
  it('is off until enabled, and off again after disabling', () => {
    const s = memoryStorage()
    expect(parseHistory(readHistoryRaw(() => s))).toBeNull()
    expect(saveToHistory(() => s, at('2026-11-01T00:00:00.000Z'))).toBe(false)
    expect(s.map.size).toBe(0)

    expect(enableHistory(() => s)).toBe(true)
    expect(parseHistory(readHistoryRaw(() => s))).toEqual([])
    expect(enableHistory(() => s)).toBe(true) // idempotent, keeps entries

    expect(disableHistory(() => s)).toBe(true)
    expect(s.map.has(HISTORY_KEY)).toBe(false)
  })

  it('saves newest first, without raw headers or duplicates, up to the limit', () => {
    const s = memoryStorage()
    enableHistory(() => s)
    for (let day = 1; day <= HISTORY_LIMIT + 3; day += 1) {
      saveToHistory(() => s, at(`2026-10-${String(day).padStart(2, '0')}T00:00:00.000Z`))
    }
    saveToHistory(() => s, at('2026-10-23T00:00:00.000Z'))
    const history = parseHistory(readHistoryRaw(() => s)) ?? []
    expect(history).toHaveLength(HISTORY_LIMIT)
    expect(history[0]?.scannedAt).toBe('2026-10-23T00:00:00.000Z')
    expect(history.every((r) => r.rawHeaders.length === 0)).toBe(true)
    expect(JSON.stringify(history)).not.toContain('TOP-SECRET')
  })

  it('drops older entries when storage is full', () => {
    const one = JSON.stringify({ v: 1, entries: [{ ...sampleResult(), rawHeaders: [] }] }).length
    const s = memoryStorage(one * 2 + 50)
    enableHistory(() => s)
    for (const day of ['01', '02', '03', '04']) {
      expect(saveToHistory(() => s, at(`2026-10-${day}T00:00:00.000Z`))).toBe(true)
    }
    const history = parseHistory(readHistoryRaw(() => s)) ?? []
    expect(history.map((r) => r.scannedAt.slice(8, 10))).toEqual(['04', '03'])
  })

  it('returns false when not even one entry fits', () => {
    const s = memoryStorage(40)
    expect(enableHistory(() => s)).toBe(true)
    expect(saveToHistory(() => s, at('2026-10-01T00:00:00.000Z'))).toBe(false)
    expect(parseHistory(readHistoryRaw(() => s))).toEqual([])
  })

  it('treats an invalid stored value as on and empty', () => {
    expect(parseHistory('not json')).toEqual([])
    expect(parseHistory(JSON.stringify({ v: 2, entries: [] }))).toEqual([])
    expect(parseHistory(JSON.stringify({ v: 1, entries: [{ score: 5 }] }))).toEqual([])
  })

  it('never throws when storage is blocked', () => {
    expect(readHistoryRaw(throwing)).toBeNull()
    expect(enableHistory(throwing)).toBe(false)
    expect(disableHistory(throwing)).toBe(false)
    expect(saveToHistory(throwing, sampleResult())).toBe(false)
  })
})

describe('earlierScans and compareScans (ADR-045)', () => {
  const current = at('2026-11-08T00:00:00.000Z')

  it('keeps earlier scans of the same host only', () => {
    const other = at('2026-11-02T00:00:00.000Z', {
      target: { ...current.target, finalUrl: 'https://other.example.net/' },
    })
    const older = at('2026-11-01T00:00:00.000Z')
    expect(earlierScans([current, other, older], current)).toEqual([older])
  })

  it('ignores entries whose address cannot be parsed', () => {
    const broken = at('2026-11-03T00:00:00.000Z', {
      target: { ...current.target, finalUrl: 'not a url' },
    })
    expect(earlierScans([broken], current)).toEqual([])
  })

  it('reports the score delta, grades and only the checks that changed', () => {
    const earlier = at('2026-11-01T00:00:00.000Z', {
      score: current.score - 15,
      grade: 'C',
      findings: current.findings
        .filter((f) => f.id !== 'INF-SERVER')
        .map((f) => (f.id === 'HDR-XCTO' ? { ...f, status: 'fail' as const } : f)),
    })
    const diff = compareScans(earlier, current)
    expect(diff.scoreDelta).toBe(15)
    expect(diff.gradeBefore).toBe('C')
    expect(diff.gradeAfter).toBe(current.grade)
    const xcto = current.findings.find((f) => f.id === 'HDR-XCTO')?.status
    const server = current.findings.find((f) => f.id === 'INF-SERVER')?.status
    expect(diff.changes).toEqual([
      { id: 'HDR-XCTO', before: 'fail', after: xcto },
      { id: 'INF-SERVER', before: null, after: server },
    ])
  })

  it('finds no changes between identical scans', () => {
    expect(compareScans(current, current)).toMatchObject({ scoreDelta: 0, changes: [] })
  })
})
