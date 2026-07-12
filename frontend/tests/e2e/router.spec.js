import { expect, test } from '@playwright/test'

async function mockRouteDependencies(page) {
  await page.route('http://localhost:8000/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.startsWith('/api/jobs/frontend-job/')) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
      return
    }

    const body = path === '/api/jobs/' ? { count: 0, results: [] } : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
}

test.describe('portal route registries', () => {
  test.beforeEach(async ({ page }) => {
    await mockRouteDependencies(page)
  })

  test('loads direct public and login routes through their portal registries', async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    for (const path of ['/', '/viec-lam', '/viec-lam/frontend-job', '/login', '/tuyendung']) {
      await page.goto(path)
      await expect(page.locator('body')).not.toBeEmpty()
    }

    await page.goto('/tuyendung/app/login')
    await expect(page.getByRole('heading', { name: 'Đăng nhập dành cho Nhà tuyển dụng' })).toBeVisible()
    await page.goto('/admin/app/login')
    await expect(page.getByRole('heading', { name: 'Đăng nhập Quản trị hệ thống' })).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  test('redirects protected portal routes to their existing login URLs', async ({ page }) => {
    await page.goto('/tai-khoan/thong-tin-ca-nhan')
    await expect(page).toHaveURL(/\/login\?returnUrl=/)

    await page.goto('/tuyendung/app/dashboard')
    await expect(page).toHaveURL(/\/tuyendung\/app\/login\?returnUrl=/)

    await page.goto('/admin/app/dashboard')
    await expect(page).toHaveURL(/\/admin\/app\/login\?returnUrl=/)
  })

  test('renders the not-found route for an unknown URL', async ({ page }) => {
    await page.goto('/unknown-route')

    await expect(page.getByText('Trang bạn tìm không tồn tại.')).toBeVisible()
  })
})
