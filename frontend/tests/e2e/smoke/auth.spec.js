import { expect, test } from '@playwright/test'
import { expectAnimatedLoginButton, mockPublicApi } from './helpers'

test('auth smoke: login form is available and protected candidate route redirects', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/login')
  await expect(page.getByLabel('Email')).toBeVisible()
  await expectAnimatedLoginButton(page)

  await page.goto('/tai-khoan/thong-tin-ca-nhan')
  await expect(page).toHaveURL(/\/login\?returnUrl=/)
})
