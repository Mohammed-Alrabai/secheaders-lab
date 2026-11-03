import './globals.css'
import { fontVariables } from './fonts'
import { cn } from '@/lib/utils'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={cn('antialiased', fontVariables('en'))}>
      <body>{children}</body>
    </html>
  )
}
