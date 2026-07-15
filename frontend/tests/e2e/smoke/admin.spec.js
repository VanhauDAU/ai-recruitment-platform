import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

test('admin smoke: login loads and dashboard stays role-protected', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/admin/app/login')
  await expect(page.getByRole('heading', { name: 'Đăng nhập Quản trị hệ thống' })).toBeVisible()

  await page.goto('/admin/app/dashboard')
  await expect(page).toHaveURL(/\/admin\/app\/login\?returnUrl=/)

  await page.goto('/admin/app/cv-catalogue')
  await expect(page).toHaveURL(/\/admin\/app\/login\?returnUrl=/)
})
