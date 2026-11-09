import { type Page, type Route, expect, test } from '@playwright/test'

import { sampleResult } from './fixtures'

/** The API is always mocked in e2e (`05` §3): no real targets are ever contacted. */
async function mockScan(page: Page, handler: (route: Route) => Promise<void>) {
  await page.route('**/api/scan', handler)
}

const okResponse = (route: Route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(sampleResult()),
  })

test.describe('home page', () => {
  test('shows an inline error for a reserved name and stays on the page', async ({ page }) => {
    await page.goto('/en')
    const input = page.getByLabel('Website address')
    await input.fill('printer.local')
    await page.getByRole('button', { name: 'Scan' }).click()
    const error = page.getByText('Local and internal names cannot be scanned.')
    await expect(error).toBeVisible()
    await expect(error).toHaveAttribute('role', 'alert')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input).toBeFocused()
    await expect(page).toHaveURL(/\/en$/)
  })

  test('submits a valid address to the shareable results URL', async ({ page }) => {
    await mockScan(page, okResponse)
    await page.goto('/en')
    await page.getByLabel('Website address').fill('example.com')
    await page.getByRole('button', { name: 'Scan' }).click()
    await expect(page).toHaveURL(/\/en\/scan\?url=example\.com$/)
  })

  test('Arabic home page is right-to-left with Arabic copy', async ({ page }) => {
    await page.goto('/ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'قيّم رؤوس الأمان في موقعك خلال ثوانٍ',
    )
  })
})

test.describe('results page (mocked API)', () => {
  test('renders the grade, findings and redirect chain, and focuses the report heading', async ({
    page,
  }) => {
    await mockScan(page, okResponse)
    await page.goto('/en/scan?url=example.com')
    const heading = page.getByRole('heading', { name: 'Report for example.com' })
    await expect(heading).toBeVisible()
    await expect(heading).toBeFocused()
    await expect(page.getByRole('img', { name: /^Grade / })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Content-Security-Policy (CSP)' })).toBeVisible()
    // SC-30: redirect hops are plain text, never links.
    await expect(page.getByRole('link', { name: 'http://example.com/' })).toHaveCount(0)
  })

  test('SSRF case 22: upstream markup is inert text and bidi overrides are stripped', async ({
    page,
  }) => {
    await mockScan(page, okResponse)
    await page.goto('/en/scan?url=example.com')
    await page.getByRole('button', { name: /Raw response headers/ }).click()
    const cell = page.getByRole('cell', { name: /window.__pwned/ })
    await expect(cell).toHaveText('<script>window.__pwned = true</script>gnp.exe')
    expect(await page.evaluate(() => (window as { __pwned?: boolean }).__pwned)).toBeUndefined()
    // ADR-015: cookie values are never shown.
    await expect(page.getByText('TOP-SECRET')).toHaveCount(0)
  })

  for (const [locale, next, previous] of [
    ['en', 'ArrowRight', 'ArrowLeft'],
    ['ar', 'ArrowLeft', 'ArrowRight'],
  ] as const) {
    test(`fix tabs follow WAI-ARIA keyboard rules in ${locale} (${next} = next tab)`, async ({
      page,
    }) => {
      await mockScan(page, okResponse)
      await page.goto(`/${locale}/scan?url=example.com`)
      const card = page
        .locator('[data-slot="card"]')
        .filter({ hasText: 'Content-Security-Policy (CSP)' })
        .first()
      await card.locator('[data-slot="collapsible-trigger"]').first().click()
      const tabs = card.getByRole('tab')
      await expect(tabs.first()).toHaveText('Nginx')
      await tabs.first().focus()
      await page.keyboard.press(next)
      await expect(tabs.nth(1)).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
      await expect(card.getByRole('tabpanel')).toContainText(
        'Header always set Content-Security-Policy',
      )
      await page.keyboard.press(previous)
      await expect(tabs.first()).toBeFocused()
    })
  }

  test('downloads the report as JSON, built in the browser (ADR-040)', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    let scans = 0
    await mockScan(page, (route) => {
      scans += 1
      return okResponse(route)
    })
    await page.goto('/ar/scan?url=example.com')
    const button = page.getByRole('button', { name: 'تنزيل JSON' })
    await expect(button).toBeVisible()
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()])
    expect(download.suggestedFilename()).toBe('secheaders-example.com-2026-11-07.json')
    let text = ''
    const stream = await download.createReadStream()
    stream.setEncoding('utf8')
    for await (const chunk of stream) text += String(chunk)
    expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(sampleResult())))
    expect(text).not.toContain('TOP-SECRET')
    expect(scans).toBe(1) // the export makes no request of its own
    expect(errors).toEqual([])
  })

  test('improve panel: fix plan, what-if and combined header block (ADR-043, ADR-044)', async ({
    page,
  }) => {
    await mockScan(page, okResponse)
    await page.goto('/en/scan?url=example.com')
    const panel = page.getByRole('region', { name: 'Improve your grade' })
    await expect(panel).toBeVisible()

    const steps = page.getByTestId('fix-plan').getByRole('listitem')
    await expect(steps).toHaveCount(3)
    await expect(steps.first()).toContainText(/^1Fix /)
    await expect(steps.first()).toContainText(/Projected after this step: \d+ out of 100, grade /)

    const result = page.getByTestId('what-if-result')
    await page.getByRole('button', { name: 'Try your own combination' }).click()
    const before = await result.textContent()
    const boxes = panel.getByRole('checkbox')
    await boxes.first().check()
    await expect(result).not.toHaveText(before ?? '')
    await page.getByRole('button', { name: 'Clear selection' }).click()
    await expect(result).toHaveText(before ?? '')
    await expect(boxes.first()).not.toBeChecked()

    const combined = page.getByRole('region', { name: 'All header fixes in one block' })
    await expect(combined.locator('pre')).toContainText('add_header Content-Security-Policy')
    await combined.getByRole('tab', { name: 'Cloudflare' }).click()
    await expect(combined).toContainText('On Cloudflare, headers are set in the dashboard.')
  })

  test('improve panel in Arabic is right-to-left and keeps code left-to-right', async ({
    page,
  }) => {
    await mockScan(page, okResponse)
    await page.goto('/ar/scan?url=example.com')
    await expect(page.getByRole('heading', { name: 'حسّن تقديرك' })).toBeVisible()
    const block = page
      .getByRole('region', { name: 'كل إصلاحات الرؤوس في كتلة واحدة' })
      .locator('pre')
    await expect(block).toHaveAttribute('dir', 'ltr')
  })

  test('language switch keeps the page and its query (FR-10)', async ({ page }) => {
    await mockScan(page, okResponse)
    await page.goto('/en/scan?url=example.com')
    await expect(page.getByRole('heading', { name: 'Report for example.com' })).toBeVisible()
    await page.getByRole('link', { name: 'Switch to Arabic' }).click()
    await expect(page).toHaveURL(/\/ar\/scan\?url=example\.com$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  })
})

test.describe('error states (FR-13)', () => {
  test('422 BLOCKED_TARGET shows a friendly message and a new form', async ({ page }) => {
    await mockScan(page, (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: '{"error":{"code":"BLOCKED_TARGET"}}',
      }),
    )
    await page.goto('/en/scan?url=example.com')
    await expect(page.getByRole('heading', { name: 'This site can’t be scanned' })).toBeVisible()
    await expect(page.getByLabel('Website address')).toHaveValue('example.com')
  })

  test('platform 429 without a JSON body or Retry-After still maps to RATE_LIMITED (T-16)', async ({
    page,
  }) => {
    await mockScan(page, (route) =>
      route.fulfill({ status: 429, contentType: 'text/plain', body: 'slow down' }),
    )
    await page.goto('/en/scan?url=example.com')
    await expect(page.getByRole('heading', { name: 'Too many scans' })).toBeVisible()
    await expect(page.getByText(/You can try again in/)).toHaveCount(0)
  })

  test('our 429 shows the Retry-After wait', async ({ page }) => {
    await mockScan(page, (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: { 'retry-after': '6' },
        body: '{"error":{"code":"RATE_LIMITED"}}',
      }),
    )
    await page.goto('/en/scan?url=example.com')
    await expect(page.getByText('You can try again in 6 seconds.')).toBeVisible()
  })

  test('network failure shows the connection message and retry works', async ({ page }) => {
    let calls = 0
    await mockScan(page, async (route) => {
      calls += 1
      if (calls === 1) await route.abort('failed')
      else await okResponse(route)
    })
    await page.goto('/en/scan?url=example.com')
    await expect(page.getByRole('heading', { name: 'Connection problem' })).toBeVisible()
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('heading', { name: 'Report for example.com' })).toBeVisible()
  })

  test('missing ?url shows a prompt instead of scanning', async ({ page }) => {
    let called = false
    await mockScan(page, async (route) => {
      called = true
      await okResponse(route)
    })
    await page.goto('/en/scan')
    await expect(page.getByRole('heading', { name: 'No address to scan' })).toBeVisible()
    expect(called).toBe(false)
  })
})

test.describe('theme and methodology', () => {
  test('theme menu switches to dark and remembers it via a client-set cookie', async ({
    page,
    context,
  }) => {
    await page.goto('/en')
    await page.getByRole('button', { name: 'Theme' }).click()
    await page.getByRole('menuitemradio', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    const cookie = (await context.cookies()).find((c) => c.name === 'theme')
    expect(cookie?.value).toBe('dark')
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  })

  test('methodology lists every check with its maximum points', async ({ page }) => {
    await page.goto('/en/about')
    await expect(page.getByRole('heading', { level: 1, name: 'Methodology' })).toBeVisible()
    await expect(
      page.getByRole('row', { name: /Strict-Transport-Security \(HSTS\).*20/ }),
    ).toBeVisible()
    await expect(page.getByText('Informational only — not a compliance assessment.')).toBeVisible()
  })
})
