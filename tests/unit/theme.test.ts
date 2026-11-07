import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { THEME_PREFERENCES, parseThemePreference, themeClass, themeCookieString } from '@/lib/theme'

describe('theme preference (06 §1, 08 §6)', () => {
  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
    ['system', 'system'],
    [undefined, 'system'],
    ['DARK', 'system'],
    ['<script>', 'system'],
  ] as const)('parses %j as %s', (value, expected) => {
    expect(parseThemePreference(value)).toBe(expected)
  })

  it('maps preferences to the <html> class', () => {
    expect(themeClass('light')).toBe('light')
    expect(themeClass('dark')).toBe('dark')
    expect(themeClass('system')).toBeUndefined()
  })

  it('writes a SameSite=Lax cookie, Secure on HTTPS, one year', () => {
    expect(themeCookieString('dark', true)).toBe(
      'theme=dark; Max-Age=31536000; Path=/; SameSite=Lax; Secure',
    )
    expect(themeCookieString('light', false)).toBe(
      'theme=light; Max-Age=31536000; Path=/; SameSite=Lax',
    )
  })

  it('deletes the cookie for "system"', () => {
    expect(themeCookieString('system', true)).toBe(
      'theme=; Max-Age=0; Path=/; SameSite=Lax; Secure',
    )
  })

  it('lists exactly three preferences', () => {
    expect(THEME_PREFERENCES).toEqual(['light', 'dark', 'system'])
  })
})

describe('globals.css dark tokens', () => {
  const css = readFileSync('src/app/globals.css', 'utf8')
  const declarations = (body: string) =>
    body
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .sort()

  it('dark tokens never apply in print: every dark rule is screen-only', () => {
    expect(css).not.toMatch(/^\.dark\s*\{/m)
    expect(css).not.toMatch(/@media \(prefers-color-scheme: dark\)/)
  })

  it('the system-dark block equals the .dark blocks exactly (no drift)', () => {
    const dark = [...css.matchAll(/^\s+\.dark\s*\{([^}]*)\}/gm)].flatMap((m) =>
      declarations(m[1] ?? ''),
    )
    const system =
      /@media screen and \(prefers-color-scheme: dark\) \{\s*:root:not\(\.light\) \{([^}]*)\}/.exec(
        css,
      )
    // 31 preset tokens (08 §2) + 9 extended tokens (08 §4).
    expect(dark).toHaveLength(40)
    expect(declarations(system?.[1] ?? '')).toEqual(dark.sort())
  })
})
