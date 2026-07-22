import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => {
    const root = document.documentElement
    const body = document.body
    return Math.max(root.scrollWidth, body?.scrollWidth || 0) - window.innerWidth
  })).toBeLessThanOrEqual(1)
}

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
  await expectNoHorizontalOverflow(page)

  await page.goto('/tuyendung/gioi-thieu')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expectActiveNav('Giới thiệu')
  await expectNoHorizontalOverflow(page)

  await page.goto('/tuyendung/lien-he')
  await expect(page.getByLabel('Họ và tên')).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.goto('/tuyendung/dich-vu')
  await expect(page.getByRole('heading', { level: 1, name: /Giải pháp toàn diện/ })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.goto('/tuyendung/bao-gia')
  await expect(page.getByRole('heading', { level: 3, name: 'TOP MAX' })).toBeVisible()
  await expect(page.getByText('7.500.000 ₫')).toBeVisible()
  await expectNoHorizontalOverflow(page)
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
  await page.getByRole('menuitem', { name: 'English', exact: true }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
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
  await expectNoHorizontalOverflow(page)

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
  await expectNoHorizontalOverflow(page)
  await expect(page.getByLabel('Các bước tạo tài khoản')).toHaveCount(0)
  const rulesToggle = page.getByRole('button', { name: 'Quy định' })
  const rulesContent = page.getByText(/không cho phép một người dùng tạo nhiều tài khoản nhà tuyển dụng/)
  await expect(rulesToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(rulesContent).toBeVisible()
  await rulesToggle.click()
  await expect(rulesToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(rulesContent).toHaveCount(0)
  await rulesToggle.click()
  await expect(rulesContent).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tạo thông tin đăng nhập' })).toBeVisible()
  await expect(page.getByLabel('Họ và tên')).toHaveCount(0)
  await expect(page.getByText('Trường hợp bạn đăng ký tài khoản bằng email không phải email tên miền công ty, một số dịch vụ trên tài khoản có thể sẽ bị giới hạn quyền mua hoặc sử dụng.')).toBeVisible()

  const googleSignup = page.getByRole('button', { name: 'Đăng ký bằng Google' })
  await expect(googleSignup).toBeDisabled()
  await page.getByRole('checkbox').first().check()
  await expect(googleSignup).toBeEnabled()

  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page.getByText('Vui lòng nhập email')).toBeVisible()

  await page.getByLabel('Email đăng nhập').fill('hr@example.com')
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Password1')
  await expect(page.getByText('Mật khẩu trung bình')).toBeVisible()
  await expect(page.getByLabel('Điều kiện mật khẩu').getByText('Có ít nhất 1 ký tự đặc biệt (!, @, #, ...)')).toBeVisible()
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Password@1')
  await expect(page.getByText('Mật khẩu mạnh')).toBeVisible()
  await page.getByLabel('Nhập lại mật khẩu').fill('Password@1')
  await expect(page.getByLabel('Điều kiện mật khẩu')).toHaveCount(0)
  await page.getByRole('button', { name: 'Tiếp tục' }).click()

  await expect(page.getByRole('heading', { name: 'Thông tin nhà tuyển dụng' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tạo thông tin đăng nhập' })).toHaveCount(0)
  await expect(page.getByLabel('Họ và tên')).toBeVisible()
  await expect(page.getByLabel('Số điện thoại cá nhân')).toBeVisible()
  await expect(page.getByLabel('Tên công ty')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Quay lại' })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.goto('/tuyendung/app/forgot-password')
  await expect(page.getByRole('heading', { name: 'Quên mật khẩu?' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Quay lại đăng nhập' }).last()).toHaveAttribute('href', '/tuyendung/app/login')
  await expectNoHorizontalOverflow(page)
})

async function setEmployerSession(page, overrides = {}) {
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
  await expect(page.getByRole('heading', { name: /Xin chào, Nguyễn An/ })).toBeVisible()
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
  await page.route('http://localhost:8000/api/employer/recruitment-needs/', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' })
  })

  await page.goto('/tuyendung/app/employer-verify')

  const workspace = page.getByTestId('employer-workspace')
  await expect(workspace).toBeVisible()
  await expect(workspace).toHaveCSS('height', `${page.viewportSize().height}px`)
  await expect(page.getByTestId('employer-topbar')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expect(page.getByRole('link', { name: 'Cập nhật ngay' }).first()).toBeVisible()
  if (page.viewportSize().width < 1024) {
    await page.getByRole('button', { name: 'Mở menu quản trị' }).click()
  }
  await expect(page.getByRole('menuitem', { name: /Bảng tin/ })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /Cài đặt tài khoản/ })).toBeVisible()
  if (page.viewportSize().width < 1024) {
    await page.getByRole('button', { name: 'Đóng menu quản trị' }).click()
  }
  await expect(page.getByText('Xác thực địa chỉ email')).toHaveCount(0)
  await page.getByRole('button', { name: 'Cập nhật Xác thực số điện thoại' }).click()
  await expect(page.getByRole('dialog')).toContainText('Tài khoản của bạn chưa có mật khẩu do được đăng ký bằng Google')
  await page.getByRole('button', { name: 'Cập nhật mật khẩu tại đây' }).click()
  await expect(page).toHaveURL(/\/tuyendung\/app\/account\/settings\/password-login$/)
  await expect(page).toHaveTitle('Thay đổi mật khẩu | ProCV cho Nhà tuyển dụng')
  await expectNoHorizontalOverflow(page)

  await page.goto('/tuyendung/app/account/settings/company?update=true')
  await expect(page.getByRole('tab', { name: /Tìm kiếm thông tin công ty/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Tạo công ty mới/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Bảng giá dịch vụ/ })).toHaveCount(0)
  await expectNoHorizontalOverflow(page)

  await page.goto('/tuyendung/app/account/settings/gpkd')
  const businessRegistrationRadio = page.getByRole('radio', { name: 'Giấy đăng ký doanh nghiệp hoặc Giấy tờ tương đương khác' })
  const authorizationRadio = page.getByRole('radio', { name: 'Giấy ủy quyền và Giấy tờ định danh' })
  await expect(businessRegistrationRadio).toBeChecked()
  await expect(page.getByRole('img', { name: 'Minh họa giấy chứng nhận đăng ký doanh nghiệp' })).toHaveAttribute('src', '/images/employer/business-registration-sample.jpg')
  expect((await authorizationRadio.boundingBox()).y).toBeGreaterThan((await businessRegistrationRadio.boundingBox()).y)

  await authorizationRadio.check()
  const authorizationHeading = page.getByRole('heading', { name: 'Giấy ủy quyền *' })
  await expect(authorizationHeading).toBeVisible()
  expect((await authorizationHeading.boundingBox()).y).toBeGreaterThan((await authorizationRadio.boundingBox()).y)
  await expect(page.getByRole('img', { name: 'Minh họa giấy ủy quyền' })).toHaveAttribute('src', '/images/employer/authorization-sample.jpg')
  await expect(page.getByRole('img', { name: 'Minh họa căn cước công dân hoặc hộ chiếu' })).toHaveAttribute('src', '/images/employer/identity-sample.jpg')
  await expect(page.getByRole('button', { name: 'Lưu' })).toBeDisabled()
  await expectNoHorizontalOverflow(page)

  await page.goto('/tuyendung/app/account/settings/personal-data-protection')
  await expect(page.getByRole('heading', { name: /giữa Ứng viên - Nhà tuyển dụng/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Tải mẫu văn bản/ })).toHaveAttribute('href', '/documents/topcv-mau-van-ban-thong-bao-dong-y-xu-ly-dlcn.docx')
  const dpaFileInput = page.locator('input[type="file"]')
  await dpaFileInput.setInputFiles({
    name: 'thoa-thuan.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: Buffer.from('candidate agreement'),
  })
  await page.getByRole('checkbox', { name: /Tôi cam đoan văn bản này/i }).check()
  await expect(page.getByRole('button', { name: 'Lưu' })).toBeEnabled()
  await page.getByRole('checkbox', { name: /Xác nhận đồng ý với các điều khoản/i }).check()
  await expect(page.getByRole('button', { name: 'Xác nhận' })).toBeEnabled()
  await expectNoHorizontalOverflow(page)

  await page.goto('/tuyendung/app/account/settings/recruitment-demand')
  await expect(page.getByRole('button', { name: 'Thêm nhu cầu' })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.goto('/tuyendung/app/account/settings/general-setting')
  await expect(page.getByText('Xác thực 2 yếu tố', { exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.goto('/tuyendung/app/dashboard')
  await expect(page.getByRole('heading', { name: /Xin chào, Nguyễn An/ })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  if (page.viewportSize().width < 1024) {
    await page.getByRole('button', { name: 'Mở menu quản trị' }).click()
  }
  const sidebarAccountLink = page.getByTestId('employer-sidebar').getByRole('link', { name: 'Thông tin tài khoản' })
  await expect(sidebarAccountLink).toHaveAttribute('href', '/tuyendung/app/account/settings/account-info')
  await sidebarAccountLink.click()
  await expect(page).toHaveURL(/\/tuyendung\/app\/account\/settings\/account-info$/)
  await expect(page).toHaveTitle('Thông tin tài khoản | ProCV cho Nhà tuyển dụng')
  await expect(page.getByRole('heading', { name: 'Thông tin tài khoản', exact: true })).toBeVisible()
  await expect(page.getByLabel('Họ và tên')).toHaveValue('Nguyễn An')
  await expect(page.getByRole('button', { name: 'Cập nhật' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('employer workspace: completed verification redirects away from the checklist while keeping the first-job action separate', async ({ page }) => {
  await mockPublicApi(page)
  await setEmployerSession(page, {
    email_verified: true,
    employer_onboarding_required: false,
    employer_onboarding_step: 'complete',
    employer_verification_completed: true,
  })
  await page.route('http://localhost:8000/api/employer/me/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'rec_verified',
        onboarding: {
          phone_verified: true,
          company_linked: true,
          business_doc_submitted: true,
          candidate_dpa_submitted: true,
          dpa_accepted: true,
          verification_completed: true,
          first_job_posted: false,
        },
      }),
    })
  })

  await page.goto('/tuyendung/app/employer-verify')

  await expect(page).toHaveURL(/\/tuyendung\/app\/dashboard$/)
  await expect(page.getByRole('heading', { name: /Xin chào, Nguyễn An/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Xác thực thông tin' })).toHaveCount(0)
  await expect(page.getByLabel('Đăng tin tuyển dụng đầu tiên')).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('employer jobs: an incomplete account is redirected to the five-step verification checklist', async ({ page }) => {
  await mockPublicApi(page)
  await setEmployerSession(page, {
    email_verified: true,
    employer_onboarding_required: false,
    employer_onboarding_step: 'complete',
  })
  await page.route('http://localhost:8000/api/employer/me/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'rec_incomplete',
        onboarding: {
          phone_verified: true,
          company_linked: true,
          business_doc_submitted: false,
          candidate_dpa_submitted: false,
          dpa_accepted: false,
          verification_completed: false,
        },
      }),
    })
  })

  await page.goto('/tuyendung/app/jobs')

  await expect(page).toHaveURL(/\/tuyendung\/app\/employer-verify$/)
  await expect(page.getByRole('heading', { name: 'Xác thực thông tin' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('employer jobs: manual job form exposes the complete five-section workflow', async ({ page }) => {
  let savedDraft = null
  await mockPublicApi(page)
  await setEmployerSession(page, {
    email_verified: true,
    employer_onboarding_required: false,
    employer_onboarding_step: 'complete',
    employer_verification_completed: true,
  })
  await page.route('http://localhost:8000/api/employer/me/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'rec_verified',
        onboarding: {
          phone_verified: true,
          company_linked: true,
          business_doc_submitted: true,
          candidate_dpa_submitted: true,
          dpa_accepted: true,
          verification_completed: true,
        },
      }),
    })
  })
  await page.route(/http:\/\/localhost:8000\/api\/jobs\/categories\/.*/, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 10, name: 'Công nghệ thông tin', parent: null, category_type: 'occupation_group' },
        { id: 18, name: 'IT - Phần mềm', parent: 10, category_type: 'domain' },
        { id: 19, name: 'Dữ liệu', parent: 10, category_type: 'domain' },
        { id: 12, name: 'Backend Engineer', parent: 18, category_type: 'specialization' },
      ]),
    })
  })
  await page.route('http://localhost:8000/api/employer/campaigns/options/', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ public_id: 'camp_q3', name: 'Tuyển dụng Quý 3' }]) })
  })
  await page.route('http://localhost:8000/api/jobs/mine/posting-context/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ job_postable: true, free_publish_limit: 3, free_publish_remain: 3 }),
    })
  })
  await page.route(/http:\/\/localhost:8000\/api\/jobs\/mine\/\?as=draft$/, async (route) => {
    savedDraft = route.request().postDataJSON()
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ public_id: 'job_draft', status: 'draft', ...savedDraft }),
    })
  })
  await page.route('http://localhost:8000/api/jobs/benefits/', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 1, name: 'Bảo hiểm' }]) })
  })
  await page.route('http://localhost:8000/api/jobs/languages/', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 2, name: 'Tiếng Anh' }]) })
  })
  await page.route('http://localhost:8000/api/skills/', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 3, name: 'React' }]) })
  })
  await page.route(/http:\/\/localhost:8000\/api\/locations\/.*/, async (route) => {
    const level = new URL(route.request().url()).searchParams.get('level')
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(level === 'ward'
        ? [{ id: 2, name: 'Phường Hải Châu', level: 'ward', parent: 1 }, { id: 3, name: 'Phường Hòa Cường', level: 'ward', parent: 1 }]
        : [{ id: 1, name: 'Đà Nẵng', level: 'province' }]),
    })
  })

  const initialCatalogResponses = Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/jobs/categories/' && response.status() === 200),
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/employer/campaigns/options/' && response.status() === 200),
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/jobs/mine/posting-context/' && response.status() === 200),
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/jobs/benefits/' && response.status() === 200),
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/jobs/languages/' && response.status() === 200),
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/skills/' && response.status() === 200),
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/locations/' && response.status() === 200),
  ])

  await page.goto('/tuyendung/app/jobs/new?campaign=camp_q3')
  await initialCatalogResponses

  await expect(page.getByLabel('Tiêu đề tin')).toBeVisible()
  await page.getByLabel('Vị trí chuyên môn').click()
  await expect(page.locator('.ant-cascader-dropdown:visible').getByText('Công nghệ thông tin')).toBeVisible()
  await page.locator('.ant-cascader-dropdown:visible').getByText('Công nghệ thông tin').click()
  await page.locator('.ant-cascader-dropdown:visible').getByText('IT - Phần mềm').click()
  await page.locator('.ant-cascader-dropdown:visible').getByText('Backend Engineer').click()
  await expect(page.getByText('Cách ứng viên tìm thấy tin tuyển dụng của bạn')).toBeVisible()
  await expect(page.getByLabel('Kiến thức chuyên ngành')).toBeVisible()
  await page.getByLabel('Kiến thức chuyên ngành').click()
  const domainDropdown = page.locator('.ant-select-dropdown:visible:not(.ant-cascader-dropdown)')
  await domainDropdown.getByText('IT - Phần mềm', { exact: true }).click()
  await domainDropdown.getByText('Dữ liệu', { exact: true }).click()
  await page.keyboard.press('Escape')

  await page.getByLabel('Loại công việc').click()
  for (const label of ['Toàn thời gian', 'Bán thời gian', 'Thời vụ', 'Làm tại nhà (việc làm phổ thông)', 'Thực tập', 'Khác']) {
    await expect(page.locator('.ant-select-dropdown:visible').getByText(label, { exact: true })).toBeVisible()
  }
  await page.keyboard.press('Escape')
  await page.getByLabel('Hình thức làm việc').click()
  for (const label of ['Làm việc tại văn phòng / Onsite', 'Làm việc từ xa / Remote', 'Làm việc linh hoạt / Hybrid']) {
    await expect(page.locator('.ant-select-dropdown:visible').getByText(label, { exact: true })).toBeVisible()
  }
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Thông tin chung' })).toBeVisible()
  await expect(page.locator('#description').getByRole('heading', { name: 'Mô tả công việc' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kỳ vọng về ứng viên' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Thông tin nhận hồ sơ' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dịch vụ và gia tăng hiệu quả' })).toBeVisible()
  await expect(page.getByText('Quyền lợi bổ sung', { exact: true })).toBeVisible()
  await expect(page.locator('.company-rich-editor__content')).toHaveCount(3)
  await expect(page.locator('.company-rich-editor__content').first()).toHaveCSS('min-height', '230px')
  await page.getByLabel(/Khu vực 1 - Tỉnh\/thành phố/).click()
  await page.locator('.ant-select-dropdown:visible').getByText('Đà Nẵng', { exact: true }).click()
  await page.getByRole('combobox', { name: /Phường\/xã 1/ }).click()
  await page.locator('.ant-select-dropdown:visible').getByText('Phường Hải Châu', { exact: true }).click()
  await page.getByLabel('Địa điểm chi tiết').fill('123 đường Nguyễn Huệ')
  await page.getByRole('button', { name: 'Thêm phường/xã' }).click()
  const wardPicker = page.locator('.ant-popover:visible')
  await wardPicker.getByText('Phường Hòa Cường', { exact: true }).click()
  await wardPicker.getByRole('button', { name: 'Áp dụng (1)' }).click()
  await expect(page.getByRole('combobox', { name: /Phường\/xã 2/ })).toBeVisible()
  await page.getByRole('button', { name: 'Thêm khu vực làm việc' }).click()
  await expect(page.getByLabel(/Khu vực 2 - Tỉnh\/thành phố/)).toBeVisible()
  await expect(page.getByText(/^Thời gian làm việc/)).toBeVisible()
  await expect(page.getByLabel('Từ thứ')).toBeVisible()
  await expect(page.getByLabel('Đến thứ')).toBeVisible()
  await expect(page.getByLabel('Mô tả thời gian làm việc')).toBeVisible()
  await page.getByRole('button', { name: 'Thêm thời gian' }).click()
  await expect(page.getByLabel('Từ thứ')).toHaveCount(2)
  await expect(page.getByText('Kỹ năng cần có', { exact: true })).toBeVisible()
  await expect(page.locator('#expectations').getByText('Ngoại ngữ', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Họ và tên người nhận')).toHaveValue('Nguyễn An')
  await expect(page.locator('#application').getByText('hr@example.com', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lưu nháp' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gửi duyệt tin' })).toBeVisible()
  await expect(page.getByText('Đăng tin bằng AI')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
  await page.getByRole('button', { name: 'Lưu nháp' }).click()
  await expect.poll(() => savedDraft).toMatchObject({
    category_assignments: [
      { category: 12, role: 'primary_specialization', sort_order: 0 },
      { category: 18, role: 'domain_knowledge', sort_order: 1 },
      { category: 19, role: 'domain_knowledge', sort_order: 2 },
    ],
    job_locations: [
      { location: 2, address_detail: '123 đường Nguyễn Huệ', sort_order: 0 },
      { location: 3, address_detail: '', sort_order: 1 },
    ],
  })
})

test('employer jobs: detail workspace is compact, actionable and responsive', async ({ page }) => {
  await mockPublicApi(page)
  await setEmployerSession(page, {
    email_verified: true,
    employer_onboarding_required: false,
    employer_onboarding_step: 'complete',
    employer_verification_completed: true,
  })
  await page.route('http://localhost:8000/api/employer/me/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'rec_verified',
        onboarding: { verification_completed: true },
      }),
    })
  })
  await page.route('http://localhost:8000/api/jobs/mine/jb_workspace/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'jb_workspace', title: 'Kỹ sư Frontend React', status: 'active',
        campaign_name: 'Tuyển đội ngũ sản phẩm', deadline: '2026-08-31', view_count: 36,
        application_count: 2, number_of_vacancies: 2, salary_type: 'range',
        salary_min: 18000000, salary_max: 30000000, employment_type: 'full_time',
        work_type: 'hybrid', work_types: ['hybrid', 'onsite'], experience_years: '2',
        education_level: 'university', position_level: 'employee', gender_requirement: 'any',
        age_min: 22, age_max: 35,
        description: '<p>Xây dựng giao diện sản phẩm tuyển dụng.</p>',
        requirements: '<p>Thành thạo React và JavaScript.</p>',
        benefits: '<p>Lương tháng 13 và bảo hiểm sức khỏe.</p>',
        category_assignments: [{ id: 1, category_name: 'Frontend Developer', role: 'primary_specialization' }],
        job_locations: [{ id: 1, location: 11, province_name: 'Đà Nẵng', location_name: 'Phường Hải Châu', address_detail: '123 Nguyễn Văn Linh' }],
        work_schedules: [{ id: 1, weekday_from: 1, weekday_to: 5, start_time: '08:30:00', end_time: '17:30:00' }],
        job_skills: [{ id: 1, skill: 3, skill_name: 'React', importance: 'required' }],
        job_benefits: [{ id: 1, benefit: 4, benefit_name: 'Bảo hiểm sức khỏe' }],
        language_requirements: [{ id: 1, language: 2, language_name: 'Tiếng Anh', proficiency_label: 'Sử dụng trong công việc' }],
        application_contact: { recipient_name: 'Nguyễn An', phone: '0912345678', emails: [{ id: 1, email: 'hr@example.com' }] },
      }),
    })
  })
  await page.route(/http:\/\/localhost:8000\/api\/v2\/recruiter\/applications\/.*/, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          public_id: 'app_applied', candidate_name: 'Trần Minh', candidate_email: 'minh@example.com',
          submitted_cv_title: 'Frontend CV', source: 'applied', status: 'submitted', applied_at: '2026-07-20T08:00:00Z',
        },
        {
          public_id: 'app_recommended', candidate_name: 'Lê Hoa', candidate_email: 'hoa@example.com',
          submitted_cv_title: 'Product CV', source: 'recommended', status: 'considering', applied_at: '2026-07-19T08:00:00Z',
        },
      ]),
    })
  })

  await page.goto('/tuyendung/app/jobs/jb_workspace')

  await expect(page).toHaveTitle('Chi tiết tin tuyển dụng | ProCV cho Nhà tuyển dụng')
  await expect(page.getByRole('heading', { name: 'Kỹ sư Frontend React' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Chỉnh sửa/ })).toBeVisible()
  await expect(page.getByTestId('job-metric-total-cvs')).toContainText('2')
  await expect(page.getByTestId('job-metric-applied-cvs')).toContainText('1')
  await expect(page.getByTestId('job-metric-connected-cvs')).toContainText('1')
  await expect(page.getByTestId('job-metric-views')).toContainText('36')
  const usesCompactTabs = page.viewportSize().width < 640
  if (usesCompactTabs) {
    await expect(page.getByRole('combobox', { name: 'Chọn nội dung quản lý tin' })).toBeVisible()
  } else {
    await expect(page.getByRole('tab', { name: /CV ứng tuyển/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Ứng viên đã xem tin/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Thông tin tuyển dụng/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Nhãn/ })).toBeVisible()
  }
  await expect(page.getByText('Trần Minh').filter({ visible: true })).toBeVisible()
  await expect(page.getByText('Lê Hoa')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)

  if (usesCompactTabs) {
    await page.getByRole('combobox', { name: 'Chọn nội dung quản lý tin' }).click()
    await page.locator('.ant-select-dropdown:visible').getByText('Thông tin tuyển dụng', { exact: true }).click()
  } else {
    await page.getByRole('tab', { name: /Thông tin tuyển dụng/ }).click()
  }
  await expect(page.getByText('18 - 30 triệu')).toBeVisible()
  await expect(page.getByText('Phường Hải Châu')).toBeVisible()
  await expect(page.getByText('React', { exact: true })).toBeVisible()
  await expect(page.getByText('Bảo hiểm sức khỏe', { exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('employer campaigns: compact list links to a campaign and its single job', async ({ page }) => {
  await mockPublicApi(page)
  await setEmployerSession(page, {
    email_verified: true,
    employer_onboarding_required: false,
    employer_onboarding_step: 'complete',
    employer_verification_completed: true,
  })
  await page.route('http://localhost:8000/api/employer/me/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'rec_campaign',
        onboarding: { verification_completed: true },
      }),
    })
  })
  await page.route(/http:\/\/localhost:8000\/api\/employer\/campaigns\/(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          public_id: 'camp_q3', name: 'Tuyển dụng Quý 3/2026', status: 'draft',
          job_count: 0, application_count: 0, accepted_count: 0,
        }),
      })
      return
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        results: [{
          public_id: 'camp_frontend', name: 'Tuyển Frontend', status: 'active',
          job_count: 1, application_count: 2, accepted_count: 1, headcount_target: 2,
          campaign_job: {
            public_id: 'jb_frontend', title: 'Kỹ sư Frontend', status: 'active',
            deadline: '2026-08-31', application_count: 2, view_count: 18,
          },
        }],
      }),
    })
  })
  await page.route(/http:\/\/localhost:8000\/api\/employer\/campaigns\/suggestions\/(?:\?.*)?$/, async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' })
  })

  await page.goto('/tuyendung/app/campaigns')
  await expect(page.getByText('Tất cả chiến dịch', { exact: true })).toBeVisible()
  await expect(page.getByText('Tìm thấy 1 chiến dịch tuyển dụng')).toBeVisible()
  await expect(page.getByText('CV từ hệ thống', { exact: true }).filter({ visible: true })).toBeVisible()
  await expect(page.getByText('Lọc CV', { exact: true }).filter({ visible: true })).toBeVisible()
  await expect(page.getByText('Tiến độ tuyển', { exact: true })).toHaveCount(0)
  await expect(page.getByText('#camp_frontend').filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tuyển Frontend' }).filter({ visible: true })).toHaveAttribute('href', '/tuyendung/app/campaigns/camp_frontend')
  await expect(page.getByRole('link', { name: 'Kỹ sư Frontend' }).filter({ visible: true })).toHaveAttribute('href', '/tuyendung/app/jobs/jb_frontend')
  await expectNoHorizontalOverflow(page)
  await page.getByRole('button', { name: /Thêm chiến dịch mới/ }).click()
  await page.getByLabel('Tên chiến dịch tuyển dụng').fill('Tuyển dụng Quý 3/2026')
  await page.getByRole('button', { name: 'Tiếp tục' }).click()

  const activityDialog = page.getByRole('dialog', { name: 'Khởi động chiến dịch: Tuyển dụng Quý 3/2026' })
  await expect(activityDialog.getByText('Đăng tin tuyển dụng')).toBeVisible()
  await expect(activityDialog.getByText('Xem workspace chiến dịch')).toBeVisible()
  await activityDialog.getByRole('button', { name: 'Đăng tin' }).click()
  await expect(page).toHaveURL(/\/tuyendung\/app\/jobs\/new\?campaign=camp_q3$/)
})

test('employer campaign detail: TopCV-style workspace is responsive and uses API data', async ({ page }) => {
  await mockPublicApi(page)
  await setEmployerSession(page, {
    email_verified: true,
    employer_onboarding_required: false,
    employer_onboarding_step: 'complete',
    employer_verification_completed: true,
  })
  await page.route('http://localhost:8000/api/employer/me/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'rec_campaign',
        onboarding: { verification_completed: true },
      }),
    })
  })
  await page.route('http://localhost:8000/api/employer/campaigns/camp_frontend/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'camp_frontend', name: 'Tuyển Frontend', status: 'active',
        job_count: 1, application_count: 2,
      }),
    })
  })
  await page.route('http://localhost:8000/api/employer/campaigns/camp_frontend/report/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        applications: { total: 2, new: 1 },
        jobs: { total: 1, active: 1 },
        headcount_target: 2,
        funnel: { submitted: 1, considering: 1 },
        daily_applications: [
          { date: '2026-07-16', count: 0 },
          { date: '2026-07-17', count: 1 },
          { date: '2026-07-18', count: 0 },
          { date: '2026-07-19', count: 0 },
          { date: '2026-07-20', count: 1 },
          { date: '2026-07-21', count: 0 },
          { date: '2026-07-22', count: 0 },
        ],
      }),
    })
  })
  let performanceDays = 7
  await page.route(/http:\/\/localhost:8000\/api\/employer\/campaigns\/camp_frontend\/job-performance\/(?:\?.*)?$/, async (route) => {
    const days = Number(new URL(route.request().url()).searchParams.get('days') || 7)
    performanceDays = days
    const daily = Array.from({ length: days }, (_, index) => ({
      date: new Date(Date.UTC(2026, 6, 22 - (days - 1 - index))).toISOString().slice(0, 10),
      available: true,
      impressions: index === days - 1 ? 120 : 0,
      views: index === days - 1 ? 40 : 0,
      applications: index === days - 1 ? 3 : 0,
    }))
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        campaign_public_id: 'camp_frontend',
        range: { days, start: daily[0].date, end: daily[daily.length - 1].date },
        data_available_from: daily[0].date,
        summary: { impressions: 120, views: 40, applications: 3, view_rate: 33.33, application_rate: 7.5 },
        daily,
        jobs: [{
          public_id: 'jb_frontend', slug: 'ky-su-frontend', title: 'Kỹ sư Frontend', status: 'active',
          deadline: '2026-08-31', is_expired: false, available: true,
          data_available_from: daily[0].date, impressions: 120, views: 40, applications: 3,
          view_rate: 33.33, application_rate: 7.5,
        }],
      }),
    })
  })
  await page.route(/http:\/\/localhost:8000\/api\/v2\/recruiter\/applications\/(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        results: [{
          public_id: 'app_frontend', candidate_name: 'Trần Minh', candidate_email: 'minh@example.com',
          job_title: 'Kỹ sư Frontend', submitted_cv_title: 'CV Frontend 2026', status: 'submitted',
          applied_at: '2026-07-22T09:00:00+07:00',
        }],
      }),
    })
  })
  await page.route(/http:\/\/localhost:8000\/api\/jobs\/mine\/(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        results: [{
          public_id: 'jb_frontend', title: 'Kỹ sư Frontend', status: 'active',
          application_count: 2, view_count: 18, deadline: '2026-08-31',
        }],
      }),
    })
  })

  await page.goto('/tuyendung/app/campaigns/camp_frontend?active_tab=apply_cv')

  await expect(page.getByRole('heading', { name: 'Tuyển Frontend' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Quay lại/ })).toBeVisible()
  await expect(page.getByText('Tổng lượng CV ứng viên')).toBeVisible()
  await expect(page.getByText('CV đã kết nối')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'CV ứng tuyển' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByPlaceholder('Tìm ứng viên...')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Xuất danh sách CV' })).toBeEnabled()
  await expect(page.getByText('Trần Minh')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Xử lý' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Chi tiết' })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.getByRole('tab', { name: 'Tin tuyển dụng' }).click()
  await expect(page).toHaveURL(/active_tab=job/)
  await expect(page.getByText('Báo cáo Tin tuyển dụng:')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Biểu đồ lượt hiển thị, lượt xem và lượt ứng tuyển' })).toBeVisible()
  await page.getByTestId('campaign-chart-hit-0').hover({ force: true })
  await expect(page.getByTestId('campaign-performance-tooltip')).toContainText('16/07/2026 00:00')
  await expect(page.getByTestId('campaign-performance-tooltip')).toContainText('Lượt hiển thị')
  await expect(page.getByTestId('campaign-performance-tooltip')).toContainText('Lượt xem')
  await expect(page.getByTestId('campaign-performance-tooltip')).toContainText('Lượt ứng tuyển')
  await expect(page.getByRole('link', { name: 'Kiểm tra CV' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Số lần hiển thị' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /Tỷ lệ ứng tuyển/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Xem tin Kỹ sư Frontend' })).toHaveAttribute('href', '/viec-lam/ky-su-frontend')
  await expect(page.getByRole('link', { name: 'Xem tin Kỹ sư Frontend' })).toHaveAttribute('target', '_blank')
  await expect(page.getByRole('link', { name: 'Chỉnh sửa Kỹ sư Frontend' })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.getByRole('combobox', { name: 'Khoảng thời gian báo cáo' }).click()
  await page.getByText('30 ngày qua', { exact: true }).last().click()
  await expect.poll(() => performanceDays).toBe(30)
  await expect(page.getByRole('img', { name: 'Biểu đồ lượt hiển thị, lượt xem và lượt ứng tuyển' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('employer company settings: recent catalogue and full create form are responsive', async ({ page }) => {
  await mockPublicApi(page)
  await setEmployerSession(page, {
    email_verified: true,
    employer_onboarding_required: false,
    employer_onboarding_step: 'complete',
  })
  await page.route('http://localhost:8000/api/employer/me/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'rec_company', company: null, company_role: 'member', membership_status: 'pending',
        onboarding: { phone_verified: true, company_linked: false },
      }),
    })
  })
  await page.route('http://localhost:8000/api/employer/industries/all/', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 1, name: 'IT - Phần mềm', slug: 'it-phan-mem' }]) })
  })
  await page.route('http://localhost:8000/api/employer/company/catalogs/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        business_types: [{ value: 'enterprise', label: 'Doanh nghiệp' }, { value: 'household', label: 'Hộ kinh doanh' }],
        company_sizes: [{ value: '25-99', label: '25 - 99 nhân viên' }],
        markets: [{ value: 'domestic', label: 'Nội địa' }],
        target_customers: [{ value: 'b2b', label: 'B2B' }],
      }),
    })
  })
  await page.route(/http:\/\/localhost:8000\/api\/employer\/company\/search\/.*/, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        count: 1, next: null, previous: null,
        results: [{
          public_id: 'co_recent', company_name: 'Công ty mới nhất', trade_name: 'Recent Co',
          tax_code: '0101234567', address: 'Hà Nội', company_size: '25-99', logo_url: '',
          industries_detail: [{ id: 1, name: 'IT - Phần mềm' }], verification_status: 'unverified',
        }],
      }),
    })
  })

  await page.goto('/tuyendung/app/account/settings/company')

  await expect(page.getByText('Lưu ý!')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Công ty mới tạo' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Công ty mới nhất' })).toBeVisible()
  await expect(page.getByText('25-99 nhân viên')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Chọn' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.getByRole('tab', { name: /Tạo công ty mới/ }).click()
  await expect(page.getByRole('button', { name: 'Chọn logo' })).toBeVisible()
  await expect(page.getByLabel('Mã số thuế')).toBeVisible()
  await expect(page.getByText('Năm thành lập')).toHaveCount(0)
  await expect(page.getByRole('toolbar', { name: 'Công cụ định dạng văn bản' })).toHaveCount(2)
  await expect(page.getByRole('button', { name: /Lưu và liên kết công ty/ })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.locator('label.ant-radio-button-wrapper').filter({ hasText: 'Hộ kinh doanh' }).click()
  await expect(page.getByLabel(/Mã số thuế người đại diện/)).toBeVisible()
  await expect(page.getByLabel(/Tên hộ kinh doanh/)).toBeVisible()
  await expectNoHorizontalOverflow(page)
})
