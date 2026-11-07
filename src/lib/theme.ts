/**
 * Theme preference (`06` §1, `08` §6). Resolved on the server from a cookie so the right
 * class is on `<html>` during SSR: no inline script, no flash, strict CSP stays intact.
 * Without a cookie the CSS follows `prefers-color-scheme`.
 */

export const THEME_COOKIE = 'theme'
export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]

/** Unknown or missing values mean "follow the system". */
export function parseThemePreference(value: string | undefined): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

/** Class for `<html>`: `light` / `dark` force a theme; none lets the media query decide. */
export function themeClass(preference: ThemePreference): string | undefined {
  return preference === 'system' ? undefined : preference
}

/**
 * `Set-Cookie`-equivalent string written by the client (never by the server, so our own
 * responses carry no `Set-Cookie`, ADR-017). `system` deletes the cookie.
 */
export function themeCookieString(preference: ThemePreference, secure: boolean): string {
  const attributes = ['Path=/', 'SameSite=Lax', ...(secure ? ['Secure'] : [])]
  if (preference === 'system') return [`${THEME_COOKIE}=`, 'Max-Age=0', ...attributes].join('; ')
  return [`${THEME_COOKIE}=${preference}`, 'Max-Age=31536000', ...attributes].join('; ')
}
