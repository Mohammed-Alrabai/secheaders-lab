/**
 * Legal pages (privacy, terms, cookies; ADR-037). The copy lives in `messages/*.json` as a
 * list of sections so both languages share one structure; this module validates it.
 */

export const LEGAL_PAGES = ['privacy', 'terms', 'cookies'] as const
export type LegalPage = (typeof LEGAL_PAGES)[number]

/** Date the legal copy last changed (ISO 8601). Update it with every content change. */
export const LEGAL_UPDATED = '2026-11-07'

/** Public repository: contact channel (issues) and security policy (SC-35). */
export const REPO_URL = 'https://github.com/Mohammed-Alrabai/secheaders-lab'
export const REPO_ISSUES_URL = `${REPO_URL}/issues`
export const REPO_SECURITY_URL = `${REPO_URL}/security/policy`

export interface LegalSection {
  title: string
  paragraphs: string[]
  items: string[]
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string' && v.trim() !== '')
}

/**
 * Validates the raw `sections` array from a message catalog. Throws on any malformed entry,
 * so a broken translation fails the build and the tests instead of rendering half a page.
 */
export function parseLegalSections(raw: unknown): LegalSection[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Legal sections must be a list')
  return raw.map((entry: unknown, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Legal section ${String(index)} is not an object`)
    }
    const title: unknown = Reflect.get(entry, 'title')
    const paragraphs: unknown = Reflect.get(entry, 'paragraphs') ?? []
    const items: unknown = Reflect.get(entry, 'items') ?? []
    if (typeof title !== 'string' || title.trim() === '') {
      throw new Error(`Legal section ${String(index)} needs a title`)
    }
    if (!isStringArray(paragraphs) || !isStringArray(items)) {
      throw new Error(`Legal section ${String(index)} has invalid text`)
    }
    if (paragraphs.length === 0 && items.length === 0) {
      throw new Error(`Legal section ${String(index)} is empty`)
    }
    return { title, paragraphs, items }
  })
}
