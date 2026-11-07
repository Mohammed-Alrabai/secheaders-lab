/**
 * First-visit cookie notice (ADR-037). Dismissal is remembered in `localStorage`, not in a
 * cookie, so the site keeps a single optional cookie (theme, NFR-04) and the server never
 * sees the value. Storage can be missing or throw (private modes, blocked site data), so
 * every access is guarded and the caller falls back to remembering it for the session.
 */

export const COOKIE_NOTICE_KEY = 'secheaders-cookie-notice'
export const COOKIE_NOTICE_VALUE = 'dismissed'

type StorageGetter = () => Pick<Storage, 'getItem' | 'setItem'>

/** True when the notice was dismissed earlier; false if unknown or storage is unavailable. */
export function readNoticeDismissed(getStorage: StorageGetter): boolean {
  try {
    return getStorage().getItem(COOKIE_NOTICE_KEY) === COOKIE_NOTICE_VALUE
  } catch {
    return false
  }
}

/** Remembers the dismissal. Returns false when it could not be stored. */
export function writeNoticeDismissed(getStorage: StorageGetter): boolean {
  try {
    getStorage().setItem(COOKIE_NOTICE_KEY, COOKIE_NOTICE_VALUE)
    return true
  } catch {
    return false
  }
}
