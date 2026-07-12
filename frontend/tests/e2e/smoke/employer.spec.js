import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

test('employer smoke: login loads and dashboard stays role-protected', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/tuyendung/app/login')
  await expect(page.getByRole('heading', { name: 'Đăng nhập dành cho Nhà tuyển dụng' })).toBeVisible()

  await page.goto('/tuyendung/app/dashboard')
  await expect(page).toHaveURL(/\/tuyendung\/app\/login\?returnUrl=/)
})
