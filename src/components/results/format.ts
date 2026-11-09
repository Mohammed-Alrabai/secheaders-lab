/** Gregorian calendar and Western digits in both locales (`06` §3). */
export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(`${locale}-u-ca-gregory-nu-latn`, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

/** A signed difference: `+15`, `-3`, `0`. */
export function signed(delta: number): string {
  return delta > 0 ? `+${String(delta)}` : String(delta)
}
