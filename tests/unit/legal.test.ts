import { describe, expect, it } from 'vitest'

import ar from '../../messages/ar.json'
import en from '../../messages/en.json'
import {
  COOKIE_NOTICE_KEY,
  COOKIE_NOTICE_VALUE,
  readNoticeDismissed,
  writeNoticeDismissed,
} from '@/lib/cookie-notice'
import { LEGAL_PAGES, LEGAL_UPDATED, type LegalPage, parseLegalSections } from '@/lib/legal'

type Catalog = typeof en

function rawSections(catalog: Catalog, page: LegalPage): unknown {
  switch (page) {
    case 'privacy':
      return catalog.legal.privacy.sections
    case 'terms':
      return catalog.legal.terms.sections
    case 'cookies':
      return catalog.legal.cookies.sections
  }
}

describe('parseLegalSections (ADR-037)', () => {
  it('accepts sections with paragraphs, items or both', () => {
    expect(
      parseLegalSections([
        { title: 'A', paragraphs: ['p'] },
        { title: 'B', items: ['i'] },
        { title: 'C', paragraphs: ['p'], items: ['i'] },
      ]),
    ).toEqual([
      { title: 'A', paragraphs: ['p'], items: [] },
      { title: 'B', paragraphs: [], items: ['i'] },
      { title: 'C', paragraphs: ['p'], items: ['i'] },
    ])
  })

  it.each([
    ['not a list', 'x'],
    ['an empty list', []],
    ['a non-object entry', ['x']],
    ['a null entry', [null]],
    ['a missing title', [{ paragraphs: ['p'] }]],
    ['a blank title', [{ title: ' ', paragraphs: ['p'] }]],
    ['a section with no text', [{ title: 'A' }]],
    ['a blank paragraph', [{ title: 'A', paragraphs: [''] }]],
    ['a non-string item', [{ title: 'A', items: [1] }]],
    ['paragraphs that are not a list', [{ title: 'A', paragraphs: 'p' }]],
  ])('rejects %s', (_label, raw) => {
    expect(() => parseLegalSections(raw)).toThrow()
  })
})

describe('legal copy in both languages', () => {
  it.each(LEGAL_PAGES)('%s parses and has the same structure in English and Arabic', (page) => {
    const enSections = parseLegalSections(rawSections(en, page))
    const arSections = parseLegalSections(rawSections(ar, page))
    expect(arSections.map((s) => [s.paragraphs.length, s.items.length])).toEqual(
      enSections.map((s) => [s.paragraphs.length, s.items.length]),
    )
  })

  it('has a valid ISO "last updated" date', () => {
    expect(LEGAL_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Number.isNaN(Date.parse(LEGAL_UPDATED))).toBe(false)
  })
})

describe('cookie notice storage', () => {
  function memoryStorage() {
    const map = new Map<string, string>()
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value)
      },
      map,
    }
  }

  it('is not dismissed until written, then remembers the dismissal', () => {
    const storage = memoryStorage()
    expect(readNoticeDismissed(() => storage)).toBe(false)
    expect(writeNoticeDismissed(() => storage)).toBe(true)
    expect(storage.map.get(COOKIE_NOTICE_KEY)).toBe(COOKIE_NOTICE_VALUE)
    expect(readNoticeDismissed(() => storage)).toBe(true)
  })

  it('ignores unexpected stored values', () => {
    const storage = memoryStorage()
    storage.setItem(COOKIE_NOTICE_KEY, 'yes')
    expect(readNoticeDismissed(() => storage)).toBe(false)
  })

  it('fails closed (shows the notice) when storage is unavailable', () => {
    const blocked = () => {
      throw new Error('SecurityError')
    }
    expect(readNoticeDismissed(blocked)).toBe(false)
    expect(writeNoticeDismissed(blocked)).toBe(false)
    const throwing = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(readNoticeDismissed(() => throwing)).toBe(false)
    expect(writeNoticeDismissed(() => throwing)).toBe(false)
  })
})
