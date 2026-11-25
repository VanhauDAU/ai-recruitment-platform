import { expect, test } from '@playwright/test'

const API_ROUTE = /^https?:\/\/[^/]+\/api\/.*$/
const OAUTH_CANDIDATE = {
  public_id: 'candidate_1',
  role: 'candidate',
  email: 'candidate@example.com',
  full_name: 'Nguyễn An',
  email_verified: true,
  has_usable_password: false,
  job_preferences_configured: true,
}

// Catch-all like candidate.spec: protected account pages need the session mocks to win.
async function mockSecurityApi(page) {
  let codeRequests = 0
  const bodies = {
    '/api/auth/refresh/': { access: 'e2e-access' },
    '/api/auth/me/': OAUTH_CANDIDATE,
    '/api/auth/sessions/': [
      { id: 's1', portal: 'main', device_label: 'Chrome trên macOS', ip_address: '10.0.0.1', last_seen_at: new Date().toISOString(), current: true },
      { id: 's2', portal: 'main', device_label: 'Safari trên iPhone', ip_address: '10.0.0.2', last_seen_at: new Date(Date.now() - 3_600_000).toISOString(), current: false },
    ],
    '/api/shared/privacy/requests/': [],
    '/api/auth/password/': { has_usable_password: false, requires_email_code: true, email_code_ttl_seconds: 600, resend_after_seconds: 0 },
  }
  await page.route(API_ROUTE, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/auth/password/setup-code/' && request.method() === 'POST') {
      codeRequests += 1
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ detail: 'ok', resend_after_seconds: 60 }) })
    }
    const body = bodies[path]
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body ?? {}) })
  })
  return { codeRequests: () => codeRequests }
}

test('candidate security: status overview leads a social account to create a password with an emailed code', { tag: '@responsive' }, async ({ page }) => {
  const api = await mockSecurityApi(page)
  await page.goto('/tai-khoan/cai-dat-bao-mat')

  await expect(page.getByRole('heading', { name: 'Cài đặt bảo mật', level: 1 })).toBeVisible()
  await expect(page.getByText('Email đã xác thực')).toBeVisible()
  await expect(page.getByText('Chưa có, đang đăng nhập bằng mạng xã hội')).toBeVisible()
  await expect(page.getByText('Safari trên iPhone')).toBeVisible()

  await page.getByRole('link', { name: 'Tạo mật khẩu' }).click()
  await expect(page).toHaveURL(/\/tai-khoan\/doi-mat-khau$/)
  await expect(page.getByText(/Xác thực với|Xác thực lại/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Gửi mã' }).click()
  await expect(page.getByRole('button', { name: /Gửi lại sau \d+s/ })).toBeDisabled()
  expect(api.codeRequests()).toBe(1)
  await expect(page.getByLabel('Mã xác minh qua email')).toBeVisible()

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasHorizontalOverflow).toBe(false)
})
