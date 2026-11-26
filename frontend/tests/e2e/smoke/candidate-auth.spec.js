import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

test('candidate auth mascot clings to the card and follows credential privacy states', { tag: '@responsive' }, async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/dang-nhap')

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

  await page.getByRole('button', { name: 'Hiển thị' }).click()
  await expect(mascot).toHaveAttribute('data-pose', 'peek')
  await expect(mascot.locator('.procv-mascot__face-arm')).toHaveCount(1)

  expect(await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )).toBe(false)

  await page.goto('/dang-ky')
  await expect(page.locator('.auth-mascot-stage .procv-mascot')).toHaveAttribute('data-pose', 'frameGrip')
  await page.getByRole('button', { name: /Đăng ký bằng email/ }).click()
  await page.getByRole('button', { name: /^Đăng ký/ }).click()
  await expect(page.locator('.auth-mascot-stage')).toHaveAttribute('data-state', 'invalid')
  await page.getByPlaceholder('ten@email.com').focus()
  await expect(page.locator('.auth-mascot-stage .procv-mascot')).toHaveAttribute('data-gaze', 'down')
  await page.getByPlaceholder('Nhập mật khẩu', { exact: true }).focus()
  await expect(page.locator('.auth-mascot-stage .procv-mascot')).toHaveAttribute('data-pose', 'coverEyes')
})

test('candidate social login runs in a popup on desktop and signs in the opener window', async ({ page, context, baseURL }) => {
  // Mock ở mức context để popup (trang mới) cũng dùng chung.
  await mockPublicApi(context)
  await context.route('http://localhost:8000/api/auth/oauth/google/start/**', (route) => {
    const start = new URL(route.request().url())
    expect(start.searchParams.get('mode')).toBe('popup')
    const callback = new URL('/oauth/callback', baseURL)
    callback.search = new URLSearchParams({ code: 'e2e-code', popup: '1', nonce: start.searchParams.get('nonce') }).toString()
    return route.fulfill({ status: 302, headers: { location: callback.toString() } })
  })
  let completedCode = null
  await page.route('http://localhost:8000/api/auth/oauth/complete/', (route) => {
    completedCode = route.request().postDataJSON().code
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        access: 'e2e-access',
        user: { public_id: 'c1', role: 'candidate', email: 'an@example.com', full_name: 'Nguyễn An', email_verified: true, job_preferences_configured: true },
      }),
    })
  })
  await page.goto('/dang-nhap')

  const popupOpened = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Đăng nhập bằng Google' }).click()
  const popup = await popupOpened
  await popup.waitForEvent('close')

  await expect(page).toHaveURL(new URL('/', baseURL).toString())
  expect(completedCode).toBe('e2e-code')
})
