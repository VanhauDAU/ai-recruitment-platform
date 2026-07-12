import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

test('public smoke: home and jobs routes load', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/')
  await expect(page.locator('body')).not.toBeEmpty()

  await page.goto('/viec-lam')
  await expect(page.getByRole('heading', { name: /Tuyển dụng/ })).toBeVisible()
})
