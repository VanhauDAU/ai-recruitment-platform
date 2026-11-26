import { expect, test } from '@playwright/test'
import { expectAnimatedLoginButton, mockPublicApi } from './helpers'

test('auth smoke: login form is available and protected candidate route redirects', { tag: '@responsive' }, async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/dang-nhap')
  await expect(page.getByLabel('Email')).toBeVisible()
  await expectAnimatedLoginButton(page)

  await page.goto('/tai-khoan/thong-tin-ca-nhan')
  await expect(page).toHaveURL(/\/dang-nhap\?returnUrl=/)
})
