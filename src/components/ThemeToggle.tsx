'use client'

import { Monitor, Moon, Sun, SunMoon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  THEME_PREFERENCES,
  type ThemePreference,
  parseThemePreference,
  themeClass,
  themeCookieString,
} from '@/lib/theme'

const ICONS = new Map<ThemePreference, typeof Sun>([
  ['light', Sun],
  ['dark', Moon],
  ['system', Monitor],
])

/** Light / dark / system menu. Writes the cookie and swaps the `<html>` class in place. */
export function ThemeToggle({ initial }: { initial: ThemePreference }) {
  const t = useTranslations('common.theme')
  const [preference, setPreference] = useState<ThemePreference>(initial)

  function apply(next: ThemePreference) {
    setPreference(next)
    document.cookie = themeCookieString(next, window.location.protocol === 'https:')
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    const cls = themeClass(next)
    if (cls) root.classList.add(cls)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={t('label')} />}>
        <SunMoon strokeWidth={1.75} className="size-5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value: unknown) => {
            apply(parseThemePreference(typeof value === 'string' ? value : undefined))
          }}
        >
          {THEME_PREFERENCES.map((option) => {
            const Icon = ICONS.get(option) ?? Monitor
            return (
              <DropdownMenuRadioItem key={option} value={option}>
                <Icon strokeWidth={1.75} className="size-4" aria-hidden />
                {t(option)}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
