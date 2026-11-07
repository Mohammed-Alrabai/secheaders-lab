import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  type Oklch,
  type Rgb,
  WHITE,
  contrast,
  mixOklch,
  over,
  parseOklch,
  toLinearSrgb,
} from '../helpers/color'

/**
 * `08` §4 automated check: every colour pairing the UI uses meets WCAG 2.2 AA in both themes.
 * Large grade letters need 3:1; chips, labels and body text need 4.5:1.
 */

const css = readFileSync('src/app/globals.css', 'utf8')

function block(selector: RegExp): Map<string, string> {
  const map = new Map<string, string>()
  for (const match of css.matchAll(selector)) {
    const body = (match[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const decl of body.split(';')) {
      const [name, ...rest] = decl.split(':')
      if (name?.trim().startsWith('--')) map.set(name.trim(), rest.join(':').trim())
    }
  }
  return map
}

const LIGHT = block(/^:root\s*\{([^}]*)\}/gm)
const DARK_ONLY = block(/^\s+\.dark\s*\{([^}]*)\}/gm)
const DARK = new Map([...LIGHT, ...DARK_ONLY])

function token(theme: Map<string, string>, name: string): Oklch {
  let value = theme.get(name)
  for (let i = 0; value?.startsWith('var(') && i < 5; i++) {
    value = theme.get(value.slice(4, -1).trim())
  }
  if (value === undefined) throw new Error(`missing token ${name}`)
  return parseOklch(value)
}

const THEMES = [
  ['light', LIGHT],
  ['dark', DARK],
] as const

const rgb = (theme: Map<string, string>, name: string): Rgb => toLinearSrgb(token(theme, name))

/** `.chip-*`: background = token at 14 % over the surface, text = token 55 % toward foreground. */
function chip(theme: Map<string, string>, name: string, surface: string): { fg: Rgb; bg: Rgb } {
  const tint = token(theme, name)
  const bg = over({ ...tint, alpha: 0.14 }, rgb(theme, surface))
  const fg = toLinearSrgb(mixOklch(tint, 0.55, token(theme, '--foreground')))
  return { fg, bg }
}

describe('colour maths sanity', () => {
  it('converts the endpoints correctly', () => {
    expect(
      contrast(toLinearSrgb(parseOklch('oklch(1 0 0)')), toLinearSrgb(parseOklch('oklch(0 0 0)'))),
    ).toBeCloseTo(21, 0)
    expect(contrast(WHITE, WHITE)).toBeCloseTo(1, 5)
  })

  it('reads every preset and extended token in both themes', () => {
    expect(LIGHT.size).toBeGreaterThanOrEqual(43)
    expect(DARK_ONLY.size).toBe(41)
  })
})

describe.each(THEMES)('%s theme', (_name, theme) => {
  it.each([
    ['--foreground', '--background'],
    ['--card-foreground', '--card'],
    ['--muted-foreground', '--background'],
    ['--muted-foreground', '--card'],
    ['--primary-foreground', '--primary'],
    // ADR-031: links, text buttons and accent icons use --link, never --primary, as text.
    ['--link', '--background'],
    ['--link', '--card'],
    ['--secondary-foreground', '--secondary'],
    ['--accent-foreground', '--accent'],
    ['--popover-foreground', '--popover'],
  ])('text %s on %s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(rgb(theme, fg), rgb(theme, bg))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['--success', '--warning', '--destructive', '--info', '--muted-foreground'])(
    'chip %s on page and card ≥ 4.5:1',
    (name) => {
      for (const surface of ['--background', '--card']) {
        const { fg, bg } = chip(theme, name, surface)
        expect(contrast(fg, bg), `${name} on ${surface}`).toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  it.each(['--grade-a-plus', '--grade-a', '--grade-b', '--grade-c', '--grade-d', '--grade-f'])(
    'grade badge %s letter ≥ 3:1 (large text)',
    (name) => {
      const isDark = theme === DARK
      const text =
        name === '--grade-c'
          ? rgb(theme, '--warning-foreground') // ADR-016
          : isDark
            ? rgb(theme, '--background')
            : WHITE
      expect(contrast(text, rgb(theme, name))).toBeGreaterThanOrEqual(3)
    },
  )

  it('focus ring is visible against the page (non-text ≥ 3:1 not required for ring/50, informative)', () => {
    expect(contrast(rgb(theme, '--ring'), rgb(theme, '--background'))).toBeGreaterThan(1.5)
  })
})
