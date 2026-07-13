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
    for (const protectedPath of ['/tai-khoan/thong-tin-ca-nhan', '/onboard-user', '/onboard-user-setting']) {
      await page.goto(protectedPath)
      await expect(page).toHaveURL(/\/login\?returnUrl=/)
    }

    await page.goto('/tuyendung/app/dashboard')
    await expect(page).toHaveURL(/\/tuyendung\/app\/login\?returnUrl=/)

    await page.goto('/admin/app/dashboard')
    await expect(page).toHaveURL(/\/admin\/app\/login\?returnUrl=/)
  })

  test('renders onboarding for an unconfigured candidate', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.setItem('main_access_token', 'candidate-access-token')
      localStorage.setItem('main_refresh_token', 'candidate-refresh-token')
    })
    await page.unroute('http://localhost:8000/api/**')
    await page.route('http://localhost:8000/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      const responseByPath = {
        '/api/auth/me/': {
          id: 1,
          role: 'candidate',
          full_name: 'Ứng viên thử nghiệm',
          email_verified: true,
          job_preferences_configured: false,
        },
        '/api/candidate/job-preferences/': {
          desired_specializations: [],
          preferred_provinces: [],
          job_preferences_configured: false,
          willing_to_relocate: true,
          ai_recommendation_consent: false,
          recruiter_visibility_consent: false,
        },
        '/api/candidate/profile/': { gender: 'female' },
        '/api/jobs/categories/': {
          count: 3,
          results: [
            { id: 1, name: 'Công nghệ thông tin', parent: null, category_type: 'occupation_group' },
            { id: 2, name: 'Phát triển phần mềm', parent: 1, category_type: 'domain' },
            { id: 3, name: 'Lập trình viên', parent: 2, category_type: 'specialization' },
            { id: 4, name: 'Kinh doanh', parent: null, category_type: 'occupation_group' },
            { id: 5, name: 'Bán hàng', parent: 4, category_type: 'domain' },
            { id: 6, name: 'Tư vấn bán hàng', parent: 5, category_type: 'specialization' },
          ],
        },
        '/api/locations/': { count: 1, results: [{ id: 1, name: 'Hà Nội', level: 'province' }] },
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(responseByPath[path] || {}),
      })
    })

    await page.goto('/onboard-user')
    await expect(page.getByRole('heading', { name: 'Chào mừng bạn đến với ProCV, Ứng viên thử nghiệm' })).toBeVisible()
    await page.getByRole('button', { name: 'Bắt đầu' }).click()
    await expect(page).toHaveURL('/onboard-user-setting')
    await expect(page.getByRole('heading', { name: 'Mô tả công việc mong muốn của bạn' })).toBeVisible()
    await page.getByRole('button', { name: 'Chọn danh mục vị trí chuyên môn' }).click()
    await expect(page.getByText('Công nghệ thông tin', { exact: true })).toBeVisible()
    if (testInfo.project.name === 'desktop-chromium') {
      await expect(page.getByText('Phát triển phần mềm', { exact: true })).toBeVisible()
      await expect(page.getByText('Lập trình viên', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Kinh doanh' }).click()
      await expect(page.getByText('Tư vấn bán hàng', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Công nghệ thông tin' }).click()
      await page.getByRole('button', { name: 'Lập trình viên' }).click()
      await page.getByRole('button', { name: 'Xác nhận' }).click()
      await expect(page.locator('#root').getByText('Lập trình viên', { exact: true })).toBeVisible()
    }

    await page.goto('/tai-khoan/cai-dat-goi-y-viec-lam')
    await expect(page.getByRole('radio', { name: 'Nữ' })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Tôi có thể thay đổi địa điểm làm việc' })).toBeChecked()
    await page.getByRole('button', { name: 'Cập nhật' }).click()
    await expect(page.getByRole('alert').getByText('Vui lòng chọn ít nhất một vị trí chuyên môn.')).toBeVisible()
  })

  test('renders the not-found route for an unknown URL', async ({ page }) => {
    await page.goto('/unknown-route')

    await expect(page.getByText('Trang bạn tìm không tồn tại.')).toBeVisible()
  })
})
