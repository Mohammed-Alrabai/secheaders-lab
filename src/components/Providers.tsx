'use client'

import { DirectionProvider } from '@base-ui/react/direction-provider'

interface ProvidersProps {
  dir: 'ltr' | 'rtl'
  children: React.ReactNode
}

/** Base UI needs the text direction for RTL-aware keyboard navigation (tabs, menus). */
export function Providers({ dir, children }: ProvidersProps) {
  return <DirectionProvider direction={dir}>{children}</DirectionProvider>
}
