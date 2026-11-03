import { expect, test } from '@playwright/test'

test('/ redirects to the default locale', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/en$/)
})

test('/en renders left-to-right in English', async ({ page }) => {
  const response = await page.goto('/en')
  expect(response?.ok()).toBe(true)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.locator('h1')).toHaveText('SecHeaders Lab')
})

test('/ar renders right-to-left in Arabic', async ({ page }) => {
  const response = await page.goto('/ar')
  expect(response?.ok()).toBe(true)
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('h1')).toHaveText('SecHeaders Lab')
})

test('unknown locale returns 404', async ({ page }) => {
  const response = await page.goto('/fr')
  expect(response?.status()).toBe(404)
})

test('no locale cookie is set (ADR-017)', async ({ page, context }) => {
  await page.goto('/ar')
  expect(await context.cookies()).toEqual([])
})
