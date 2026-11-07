import { notFound } from 'next/navigation'

/**
 * Unknown paths under a locale render the localized 404 inside the `[locale]` layout
 * (with `lang` / `dir`), instead of Next.js's unlocalized global page.
 */
export default function CatchAll(): never {
  notFound()
}
