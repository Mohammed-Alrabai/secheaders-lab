import { describe, expect, it } from 'vitest'

import { REPLACEMENT, decodeLatin1Utf8, displayText, sanitizeParams } from '@/lib/sanitize'

const RLO = String.fromCodePoint(0x202e)
const asLatin1Bytes = (s: string) => Buffer.from(s, 'utf8').toString('latin1')

describe('decodeLatin1Utf8 (T-11)', () => {
  it('re-decodes UTF-8 bytes delivered as latin1', () => {
    expect(decodeLatin1Utf8(asLatin1Bytes('café ✓'))).toBe('café ✓')
  })

  it('keeps plain ASCII and invalid UTF-8 unchanged', () => {
    expect(decodeLatin1Utf8('nginx/1.24.0')).toBe('nginx/1.24.0')
    expect(decodeLatin1Utf8('été')).toBe('été') // lone latin1 bytes, not UTF-8
  })

  it('leaves strings that already contain real Unicode alone', () => {
    expect(decodeLatin1Utf8('例え.jp')).toBe('例え.jp')
  })
})

describe('displayText (SC-29…SC-31)', () => {
  it('SC-31 strips bidi overrides even when they arrive as latin1 bytes (SSRF case 22)', () => {
    const header = `<script>alert(1)</script>${asLatin1Bytes(RLO)}gnp.exe`
    const shown = displayText(header)
    expect(shown).toBe('<script>alert(1)</script>gnp.exe')
    expect(shown).not.toContain(RLO)
  })

  it.each([
    0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0x200e, 0x200f, 0x061c,
  ])('SC-31 removes U+%s', (code) => {
    expect(displayText(`a${String.fromCodePoint(code)}b`)).toBe('ab')
  })

  it('marks C0/C1 control characters visibly but keeps tabs', () => {
    expect(displayText('a\u0000b\u001bc\u007fd\u0085e\tf')).toBe(
      `a${REPLACEMENT}b${REPLACEMENT}c${REPLACEMENT}d${REPLACEMENT}e\tf`,
    )
  })

  it('SC-29 leaves markup as literal text (rendering is React text only)', () => {
    expect(displayText('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert(1)>')
  })
})

describe('sanitizeParams', () => {
  it('cleans string params and keeps numbers', () => {
    expect(sanitizeParams({ cookies: `sid${RLO}, a`, count: 2 })).toEqual({
      cookies: 'sid, a',
      count: 2,
    })
  })

  it('handles undefined and does not allow prototype pollution', () => {
    expect(sanitizeParams(undefined)).toEqual({})
    const polluted = JSON.parse('{"__proto__": "x", "a": "b"}') as Record<string, string>
    const out = sanitizeParams(polluted)
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype)
    expect(out.a).toBe('b')
  })
})
