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
    env: { NEXT_TELEMETRY_DISABLED: '1' },
  },
})
