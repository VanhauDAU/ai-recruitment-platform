import { expect, test } from '@playwright/test'

test('footer tải dữ liệu động và không tràn màn hình', async ({ page }) => {
  await page.goto('/')

  const footer = page.locator('footer')
  await expect(footer).toBeVisible()
  await expect(footer.getByRole('heading', { name: 'Liên hệ' })).toBeVisible()
  await expect(footer.getByRole('heading', { name: 'Về ProCV' })).toBeVisible()
  await expect(footer.getByRole('heading', { name: 'Hồ sơ & Sự nghiệp' })).toBeVisible()
  await expect(footer.getByRole('heading', { name: 'Dành cho nhà tuyển dụng' })).toBeVisible()

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasHorizontalOverflow).toBe(false)
})
