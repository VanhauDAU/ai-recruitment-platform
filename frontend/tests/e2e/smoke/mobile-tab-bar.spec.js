import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

const API_ROUTE = /^https?:\/\/[^/]+\/api\/.*$/
const CANDIDATE = {
  public_id: 'candidate_1',
  role: 'candidate',
  email: 'candidate@example.com',
  full_name: 'Nguyễn An',
  email_verified: true,
  has_usable_password: true,
  job_preferences_configured: true,
}
const NOTIFICATION = {
  public_id: 'cno_1',
  event_type: 'application_interviewed',
  title: 'Bạn được mời phỏng vấn',
  message: 'Acme mời bạn phỏng vấn vị trí Backend.',
  action_path: '/tai-khoan/viec-lam-da-ung-tuyen',
  is_read: false,
  delivered_at: '2026-11-15T09:00:00+07:00',
}

// Public endpoints come from the shared mock; only the candidate session is layered on top.
async function mockCandidateApi(page) {
  await mockPublicApi(page)
  const bodies = {
    '/api/auth/refresh/': { access: 'e2e-access' },
    '/api/auth/me/': CANDIDATE,
    '/api/candidate/notifications/unread-count/': { count: 3 },
    '/api/candidate/notifications/': { results: [NOTIFICATION] },
    '/api/candidate/jobs/saved/': [],
  }
  await page.route(API_ROUTE, async (route) => {
    const body = bodies[new URL(route.request().url()).pathname]
    if (body === undefined) return route.fallback()
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
}

test('mobile tab bar replaces the header account cluster on narrow screens', { tag: '@responsive' }, async ({ page }, testInfo) => {
  await mockCandidateApi(page)
  await page.goto('/')

  const tabBar = page.getByRole('navigation', { name: 'Điều hướng nhanh' })
  if (page.viewportSize().width >= 768) {
    await expect(tabBar).toBeHidden()
    await expect(page.getByRole('button', { name: 'Mở menu tài khoản' })).toBeVisible()
    return
  }

  await expect(tabBar).toBeVisible()
  await expect(tabBar.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('aria-current', 'page')
  await expect(tabBar.getByRole('link', { name: 'Tạo CV' })).toHaveAttribute('href', '/mau-cv')
  await expect(page.getByRole('button', { name: 'Mở menu tài khoản' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Mở danh mục' })).toBeVisible()

  await page.getByRole('button', { name: 'Mở thông báo' }).click()
  const notifications = page.getByRole('dialog', { name: /Thông báo/ })
  await expect(notifications.getByText('Bạn được mời phỏng vấn')).toBeVisible()
  await expect(notifications.getByText('3 mới')).toBeVisible()
  await testInfo.attach('notifications-sheet', { body: await page.screenshot(), contentType: 'image/png' })
  await notifications.getByRole('button', { name: 'Đóng' }).click()
  await expect(notifications).toBeHidden()

  await tabBar.getByRole('button', { name: 'Tài khoản' }).click()
  const account = page.getByRole('dialog', { name: 'Tài khoản' })
  await expect(account.getByText('Nguyễn An')).toBeVisible()
  await expect(account.getByRole('button', { name: 'Đăng xuất' })).toBeVisible()
  await testInfo.attach('account-sheet', { body: await page.screenshot(), contentType: 'image/png' })
  await account.getByRole('button', { name: 'Việc làm đã lưu' }).click()
  await expect(page).toHaveURL(/\/viec-lam-da-luu$/)
  await expect(account).toBeHidden()

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasHorizontalOverflow).toBe(false)
})

test('guests can cancel signing in from the tab bar and the login page', { tag: '@responsive' }, async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/blog')
  if (page.viewportSize().width < 768) {
    await page.getByRole('navigation', { name: 'Điều hướng nhanh' }).getByRole('button', { name: 'Tài khoản' }).click()
    await page.getByRole('dialog', { name: 'Tài khoản' }).getByRole('button', { name: 'Đăng nhập' }).click()
    const loginDialog = page.getByRole('dialog').filter({ hasText: 'Chào mừng quay trở lại' })
    await expect(loginDialog).toBeVisible()
    await loginDialog.getByRole('button', { name: /close|đóng/i }).first().click()
    await expect(loginDialog).toBeHidden()
    await expect(page).toHaveURL(/\/blog$/)
  }

  // Opened directly (no in-app history): closing falls back to the home page.
  await page.goto('/dang-nhap')
  await page.getByRole('button', { name: 'Đóng, quay lại trang trước' }).click()
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/)
})

test('floating actions collapse into one speed-dial button on narrow screens', { tag: '@responsive' }, async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/blog')
  const savedJobs = page.getByRole('button', { name: 'Việc làm đã lưu' })
  if (page.viewportSize().width >= 768) {
    await expect(savedJobs).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mở tiện ích nhanh' })).toBeHidden()
    return
  }

  const toggle = page.getByRole('button', { name: 'Mở tiện ích nhanh' })
  await expect(savedJobs).toBeHidden()
  await toggle.click()
  await expect(page.getByRole('button', { name: 'Thu gọn tiện ích' })).toHaveAttribute('aria-expanded', 'true')
  await expect(savedJobs).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hỗ trợ' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(savedJobs).toBeHidden()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
})
