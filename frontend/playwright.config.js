import { defineConfig, devices } from '@playwright/test'

const playwrightPort = process.env.PLAYWRIGHT_PORT || '5173'
const playwrightBaseUrl = `http://127.0.0.1:${playwrightPort}`

// `dev` (default) keeps the local workflow unchanged. CI sets
// PLAYWRIGHT_WEB_SERVER=preview to smoke-test the production bundle: the
// unbundled dev server needs over a second per navigation on hosted runners,
// which pushed multi-route tests past the 30s budget.
const webServerMode = process.env.PLAYWRIGHT_WEB_SERVER === 'preview' ? 'preview' : 'dev'
const webServerCommand = webServerMode === 'preview'
  ? `npm run build && npm run preview -- --host 127.0.0.1 --port ${playwrightPort} --strictPort`
  : `npm run dev -- --host 127.0.0.1 --port ${playwrightPort}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  // Assertion budgets were tuned on developer machines. Hosted runners share
  // four vCPUs between two browser workers and the web server, so lazy tab
  // and locale chunks occasionally needed more than the default 5s. This
  // widens the wait for a correct result; it does not retry failed tests.
  expect: { timeout: process.env.CI ? 10_000 : 5_000 },
  // Three CI runs on 2026-11-13 each lost one to three clicks on Ant Design
  // tabs/menus/selects, on a different test and viewport every time, after the
  // deterministic failures were fixed. One retry keeps those from blocking
  // merges; a test that needs it is reported as "flaky" and surfaced as a
  // warning by the workflow, never counted as a clean pass. Local runs keep
  // zero retries so a flaky test still fails in front of its author.
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: playwrightBaseUrl,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'tablet-chromium', use: { viewport: { width: 834, height: 1112 }, hasTouch: true } },
    // Use a Chromium-native mobile profile. iPhone 13 is a WebKit device;
    // forcing it onto Chromium produces a mismatched layout/visual viewport.
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: webServerCommand,
    url: playwrightBaseUrl,
    reuseExistingServer: !process.env.CI,
    // Preview mode builds first; the default 60s is too tight for a cold runner.
    timeout: 180_000,
  },
})
