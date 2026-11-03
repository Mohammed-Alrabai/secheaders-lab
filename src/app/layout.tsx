import { JetBrains_Mono, Oxanium } from "next/font/google"

import "./globals.css"
import { cn } from "@/lib/utils"

const jetbrainsMonoHeading = JetBrains_Mono({ subsets: ["latin"], variable: "--font-heading" })

const oxanium = Oxanium({ subsets: ["latin"], variable: "--font-sans" })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={cn("antialiased", "font-sans", oxanium.variable, jetbrainsMonoHeading.variable)}
    >
      <body>{children}</body>
    </html>
  )
}
