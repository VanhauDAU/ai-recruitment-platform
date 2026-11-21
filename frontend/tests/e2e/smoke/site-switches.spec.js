import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

// Công tắc vận hành trong Cấu hình hệ thống (ADR-0026) phải thấy được ở cổng ứng viên.
async function withSettings(page, settings) {
  await mockPublicApi(page)
  await page.route('http://localhost:8000/api/public/site/settings/', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(settings),
  }))
}

test('closed candidate registration shows a notice instead of the form', async ({ page }) => {
  await withSettings(page, { candidate_allow_registration: false })
  await page.goto('/register')

  await expect(page.getByRole('heading', { name: 'Tạm dừng đăng ký tài khoản mới' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/login')
  await expect(page.getByRole('button', { name: 'Đăng ký bằng email' })).toHaveCount(0)
})

test('maintenance mode replaces the candidate portal with the maintenance screen', { tag: '@responsive' }, async ({ page }) => {
  await withSettings(page, { maintenance_mode: true, maintenance_message: 'Nâng cấp hệ thống tới 22h.' })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Hệ thống đang bảo trì' })).toBeVisible()
  await expect(page.getByText('Nâng cấp hệ thống tới 22h.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
})
