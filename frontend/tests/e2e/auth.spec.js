import { expect, test } from '@playwright/test'

async function mockPublicSettings(page) {
  await page.route('**/api/site/settings/', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '{}' })
  })
}

test.describe('authentication forms', () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicSettings(page)
  })

  test('shows the login form and password recovery link', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: 'Chào mừng quay trở lại' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByText('Quên mật khẩu?')).toBeVisible()
  })

  test('updates password requirements while registering', async ({ page }) => {
    await page.goto('/sign-up')
    await page.getByRole('button', { name: 'Đăng ký bằng email' }).click()

    const password = page.getByPlaceholder('Nhập mật khẩu')
    const requirements = page.getByLabel('Điều kiện mật khẩu')
    await password.fill('abc123')
    await expect(requirements.getByText('Mật khẩu từ 6 đến 25 ký tự').locator('..')).toHaveClass(/text-green/)
    await expect(requirements.getByText('Bao gồm chữ hoa, chữ thường và ký tự số').locator('..')).not.toHaveClass(/text-green/)

    await password.fill('Abc123')
    await expect(requirements.getByText('Bao gồm chữ hoa, chữ thường và ký tự số').locator('..')).toHaveClass(/text-green/)
  })

  test('does not overflow horizontally on the mobile auth flow', async ({ page }) => {
    await page.goto('/sign-up')
    await page.getByRole('button', { name: 'Đăng ký bằng email' }).click()

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
