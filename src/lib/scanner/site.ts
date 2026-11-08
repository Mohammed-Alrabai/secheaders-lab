import { getDomain } from 'tldts'

/**
 * Registrable domain per the Public Suffix List, including its private section: tenants of
 * shared hosts (`a.github.io` vs `b.github.io`) are different owners (ADR-020).
 */
export function registrableDomain(hostname: string): string | null {
  return getDomain(hostname, { allowPrivateDomains: true })
}

/** Same host, or the same (non-null) registrable domain (ADR-020). */
export function isSameSite(a: string, b: string): boolean {
  if (a === b) return true
  const site = registrableDomain(a)
  return site !== null && site === registrableDomain(b)
}
