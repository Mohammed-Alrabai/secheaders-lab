/**
 * Minimal colour maths for the contrast test (`08` §4): OKLCH → OKLab → linear sRGB
 * (Björn Ottosson's matrices), OKLCH `color-mix`, alpha compositing and WCAG contrast.
 * Out-of-gamut channels are clipped, which approximates browser gamut mapping.
 */

export interface Oklch {
  l: number
  c: number
  h: number
  alpha: number
}

export interface Rgb {
  r: number
  g: number
  b: number
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Parses `oklch(L C H)` or `oklch(L C H / A)` where A may be a percentage. */
export function parseOklch(value: string): Oklch {
  const inner = value.trim()
  if (!inner.startsWith('oklch(') || !inner.endsWith(')')) throw new Error(`not oklch(): ${value}`)
  const [channels = '', alphaPart] = inner.slice(6, -1).split('/')
  const [l, c, h] = channels.trim().split(/\s+/).map(Number)
  if (l === undefined || c === undefined || h === undefined)
    throw new Error(`bad oklch(): ${value}`)
  const a = alphaPart?.trim()
  const alpha = a === undefined ? 1 : a.endsWith('%') ? Number(a.slice(0, -1)) / 100 : Number(a)
  return { l, c, h, alpha }
}

/** Linear-light sRGB, each channel clipped to [0, 1]. */
export function toLinearSrgb({ l, c, h }: Oklch): Rgb {
  const rad = (h * Math.PI) / 180
  const a = c * Math.cos(rad)
  const b = c * Math.sin(rad)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return {
    r: clamp01(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    g: clamp01(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    b: clamp01(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  }
}

const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)
const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)

/** Composites a translucent colour over an opaque one in gamma-encoded sRGB (as browsers do). */
export function over(top: Oklch, bottom: Rgb): Rgb {
  const t = toLinearSrgb(top)
  const mix = (fg: number, bg: number) =>
    toLinear(top.alpha * toGamma(fg) + (1 - top.alpha) * toGamma(bg))
  return { r: mix(t.r, bottom.r), g: mix(t.g, bottom.g), b: mix(t.b, bottom.b) }
}

/** CSS `color-mix(in oklch, a p, b)` with the shorter hue arc. */
export function mixOklch(a: Oklch, p: number, b: Oklch): Oklch {
  let dh = b.h - a.h
  if (dh > 180) dh -= 360
  if (dh < -180) dh += 360
  const q = 1 - p
  return {
    l: a.l * p + b.l * q,
    c: a.c * p + b.c * q,
    h: (((a.h + dh * q) % 360) + 360) % 360,
    alpha: a.alpha * p + b.alpha * q,
  }
}

const luminance = ({ r, g, b }: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** WCAG 2.x contrast ratio between two opaque linear-sRGB colours. */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

export const WHITE: Rgb = { r: 1, g: 1, b: 1 }
