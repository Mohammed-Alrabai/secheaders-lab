import Image from 'next/image'

// viewBox 329×64; rendered 28 px tall (`08` §8 minimum width 120 px is respected).
const WIDTH = 144
const HEIGHT = 28

/**
 * Horizontal logo (`08` §8): the light-theme file on light backgrounds and the dark-theme
 * file on dark ones, switched by CSS so the server-resolved theme needs no script. SVGs are
 * served as-is (`unoptimized`); they are first-party static files.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={className}>
      <Image
        src="/brand/logo-horizontal-light.svg"
        alt="SecHeaders Lab"
        width={WIDTH}
        height={HEIGHT}
        priority
        unoptimized
        className="h-7 w-auto dark:hidden"
      />
      <Image
        src="/brand/logo-horizontal-dark.svg"
        alt="SecHeaders Lab"
        width={WIDTH}
        height={HEIGHT}
        priority
        unoptimized
        className="hidden h-7 w-auto dark:block"
      />
    </span>
  )
}
