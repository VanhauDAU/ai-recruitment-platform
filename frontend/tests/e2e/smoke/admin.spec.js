import { expect, test } from '@playwright/test'
import { ADMIN_ROUTES } from '../../../src/app/router/admin/admin-routes.config.js'
import { mockPublicApi } from './helpers'

test('admin smoke: login loads and dashboard stays role-protected', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/admin/app/login')
  await expect(page.getByRole('heading', { name: 'Đăng nhập quản trị' })).toBeVisible()
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )

  for (const route of ADMIN_ROUTES) {
    await page.goto(`/admin/app${route.segment}`)
    await expect(page).toHaveURL(/\/admin\/app\/login\?returnUrl=/)
  }
})
