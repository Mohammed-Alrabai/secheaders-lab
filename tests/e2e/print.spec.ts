import { expect, test } from '@playwright/test'

import { sampleResult } from './fixtures'

for (const locale of ['en', 'ar'] as const) {
  test(`print view (${locale}): header shown, controls hidden, failing findings expanded`, async ({
    page,
  }, info) => {
    await page.route('**/api/scan', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sampleResult()),
      }),
    )
    await page.goto(`/${locale}/scan?url=example.com`)
    await expect(page.locator('#summary-title')).toBeVisible()

    // Pick a platform on screen; the print must carry that choice (06 §2).
    const csp = page
      .locator('[data-slot="card"]')
      .filter({ hasText: 'Content-Security-Policy (CSP)' })
      .first()
    await csp.locator('[data-slot="collapsible-trigger"]').first().click()
    await csp.getByRole('tab').nth(1).click()
    await csp.locator('[data-slot="collapsible-trigger"]').first().click() // collapse again on screen

    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('header').first()).toBeHidden()
    await expect(page.getByText('SecHeaders Lab ·', { exact: false }).first()).toBeVisible()
    await expect(page.locator('[data-slot="tabs-list"]').first()).toBeHidden()
    // Failing findings are expanded even though they are collapsed on screen.
    await expect(csp.locator('[data-slot="collapsible-content"]')).toBeVisible()
    await expect(csp.getByRole('tabpanel')).toContainText(
      'Header always set Content-Security-Policy',
    )

    if (info.project.name === 'chromium') {
      const pdf = await page.pdf({ format: 'A4', printBackground: true })
      await info.attach(`report-${locale}.pdf`, { body: pdf, contentType: 'application/pdf' })
      const { writeFile, mkdir } = await import('node:fs/promises')
      await mkdir('test-results', { recursive: true })
      await writeFile(`test-results/report-${locale}.pdf`, pdf)
      await page.setViewportSize({ width: 794, height: 1123 }) // A4 at 96 dpi
      await page.screenshot({ path: `test-results/print-${locale}.png`, fullPage: true })
      expect(pdf.byteLength).toBeGreaterThan(10_000)
    }
  })
}
