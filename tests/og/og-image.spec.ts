import { mkdir } from 'node:fs/promises'

import { test } from '@playwright/test'

/**
 * `08` §9 Open Graph images, 1200×630: background #0c0a09, horizontal dark logo, the
 * locale's tagline (Arabic in Changa via the app's own self-hosted fonts). Rendered by the
 * browser so Arabic shaping is correct (ADR-032).
 */
const COPY = [
  [
    'en',
    {
      tagline: 'Passive website security review', // 08 §9
      line: 'HTTP headers · TLS · Cookies · Disclosure · A+ to F',
    },
  ],
  [
    'ar',
    {
      tagline: 'فحص أمني سلبي للمواقع', // 08 §9
      line: 'رؤوس HTTP · شهادات TLS · ملفات تعريف الارتباط · تسريب المعلومات · تقدير من A+ إلى F',
    },
  ],
] as const

for (const [locale, copy] of COPY) {
  test(`og image ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 630 })
    await page.goto(`/${locale}`)
    await page.waitForLoadState('networkidle')
    await page.evaluate(({ tagline, line }) => {
      // A fixed overlay outside React's root: hydration never touches it.
      const body = document.createElement('div')
      document.documentElement.append(body)
      body.setAttribute(
        'style',
        'position:fixed;inset:0;z-index:2147483647;margin:0;width:1200px;height:630px;background:#0c0a09;color:#fbfaf9;display:flex;flex-direction:column;justify-content:center;gap:40px;padding:0 96px;box-sizing:border-box',
      )
      const logo = document.createElement('img')
      logo.src = '/brand/logo-horizontal-dark.svg'
      logo.alt = 'SecHeaders Lab'
      logo.setAttribute('style', 'height:96px;width:auto;align-self:flex-start')
      const title = document.createElement('p')
      title.textContent = tagline
      title.setAttribute(
        'style',
        'margin:0;font-family:var(--font-heading);font-weight:700;font-size:64px;line-height:1.25',
      )
      const sub = document.createElement('p')
      sub.textContent = line
      sub.setAttribute(
        'style',
        'margin:0;font-family:var(--font-sans);font-size:28px;color:#74d4ff',
      )
      const bar = document.createElement('div')
      bar.setAttribute(
        'style',
        'position:absolute;inset-inline:0;bottom:0;height:12px;background:#00a6f4',
      )
      body.append(logo, title, sub, bar)
    }, copy)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => [...document.images].every((img) => img.complete))
    await mkdir('public/og', { recursive: true })
    await page.screenshot({
      path: `public/og/${locale}.png`,
      clip: { x: 0, y: 0, width: 1200, height: 630 },
    })
  })
}
