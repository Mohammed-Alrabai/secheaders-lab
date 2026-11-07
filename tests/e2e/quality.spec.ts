import AxeBuilder from '@axe-core/playwright'
import { type Page, expect, test } from '@playwright/test'

import { HeaderMap } from '../../src/lib/scanner/header-utils'
import { runChecks } from '../../src/lib/scanner/checks/index'
import { computeScore } from '../../src/lib/scanner/scoring'
import { makeInput } from '../helpers/check-input'
import { sampleResult } from './fixtures'

async function mockScan(page: Page) {
  await page.route('**/api/scan', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sampleResult()),
    }),
  )
}

/** Records CSP violations from page load onwards (`03` §6, task 5.2). */
async function trackCspViolations(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const store: string[] = []
    Object.defineProperty(window, '__cspViolations', { value: store })
    document.addEventListener('securitypolicyviolation', (e) => {
      store.push(`${e.violatedDirective} ${e.blockedURI}`)
    })
  })
  return () =>
    page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations)
}

const PAGES = [
  '/',
  '/about',
  '/privacy',
  '/terms',
  '/cookies',
  '/scan?url=example.com',
  '/scan',
  '/does-not-exist',
] as const

for (const locale of ['en', 'ar'] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    for (const path of PAGES) {
      test(`axe: ${locale} ${scheme} ${path} has no serious or critical violations`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: scheme })
        await mockScan(page)
        await page.goto(`/${locale}${path === '/' ? '' : path}`)
        if (path === '/scan?url=example.com') {
          await expect(page.locator('#summary-title')).toBeVisible()
          // Expand the first finding so the fix tabs and code blocks are audited too.
          await page.locator('[data-slot="collapsible-trigger"]').first().click()
        }
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
        const blocking = results.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map(
            (v) =>
              `${v.id}: ${v.nodes
                .map((n) => n.target.join(' '))
                .slice(0, 3)
                .join(' | ')}`,
          )
        expect(blocking).toEqual([])
      })
    }
  }
}

test('no CSP violations while using every page (nonce CSP, 03 §6)', async ({ page }) => {
  const violations = await trackCspViolations(page)
  // DevTools issues also catch blocked eval probes inside try/catch (ADR-033), which do
  // not always surface as `securitypolicyviolation` events.
  const cdp = await page.context().newCDPSession(page)
  const issues: string[] = []
  cdp.on('Audits.issueAdded', ({ issue }) => {
    if (issue.code === 'ContentSecurityPolicyIssue')
      issues.push(JSON.stringify(issue.details.contentSecurityPolicyIssueDetails))
  })
  await cdp.send('Audits.enable')
  await mockScan(page)
  await page.goto('/en')
  await page.getByRole('button', { name: 'Theme' }).click()
  await page.getByRole('menuitemradio', { name: 'Dark' }).click()
  await page.goto('/en/scan?url=example.com')
  await expect(page.locator('#summary-title')).toBeVisible()
  for (const trigger of await page.locator('[data-slot="collapsible-trigger"]').all())
    await trigger.click()
  await page.getByRole('tab', { name: 'IIS' }).first().click()
  await page.goto('/ar/about')
  expect(await violations()).toEqual([])
  expect(issues).toEqual([])
  const csp = (await page.request.get('/ar/about')).headers()['content-security-policy']
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]{24}' 'strict-dynamic';/)
})

test('keyboard only: skip link, form, results and fix tabs', async ({ page }) => {
  await mockScan(page)
  await page.goto('/en')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main')).toBeFocused()
  const input = page.getByLabel('Website address')
  await input.focus()
  await page.keyboard.type('example.com')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/en\/scan\?url=example\.com$/)
  await expect(page.locator('#summary-title')).toBeFocused()
  // The first finding's details open with the keyboard and its tabs take focus.
  const trigger = page.locator('[data-slot="collapsible-trigger"]').first()
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  const firstTab = page.getByRole('tab').first()
  await firstTab.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab').nth(1)).toBeFocused()
})

test('task 5.4: the headers this server actually sends score 100 / A+', async ({ request }) => {
  const response = await request.get('/en')
  expect(response.status()).toBe(200)
  const entries = response
    .headersArray()
    .map(({ name, value }): [string, string] => [name.toLowerCase(), value])
  // Served locally over HTTP, so TLS and the HTTPS context are simulated; headers are real.
  const findings = runChecks({ ...makeInput(), headers: new HeaderMap(entries) })
  expect(
    findings.filter((f) => f.status === 'fail' || f.status === 'warn').map((f) => f.messageKey),
  ).toEqual([])
  expect(computeScore(findings)).toEqual({ score: 100, grade: 'A+', capsApplied: [] })
  expect(entries.some(([name]) => name === 'set-cookie')).toBe(false)
  expect(entries.some(([name]) => name === 'x-powered-by')).toBe(false)
})
