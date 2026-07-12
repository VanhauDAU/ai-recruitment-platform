import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

test('candidate smoke: saved jobs remains protected', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/viec-lam-da-luu')

  await expect(page).toHaveURL(/\/login$/)
})
