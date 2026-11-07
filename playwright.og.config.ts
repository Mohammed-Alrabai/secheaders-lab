import { defineConfig, devices } from '@playwright/test'

const PORT = 3101
const baseURL = `http://localhost:${String(PORT)}`

/**
 * Generates the static Open Graph images (`pnpm og:generate`, ADR-032). Kept separate from
 * the e2e suite: it writes files into `public/og/` and is run on purpose, not in CI.
 */
export default defineConfig({
  testDir: 'tests/og',
  reporter: 'list',
  use: { baseURL },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
      },
    },
  ],
  webServer: {
    command: `pnpm start --port ${String(PORT)}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SITE_URL: baseURL },
  },
})
