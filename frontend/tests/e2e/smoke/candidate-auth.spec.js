import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

test('candidate auth mascot clings to the card and follows credential privacy states', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/login')

  const mascotStage = page.locator('.auth-mascot-stage')
  const mascot = mascotStage.locator('.procv-mascot')
  await expect(mascotStage).toBeVisible()
  await expect(mascot).toHaveAttribute('data-pose', 'frameGrip')
  await expect(mascotStage.locator('img[src*="robot-hands-frame-grip.webp"]')).toHaveCount(1)

  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(mascotStage).toHaveAttribute('data-state', 'invalid')
  await expect(mascotStage).toContainText('Thông tin chưa hợp lệ')

  await page.getByPlaceholder('ten@congty.com').focus()
  await expect(mascot).toHaveAttribute('data-gaze', 'down')

  const password = page.getByPlaceholder('Nhập mật khẩu của bạn')
  await password.focus()
  await expect(mascot).toHaveAttribute('data-pose', 'coverEyes')
  await expect(mascot.locator('.procv-mascot__face-arm')).toHaveCount(2)
  await expect(mascotStage.locator('.auth-mascot-stage__grip')).toHaveCount(0)

  await page.getByRole('button', { name: 'Show' }).click()
  await expect(mascot).toHaveAttribute('data-pose', 'peek')
  await expect(mascot.locator('.procv-mascot__face-arm')).toHaveCount(1)

  expect(await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )).toBe(false)

  await page.goto('/sign-up')
  await expect(page.locator('.auth-mascot-stage .procv-mascot')).toHaveAttribute('data-pose', 'frameGrip')
  await page.getByRole('button', { name: /Đăng ký bằng email/ }).click()
  await page.getByRole('button', { name: /^Đăng ký/ }).click()
  await expect(page.locator('.auth-mascot-stage')).toHaveAttribute('data-state', 'invalid')
  await page.getByPlaceholder('ten@email.com').focus()
  await expect(page.locator('.auth-mascot-stage .procv-mascot')).toHaveAttribute('data-gaze', 'down')
  await page.getByPlaceholder('Nhập mật khẩu', { exact: true }).focus()
  await expect(page.locator('.auth-mascot-stage .procv-mascot')).toHaveAttribute('data-pose', 'coverEyes')
})
