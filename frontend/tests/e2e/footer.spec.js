import { expect, test } from '@playwright/test'

test('footer tải dữ liệu động và không tràn màn hình', async ({ page }) => {
  await page.route('http://localhost:8000/api/site/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path !== '/api/site/settings/' && path !== '/api/site/link-groups/') {
      await route.continue()
      return
    }
    const body = path === '/api/site/link-groups/'
      ? [
        { key: 'about', title: 'Về ProCV', items: [{ label: 'Giới thiệu', url: '/gioi-thieu' }] },
        { key: 'candidate', title: 'Hồ sơ & Sự nghiệp', items: [{ label: 'Tạo CV', url: '/tao-cv' }] },
        { key: 'employer', title: 'Dành cho nhà tuyển dụng', items: [{ label: 'Đăng tin', url: '/tuyendung' }] },
      ]
      : { site_name: 'ProCV', footer_show_link_groups: true, hotline: '1900 1234' }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

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
