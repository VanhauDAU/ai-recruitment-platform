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
