import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { COOKIE_NOTICE_KEY, COOKIE_NOTICE_VALUE } from '../../src/lib/cookie-notice'

const PAGES = [
  { path: 'privacy', en: 'Privacy Policy', ar: 'سياسة الخصوصية' },
  { path: 'terms', en: 'Terms of Use', ar: 'شروط الاستخدام' },
  { path: 'cookies', en: 'Cookie Policy', ar: 'سياسة ملفات تعريف الارتباط' },
] as const

test.describe('legal pages (ADR-037)', () => {
  for (const page of PAGES) {
    for (const locale of ['en', 'ar'] as const) {
      test(`${locale}/${page.path} renders with its title, date and language`, async ({
        page: p,
      }) => {
        const response = await p.goto(`/${locale}/${page.path}`)
        expect(response?.status()).toBe(200)
        await expect(p.getByRole('heading', { level: 1 })).toHaveText(
          locale === 'ar' ? page.ar : page.en,
        )
        await expect(p.locator('html')).toHaveAttribute('lang', locale)
        await expect(p.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
        await expect(p.locator('article time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/)
        const canonical = await p.locator('link[rel="canonical"]').getAttribute('href')
        expect(canonical?.endsWith(`/${locale}/${page.path}`)).toBe(true)
      })
    }
  }

  test('the footer links to every legal page', async ({ page }) => {
    await page.goto('/en')
    const footer = page.getByRole('contentinfo')
    for (const { path, en } of PAGES) {
      await footer.getByRole('link', { name: en }).click()
      await expect(page).toHaveURL((url) => url.pathname === `/en/${path}`)
    }
  })

  test('the cookie table lists exactly what the code stores', async ({ page }) => {
    await page.goto('/en/cookies')
    const table = page.getByRole('table')
    await expect(table.getByRole('row')).toHaveCount(3)
    await expect(table).toContainText('theme')
    await expect(table).toContainText(COOKIE_NOTICE_KEY)
  })

  test('the sitemap lists the legal pages in both languages', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text()
    for (const { path } of PAGES) {
      expect(xml).toContain(`/en/${path}</loc>`)
      expect(xml).toContain(`/ar/${path}</loc>`)
    }
  })
})

test.describe('first-visit cookie notice (ADR-037)', () => {
  // Start every test as a first-time visitor.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('shows once, closes, moves focus to the page and stays closed', async ({
    page,
    context,
  }) => {
    await page.goto('/en')
    const notice = page.getByTestId('cookie-notice')
    await expect(notice).toBeVisible()
    await expect(notice.getByRole('heading', { name: 'Your privacy comes first' })).toBeVisible()
    // Showing the notice sets nothing: still no cookies at all.
    expect(await context.cookies()).toEqual([])

    await notice.getByRole('button', { name: 'Got it' }).click()
    await expect(notice).toBeHidden()
    await expect(page.locator('#main')).toBeFocused()
    expect(await page.evaluate((key) => localStorage.getItem(key), COOKIE_NOTICE_KEY)).toBe(
      COOKIE_NOTICE_VALUE,
    )
    expect(await context.cookies()).toEqual([])

    await page.reload()
    await page.goto('/ar/about')
    await expect(page.getByTestId('cookie-notice')).toHaveCount(0)
  })

  test('is shown in Arabic, right to left, and links to the cookie policy', async ({ page }) => {
    await page.goto('/ar')
    const notice = page.getByTestId('cookie-notice')
    await expect(notice.getByRole('heading', { name: 'خصوصيتك أولًا' })).toBeVisible()
    await notice.getByRole('link', { name: 'اقرأ سياسة ملفات تعريف الارتباط' }).click()
    await expect(page).toHaveURL(/\/ar\/cookies$/)
    // Following the policy link does not count as closing the notice.
    await expect(page.getByTestId('cookie-notice')).toBeVisible()
  })

  test('can be closed with the keyboard', async ({ page }) => {
    await page.goto('/en/about')
    const button = page.getByTestId('cookie-notice').getByRole('button', { name: 'Got it' })
    await button.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('cookie-notice')).toHaveCount(0)
  })

  test('still closes for the visit when storage is blocked', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError')
        },
      })
    })
    await page.goto('/en')
    const notice = page.getByTestId('cookie-notice')
    await expect(notice).toBeVisible()
    await notice.getByRole('button', { name: 'Got it' }).click()
    await expect(notice).toHaveCount(0)
  })

  for (const locale of ['en', 'ar'] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`axe: notice visible, ${locale} ${scheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme })
        await page.goto(`/${locale}`)
        await expect(page.getByTestId('cookie-notice')).toBeVisible()
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
        const blocking = results.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
        expect(blocking).toEqual([])
      })
    }
  }
})
