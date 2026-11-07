import type { Category, Finding, Grade, Severity, Status } from '@/lib/scanner/types'

export const STATUS_CHIP: ReadonlyMap<Status, string> = new Map<Status, string>([
  ['pass', 'chip-success'],
  ['warn', 'chip-warning'],
  ['fail', 'chip-destructive'],
  ['info', 'chip-info'],
])

export const SEVERITY_CHIP: ReadonlyMap<Severity, string> = new Map<Severity, string>([
  ['critical', 'chip-destructive'],
  ['high', 'chip-destructive'],
  ['medium', 'chip-warning'],
  ['low', 'chip-muted'],
  ['info', 'chip-info'],
])

/**
 * Large grade badge (`08` §4): solid grade colour, white text on light and background-coloured
 * text on dark; grade C uses the dark warning foreground in both themes (ADR-016).
 */
export const GRADE_BADGE: ReadonlyMap<Grade, string> = new Map<Grade, string>([
  ['A+', 'bg-grade-a-plus text-white dark:text-background'],
  ['A', 'bg-grade-a text-white dark:text-background'],
  ['B', 'bg-grade-b text-white dark:text-background'],
  ['C', 'bg-grade-c text-warning-foreground'],
  ['D', 'bg-grade-d text-white dark:text-background'],
  ['F', 'bg-grade-f text-white dark:text-background'],
])

export const CATEGORY_ORDER: readonly Category[] = ['headers', 'tls', 'cookies', 'disclosure']

const STATUS_RANK = new Map<Status, number>([
  ['fail', 0],
  ['warn', 1],
  ['info', 2],
  ['pass', 3],
])

const SEVERITY_RANK = new Map<Severity, number>([
  ['critical', 0],
  ['high', 1],
  ['medium', 2],
  ['low', 3],
  ['info', 4],
])

/** `06` §2: fail → warn → info → pass, then by severity, then by points. */
export function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      (STATUS_RANK.get(a.status) ?? 9) - (STATUS_RANK.get(b.status) ?? 9) ||
      (SEVERITY_RANK.get(a.severity) ?? 9) - (SEVERITY_RANK.get(b.severity) ?? 9) ||
      b.deduction - a.deduction,
  )
}

/** The variant part of a message key: `HDR-HSTS.short` → `short`. */
export function variantOf(messageKey: string): string {
  const dot = messageKey.indexOf('.')
  return dot === -1 ? messageKey : messageKey.slice(dot + 1)
}
