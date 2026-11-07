import { describe, expect, it } from 'vitest'

import { logInternalError, logScan } from '@/lib/logger'

const at = new Date('2026-11-07T12:00:00Z')

function capture() {
  const lines: string[] = []
  return { lines, write: (line: string) => lines.push(line) }
}

describe('logger (SC-37)', () => {
  it('logs only timestamp, outcome, duration, hostname and rule count', () => {
    const { lines, write } = capture()
    logScan(
      { outcome: 'ok', durationMs: 1234.6, hostname: 'example.com', ruleCount: 20 },
      write,
      at,
    )
    expect(JSON.parse(lines[0] ?? '')).toEqual({
      ts: '2026-11-07T12:00:00.000Z',
      event: 'scan',
      outcome: 'ok',
      durationMs: 1235,
      hostname: 'example.com',
      ruleCount: 20,
    })
  })

  it('omits hostname and rule count when unknown', () => {
    const { lines, write } = capture()
    logScan({ outcome: 'INVALID_URL', durationMs: 1 }, write, at)
    expect(Object.keys(JSON.parse(lines[0] ?? '{}') as object).sort()).toEqual([
      'durationMs',
      'event',
      'outcome',
      'ts',
    ])
  })

  it('logs the error class but never its message', () => {
    const { lines, write } = capture()
    logInternalError(new TypeError('failed for https://secret.example.com/?token=abc'), write, at)
    logInternalError('a string', write, at)
    expect(lines.join('\n')).not.toContain('secret.example.com')
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({ event: 'internal_error', kind: 'TypeError' })
    expect(JSON.parse(lines[1] ?? '')).toMatchObject({ kind: 'string' })
  })

  it('writes to stdout by default', () => {
    const original = process.stdout.write.bind(process.stdout)
    const lines: string[] = []
    process.stdout.write = (chunk: string) => {
      lines.push(chunk)
      return true
    }
    try {
      logScan({ outcome: 'ok', durationMs: 1 })
      logInternalError(new Error('x'))
    } finally {
      process.stdout.write = original
    }
    expect(lines).toHaveLength(2)
    expect(lines[0]?.endsWith('\n')).toBe(true)
  })
})
