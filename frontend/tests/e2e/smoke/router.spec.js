import { expect, test } from '@playwright/test'

const API_ROUTE = /^https?:\/\/[^/]+\/api\/.*$/

async function mockRouteDependencies(page) {
  await page.route(API_ROUTE, async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me/' || path === '/api/auth/refresh/') {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"Unauthenticated"}' })
      return
    }
    if (path.startsWith('/api/public/jobs/frontend-job/')) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
      return
    }

    const body = path === '/api/public/jobs/'
      ? { count: 0, results: [] }
      : path === '/api/public/privacy/consent/'
        ? { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
        : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
}

test.describe('portal route registries', () => {
  test.beforeEach(async ({ page }) => {
    await mockRouteDependencies(page)
  })

  test('loads direct public and login routes through their portal registries', async ({ page }) => {
    const pageErrors = []
    let companyRequests = 0
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/public/companies/') companyRequests += 1
    })

    for (const path of [
      '/',
      '/cong-ty',
      '/cong-ty/tim-kiem?keyword=Alpha',
      '/viec-lam',
      '/viec-lam/frontend-job',
      '/dang-nhap',
      '/tuyendung',
    ]) {
      await page.goto(path)
      await expect(page.locator('body')).not.toBeEmpty()
    }

    const requestsBeforeBlankSearch = companyRequests
    await page.goto('/cong-ty/tim-kiem?keyword=%20%20')
    await expect(page).toHaveURL(/\/cong-ty\/tim-kiem\?keyword=%20%20$/)
    await expect(page.getByRole('heading', { name: /Tìm kiếm thông tin công ty/ })).toBeVisible()
    expect(companyRequests).toBe(requestsBeforeBlankSearch)

    await page.goto('/tuyendung/app/dang-nhap')
    await expect(page.getByRole('heading', { name: 'Chào mừng bạn quay trở lại' })).toBeVisible()
    await page.goto('/quan-tri/dang-nhap')
    await expect(page.getByRole('heading', { name: 'Đăng nhập quản trị' })).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  test('redirects protected portal routes to their existing login URLs', async ({ page }) => {
    for (const protectedPath of ['/tai-khoan/thong-tin-ca-nhan', '/hoan-thien-ho-so', '/onboard-user-setting']) {
      await page.goto(protectedPath)
      await expect(page).toHaveURL(/\/dang-nhap\?returnUrl=/)
    }

    await page.goto('/tuyendung/app/tong-quan')
    await expect(page).toHaveURL(/\/tuyendung\/app\/dang-nhap\?returnUrl=/)

    await page.goto('/quan-tri/tong-quan')
    await expect(page).toHaveURL(/\/quan-tri\/dang-nhap\?returnUrl=/)
  })

  test('sends legacy English URLs from old emails to the Vietnamese routes', async ({ page }) => {
    await page.goto('/sign-up?ref=email#form')
    await expect(page).toHaveURL(/\/dang-ky\?ref=email#form$/)

    await page.goto('/tuyendung/app/employer-verify')
    await expect(page).toHaveURL(/\/tuyendung\/app\/dang-nhap\?returnUrl=%2Ftuyendung%2Fapp%2Fxac-thuc-tai-khoan$/)

    await page.goto('/admin/app/job-moderation/jb_1')
    await expect(page).toHaveURL(/\/quan-tri\/dang-nhap\?returnUrl=%2Fquan-tri%2Fduyet-tin%2Fjb_1$/)
  })

  test('redirects an authenticated candidate away from login and sign-up', async ({ page }) => {
    await page.unroute(API_ROUTE)
    await page.route(API_ROUTE, async (route) => {
      const path = new URL(route.request().url()).pathname
      const body = path === '/api/auth/refresh/'
        ? { access: 'e2e-access' }
        : path === '/api/auth/me/'
          ? { id: 1, role: 'candidate', email_verified: true, job_preferences_configured: true }
          : path === '/api/public/privacy/consent/'
            ? { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
            : path === '/api/public/jobs/'
              ? { count: 0, results: [] }
              : path === '/api/public/jobs/categories/' || path === '/api/public/locations/'
                ? []
                : path === '/api/public/site/banners/'
                  ? []
                  : {}
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
    })

    await page.goto('/dang-nhap')
    await expect(page).toHaveURL('/')
    await page.goto('/dang-ky')
    await expect(page).toHaveURL('/')
  })

  test('renders onboarding for an unconfigured candidate', async ({ page }, testInfo) => {
    await page.unroute(API_ROUTE)
    await page.route(API_ROUTE, async (route) => {
      const path = new URL(route.request().url()).pathname
      const responseByPath = {
        '/api/auth/refresh/': { access: 'e2e-access' },
        '/api/auth/me/': {
          id: 1,
          role: 'candidate',
          full_name: 'Ứng viên thử nghiệm',
          email_verified: true,
          job_preferences_configured: false,
        },
        '/api/candidate/job-preferences/': {
          desired_position_others: [],
          desired_specializations: [],
          preferred_provinces: [],
          preferred_skills: [],
          job_preferences_configured: false,
          willing_to_relocate: true,
          ai_recommendation_consent: false,
          recruiter_visibility_consent: false,
        },
        '/api/candidate/profile/': { gender: 'female' },
        '/api/public/privacy/consent/': {
          consent: { necessary: true, preferences: false, analytics: false, marketing: false },
        },
        '/api/public/jobs/categories/': {
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
        '/api/public/locations/': { count: 1, results: [{ id: 1, name: 'Hà Nội', level: 'province' }] },
        '/api/public/skills/': { count: 0, results: [] },
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(responseByPath[path] || {}),
      })
    })

    await page.goto('/hoan-thien-ho-so')
    await expect(page.locator('.onboarding-chat__sr').first()).toContainText('Chào Ứng viên thử nghiệm!')
    await page.getByRole('button', { name: 'Bắt đầu thôi!' }).click()
    await expect(page).toHaveURL('/hoan-thien-ho-so')
    await expect(page.getByText('Câu 1/5')).toBeVisible()
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
    await expect(page.locator('#desired_specialization_ids_help')).toContainText(
      'Vui lòng chọn hoặc nhập ít nhất một vị trí chuyên môn.',
    )
  })

  test('renders the not-found route for an unknown URL', async ({ page }) => {
    await page.goto('/unknown-route')

    await expect(page.getByText('Trang bạn tìm không tồn tại.')).toBeVisible()
  })
})
