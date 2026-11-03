import { Changa, IBM_Plex_Sans_Arabic, JetBrains_Mono, Oxanium } from "next/font/google"

// Fonts are downloaded at build time and self-hosted, so no runtime third-party
// requests are made (required by our CSP, `08` §3).

const oxanium = Oxanium({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-oxanium",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-jetbrains-mono",
})

// Arabic fonts are not preloaded so English pages do not pay for them.
const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
  variable: "--font-ibm-plex-sans-arabic",
})

const changa = Changa({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  preload: false,
  variable: "--font-changa",
})

/**
 * Returns the font-variable class names for a locale. `globals.css` maps them to
 * `--font-sans` / `--font-heading` / `--font-mono` per `:lang()`.
 */
export function fontVariables(locale: "en" | "ar"): string {
  const latin = [oxanium.variable, jetbrainsMono.variable]
  return (locale === "ar" ? [...latin, ibmPlexSansArabic.variable, changa.variable] : latin).join(
    " "
  )
}
