import { expect, test } from '@playwright/test'

const candidate = {
  id: 1,
  role: 'candidate',
  email: 'candidate@example.com',
  full_name: 'Ứng viên thử nghiệm',
  phone: '',
  email_verified: true,
}

async function authenticateCandidate(page) {
  await page.route('**/api/site/settings/', (route) => route.fulfill({ contentType: 'application/json', body: '{}' }))
  await page.route('**/api/privacy/consent/', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ consent: { necessary: true, preferences: false, analytics: false, marketing: false } }),
  }))
  await page.route('**/api/auth/refresh/', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ access: 'e2e-access' }),
  }))
  await page.route('**/api/auth/me/', async (route) => {
    if (route.request().method() === 'PATCH') {
      const values = route.request().postDataJSON()
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...candidate, ...values }) })
      return
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(candidate) })
  })
}

test.describe('candidate account features', () => {
  test('preserves the protected URL as returnUrl before redirecting to login', async ({ page }) => {
    await page.route('**/api/site/settings/', (route) => route.fulfill({ contentType: 'application/json', body: '{}' }))

    await page.goto('/tai-khoan/thong-tin-ca-nhan?source=header')

    await expect(page).toHaveURL(/\/login\?returnUrl=%2Ftai-khoan%2Fthong-tin-ca-nhan%3Fsource%3Dheader/)
    await expect(page.getByRole('heading', { name: 'Chào mừng quay trở lại' })).toBeVisible()
  })

  test('loads the profile page and saves profile data', async ({ page }) => {
    await authenticateCandidate(page)
    await page.goto('/tai-khoan/thong-tin-ca-nhan')

    await expect(page.getByRole('heading', { name: 'Cài đặt thông tin cá nhân' })).toBeVisible()
    await page.getByLabel('Số điện thoại').fill('0912345678')
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await expect(page.getByText('Đã lưu thông tin cá nhân.')).toBeVisible()
  })
})
