import { expect, test } from '@playwright/test'

const candidate = {
  id: 1,
  role: 'candidate',
  email: 'candidate@example.com',
  full_name: 'Ứng viên thử nghiệm',
  phone: '',
  email_verified: true,
  two_factor_enabled: false,
}

async function authenticateCandidate(page) {
  await page.addInitScript(() => {
    localStorage.setItem('main_access_token', 'access-token')
    localStorage.setItem('main_refresh_token', 'refresh-token')
  })
  await page.route('**/api/site/settings/', (route) => route.fulfill({ contentType: 'application/json', body: '{}' }))
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

    await page.goto('/tai-khoan/xac-minh-hai-buoc?source=header')

    await expect(page).toHaveURL(/\/login\?returnUrl=%2Ftai-khoan%2Fxac-minh-hai-buoc%3Fsource%3Dheader/)
    await expect(page.getByRole('heading', { name: 'Chào mừng quay trở lại' })).toBeVisible()
  })

  test('loads the profile page from the account feature and saves profile data', async ({ page }) => {
    await authenticateCandidate(page)
    await page.goto('/tai-khoan/thong-tin-ca-nhan')

    await expect(page.getByRole('heading', { name: 'Cài đặt thông tin cá nhân' })).toBeVisible()
    await page.getByLabel('Số điện thoại').fill('0912345678')
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await expect(page.getByText('Đã lưu thông tin cá nhân.')).toBeVisible()
  })

  test('enables two-factor authentication through its feature route', async ({ page }) => {
    await authenticateCandidate(page)
    await page.route('**/api/auth/two-factor/setup/send/', (route) => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({ email: candidate.email, expires_in: 180 }),
    }))
    await page.route('**/api/auth/two-factor/setup/confirm/', (route) => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({ ...candidate, two_factor_enabled: true }),
    }))

    await page.goto('/tai-khoan/xac-minh-hai-buoc')
    await page.getByRole('button', { name: 'Xác minh 2 bước' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByLabel('Mã xác minh 6 chữ số').fill('123456')
    await page.getByRole('button', { name: 'Xác nhận' }).click()
    await expect(page.getByRole('heading', { name: 'Xác minh hai bước đã bật' })).toBeVisible()
  })
})
