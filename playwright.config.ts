import { defineConfig, devices } from '@playwright/test'

const PORT = 3100
const baseURL = `http://localhost:${String(PORT)}`

/**
 * E2E runs against the production server (`next start`), so `pnpm build` must run first.
 * The scan API is mocked via route interception in the specs; no real targets are contacted.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // One `next start` serves every worker; a few workers keep it responsive on laptops and CI.
  workers: 3,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Optional locally: reuse an installed Chromium-based browser ('msedge' | 'chrome')
        // instead of downloading Playwright's build. CI always uses the bundled Chromium.
        ...(process.env.PLAYWRIGHT_CHANNEL && !process.env.CI
          ? { channel: process.env.PLAYWRIGHT_CHANNEL }
          : {}),
      },
    },
  ],
  webServer: {
    command: `pnpm start --port ${String(PORT)}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // Production mode requires the site origin (env.ts); it is also the allowed Origin (SC-25).
    env: { NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SITE_URL: baseURL },
  },
})
