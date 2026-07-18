import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

test('employer smoke: marketing pages render', async ({ page }) => {
  await mockPublicApi(page)
  const isMobile = page.viewportSize().width < 1024
  const expectActiveNav = async (label) => {
    if (isMobile) {
      await expect(page.getByRole('button', { name: 'Mở menu' })).toBeVisible()
      return
    }
    await expect(page.locator('header').getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page')
  }

  await page.goto('/tuyendung')
  await expect(page.locator('header')).toBeVisible()
  await expectActiveNav('Trang chủ')

  await page.goto('/tuyendung/gioi-thieu')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expectActiveNav('Giới thiệu')

  await page.goto('/tuyendung/lien-he')
  await expect(page.getByLabel('Họ và tên')).toBeVisible()

  await page.goto('/tuyendung/dich-vu')
  await expect(page.getByRole('heading', { level: 1, name: /Giải pháp toàn diện/ })).toBeVisible()

  await page.goto('/tuyendung/bao-gia')
  await expect(page.getByRole('heading', { level: 3, name: 'TOP MAX' })).toBeVisible()
  await expect(page.getByText('7.500.000 ₫')).toBeVisible()
  await page.locator('[data-package-slug="top-max"]').click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('employer smoke: language switcher renders English copy', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/tuyendung/gioi-thieu')

  // Dưới breakpoint sm switcher nằm trong drawer hamburger.
  if (page.viewportSize().width < 640) {
    await page.getByRole('button', { name: 'Mở menu' }).click()
  }
  await page.getByRole('button', { name: /Đổi ngôn ngữ/ }).last().click()
  await page.getByText('English').click()
  await page.keyboard.press('Escape')

  await expect(page.getByRole('heading', { level: 1, name: /Matching the right people/ })).toBeVisible()
})

test('employer smoke: floating consult button opens the lead form', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/tuyendung')

  await page.getByRole('button', { name: 'Tư vấn tuyển dụng' }).click()
  await expect(page.getByRole('dialog').getByText('Đăng ký nhận tư vấn')).toBeVisible()
  await expect(page.getByRole('dialog').getByPlaceholder('0912 345 678')).toBeVisible()
})

test('employer smoke: login loads and dashboard stays role-protected', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/tuyendung/app/login')
  await expect(page.getByRole('heading', { name: 'Chào mừng bạn quay trở lại' })).toBeVisible()

  await page.goto('/tuyendung/app/dashboard')
  await expect(page).toHaveURL(/\/tuyendung\/app\/login\?returnUrl=/)
})

test('employer auth: registration has employer fields and consent-gated Google signup', async ({ page }) => {
  await mockPublicApi(page)
  await page.route('http://localhost:8000/api/auth/register/email-availability/', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ available: true }) })
  })
  await page.goto('/tuyendung/app/register')

  await expect(page.getByRole('heading', { name: 'Đăng ký tài khoản Nhà tuyển dụng' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tạo thông tin đăng nhập' })).toBeVisible()
  await expect(page.getByLabel('Họ và tên')).toHaveCount(0)

  const googleSignup = page.getByRole('button', { name: 'Đăng ký bằng Google' })
  await expect(googleSignup).toBeDisabled()
  await page.getByRole('checkbox').first().check()
  await expect(googleSignup).toBeEnabled()

  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page.getByText('Vui lòng nhập email')).toBeVisible()

  await page.getByLabel('Email đăng nhập').fill('hr@example.com')
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Password1')
  await page.getByLabel('Nhập lại mật khẩu').fill('Password1')
  await page.getByRole('button', { name: 'Tiếp tục' }).click()

  await expect(page.getByRole('heading', { name: 'Thông tin nhà tuyển dụng' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tạo thông tin đăng nhập' })).toHaveCount(0)
  await expect(page.getByLabel('Họ và tên')).toBeVisible()
  await expect(page.getByLabel('Số điện thoại cá nhân')).toBeVisible()
  await expect(page.getByLabel('Tên công ty')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Quay lại' })).toBeVisible()

  await page.goto('/tuyendung/app/forgot-password')
  await expect(page.getByRole('heading', { name: 'Quên mật khẩu?' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Quay lại đăng nhập' }).last()).toHaveAttribute('href', '/tuyendung/app/login')
})

async function setEmployerSession(page, overrides = {}) {
  await page.addInitScript(() => {
    localStorage.setItem('employer_access_token', 'test-access')
    localStorage.setItem('employer_refresh_token', 'test-refresh')
  })
  await page.route('http://localhost:8000/api/auth/me/', async (route) => {
    const currentOverrides = typeof overrides === 'function' ? overrides() : overrides
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'usr_test', email: 'hr@example.com', role: 'employer', full_name: 'Nguyễn An',
        has_usable_password: true,
        email_verified: false, employer_onboarding_required: true,
        employer_onboarding_step: 'email_verification',
        ...currentOverrides,
      }),
    })
  })
}

test('employer auth: unverified session is redirected to account verification', async ({ page }) => {
  await mockPublicApi(page)
  await setEmployerSession(page)

  await page.goto('/tuyendung/app/dashboard')

  await expect(page).toHaveURL(/\/tuyendung\/app\/account\/verify$/)
  await expect(page.getByRole('heading', { name: 'Xác thực địa chỉ email' })).toBeVisible()
  await expect(page.getByText('hr@example.com')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gửi email xác thực' })).toBeVisible()
})

test('employer auth: legacy verification link keeps its token', async ({ page }) => {
  await mockPublicApi(page)
  let submittedToken = null
  await page.route('http://localhost:8000/api/auth/verify/confirm/', async (route) => {
    submittedToken = route.request().postDataJSON()?.token
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Xác thực email thành công.' }),
    })
  })

  await page.goto('/tuyendung/app/xac-thuc-email?token=legacy-email-token')

  await expect(page).toHaveURL(/\/tuyendung\/app\/account\/verify\?token=legacy-email-token$/)
  await expect.poll(() => submittedToken).toBe('legacy-email-token')
  await expect(page.getByRole('heading', { name: 'Xác thực thành công!' })).toBeVisible()
})

test('employer auth: verified session completes recruitment need before dashboard', async ({ page }) => {
  await mockPublicApi(page)
  let needCompleted = false
  let submittedNeed = null
  await setEmployerSession(page, () => ({
    email_verified: true,
    employer_onboarding_required: !needCompleted,
    employer_onboarding_step: needCompleted ? 'complete' : 'consulting_need',
  }))
  await page.route(/http:\/\/localhost:8000\/api\/jobs\/categories\/.*/, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 12,
        public_id: 'cat_sales',
        name: 'Kinh doanh phần mềm',
        category_type: 'specialization',
      }]),
    })
  })
  await page.route('http://localhost:8000/api/employer/consulting-need/', async (route) => {
    if (route.request().method() === 'POST') {
      submittedNeed = route.request().postDataJSON()
      needCompleted = true
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ public_id: 'need_test', ...submittedNeed }),
      })
      return
    }
    await route.fulfill({ contentType: 'application/json', body: 'null' })
  })

  await page.goto('/tuyendung/app/dashboard')

  await expect(page).toHaveURL(/\/tuyendung\/app\/consulting-need$/)
  await expect(page.getByRole('heading', { name: /Xin chào, Nguyễn An/ })).toBeVisible()
  await expect(page.getByText('Nhu cầu tuyển dụng', { exact: true })).toBeVisible()
  await expect(page.getByText('Bạn đang tuyển dụng vị trí chuyên môn nào?')).toBeVisible()
  await page.getByRole('combobox', { name: /Bạn đang tuyển dụng vị trí chuyên môn nào/ }).click()
  await page.locator('.ant-select-dropdown:visible').getByText('Kinh doanh phần mềm').click()
  await page.getByRole('checkbox', { name: 'Tuyển liên tục' }).check()
  await page.getByRole('combobox', { name: /Bạn có nhu cầu cần tư vấn kỹ hơn/ }).click()
  await page.locator('.ant-select-dropdown:visible').getByText('Tôi muốn tìm hiểu thêm về các gói dịch vụ').click()
  await page.getByRole('button', { name: 'Hoàn thành' }).click()

  await expect.poll(() => submittedNeed).toMatchObject({
    position_category: 12,
    position_level: 'employee',
    is_continuous: true,
    headcount: 1,
    budget_source: 'company',
    consultation_topics: ['service_packages'],
  })
  await expect(page).toHaveURL(/\/tuyendung\/app\/employer-verify$/)
  await expect(page.getByRole('heading', { name: 'Xác thực thông tin' })).toBeVisible()
  await expect(page.getByText('Xác thực số điện thoại', { exact: true })).toBeVisible()

  await page.goto('/tuyendung/app/consulting-need')
  await expect(page).toHaveURL(/\/tuyendung\/app\/dashboard$/)
  await expect(page.getByRole('heading', { name: /Chào Nguyễn An/ })).toBeVisible()
})

test('employer workspace: verification actions stay inside the 100vh app shell', async ({ page }) => {
  await mockPublicApi(page)
  await setEmployerSession(page, {
    email_verified: true,
    employer_onboarding_required: false,
    employer_onboarding_step: 'complete',
    has_usable_password: false,
  })
  await page.route('http://localhost:8000/api/employer/me/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'rec_test',
        company: null,
        contact_phone: '0912345678',
        onboarding: {
          phone_verified: false,
          company_linked: false,
          business_doc_submitted: false,
          candidate_dpa_submitted: false,
          dpa_accepted: false,
          first_job_posted: false,
        },
      }),
    })
  })
  await page.route('http://localhost:8000/api/employer/industries/all/', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' })
  })

  await page.goto('/tuyendung/app/employer-verify')

  const workspace = page.getByTestId('employer-workspace')
  await expect(workspace).toBeVisible()
  await expect(workspace).toHaveCSS('height', `${page.viewportSize().height}px`)
  await expect(page.getByTestId('employer-topbar')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Cập nhật ngay' }).first()).toBeVisible()
  if (page.viewportSize().width < 1024) {
    await page.getByRole('button', { name: 'Mở menu quản trị' }).click()
  }
  await expect(page.getByRole('menuitem', { name: /Bảng tin/ })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /Cài đặt tài khoản/ })).toBeVisible()
  await expect(page.getByText('Xác thực địa chỉ email')).toHaveCount(0)
  await page.getByRole('button', { name: 'Cập nhật Xác thực số điện thoại' }).click()
  await expect(page.getByRole('dialog')).toContainText('Tài khoản của bạn chưa có mật khẩu do được đăng ký bằng Google')
  await page.getByRole('button', { name: 'Cập nhật mật khẩu tại đây' }).click()
  await expect(page).toHaveURL(/\/tuyendung\/app\/account\/settings\/password-login$/)
  await expect(page).toHaveTitle('Thay đổi mật khẩu | Smart Recruitment Platform')

  await page.goto('/tuyendung/app/account/settings/company?update=true')
  await expect(page.getByRole('tab', { name: /Tìm kiếm thông tin công ty/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Tạo công ty mới/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Bảng giá dịch vụ/ })).toHaveCount(0)

  if (page.viewportSize().width < 1024) {
    await page.getByRole('button', { name: 'Mở menu quản trị' }).click()
  }
  const sidebarAccountLink = page.getByTestId('employer-sidebar').getByRole('link', { name: 'Thông tin tài khoản' })
  await expect(sidebarAccountLink).toHaveAttribute('href', '/tuyendung/app/account/settings/account-info')
  await sidebarAccountLink.click()
  await expect(page).toHaveURL(/\/tuyendung\/app\/account\/settings\/account-info$/)
  await expect(page).toHaveTitle('Thông tin tài khoản | Smart Recruitment Platform')
  await expect(page.getByRole('heading', { name: 'Thông tin tài khoản' })).toBeVisible()
  await expect(page.getByLabel('Họ và tên')).toHaveValue('Nguyễn An')
  await expect(page.getByRole('button', { name: 'Cập nhật' })).toBeVisible()
})
