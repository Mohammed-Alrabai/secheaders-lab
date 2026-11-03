import { describe, expect, it } from 'vitest'

import ar from '../../messages/ar.json'
import en from '../../messages/en.json'

type Messages = Record<string, unknown>

/** Flattens nested message objects into `a.b.c` → string entries. */
function flatten(messages: Messages, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      out.set(path, value)
    } else if (typeof value === 'object' && value !== null) {
      for (const [k, v] of flatten(value as Messages, path)) out.set(k, v)
    } else {
      throw new Error(`Unsupported message value at ${path}`)
    }
  }
  return out
}

/** Top-level ICU argument names, e.g. `{days}` or `{count, plural, …}` → `days`, `count`. */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{\s*([A-Za-z_][\w]*)\s*[,}]/g)].map((m) => m[1] ?? '').sort()
}

const enFlat = flatten(en)
const arFlat = flatten(ar)

describe('message catalogues (06 §3)', () => {
  it('en.json and ar.json have identical key sets', () => {
    expect([...arFlat.keys()].sort()).toEqual([...enFlat.keys()].sort())
  })

  it.each([...enFlat.keys()])('%s has the same ICU placeholders in both locales', (key) => {
    expect(placeholders(arFlat.get(key) ?? '')).toEqual(placeholders(enFlat.get(key) ?? ''))
  })

  it('no message is empty', () => {
    for (const [key, value] of [...enFlat, ...arFlat]) {
      expect(value.trim(), key).not.toBe('')
    }
  })

  it('placeholder parser finds simple and plural arguments', () => {
    expect(
      placeholders('Max-age is {days} days, {count, plural, one {# cookie} other {# cookies}}'),
    ).toEqual(['count', 'days'])
  })
})
