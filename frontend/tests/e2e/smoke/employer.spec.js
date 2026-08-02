import { expect, test } from '@playwright/test'
import { expectAnimatedLoginButton, mockPublicApi } from './helpers'

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
  await expectAnimatedLoginButton(page)
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
  await page.route('http://localhost:8000/api/auth/refresh/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ access: 'e2e-access' }),
    })
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
  const [authorizationInput, identityInput] = await page.locator('input[type="file"]').all()
  await expect(authorizationInput).not.toHaveAttribute('multiple', '')
  await expect(identityInput).toHaveAttribute('multiple', '')
  await identityInput.setInputFiles([
    {
      name: 'cccd-mat-truoc.png',
      mimeType: 'image/png',
      buffer: Buffer.from('identity-front'),
    },
    {
      name: 'cccd-mat-sau.png',
      mimeType: 'image/png',
      buffer: Buffer.from('identity-back'),
    },
  ])
  await expect(page.getByRole('button', { name: 'Xem trước tệp cccd-mat-truoc.png' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Xem trước tệp cccd-mat-sau.png' })).toBeVisible()
  await page.getByRole('button', { name: 'Xem trước tệp cccd-mat-truoc.png' }).click()
  await expect(page.getByRole('dialog')).toContainText('cccd-mat-truoc.png')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Lưu' })).toBeDisabled()
  await expectNoHorizontalOverflow(page)

  await page.goto('/tuyendung/app/account/settings/personal-data-protection')
  await expect(page.getByRole('heading', { name: /giữa Ứng viên - Nhà tuyển dụng/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Tải mẫu văn bản/ })).toHaveAttribute('href', '/documents/topcv-mau-van-ban-thong-bao-dong-y-xu-ly-dlcn.docx')
  const dpaFileInput = page.locator('input[type="file"]')
  await dpaFileInput.setInputFiles({
    name: 'thoa-thuan.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-candidate-agreement'),
  })
  await page.getByRole('button', { name: 'Xem trước tệp thoa-thuan.pdf' }).click()
  await expect(page.getByRole('dialog')).toContainText('thoa-thuan.pdf')
  await page.keyboard.press('Escape')
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

test('employer company settings: document revision request shows reason and replacement action', async ({ page }) => {
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
        public_id: 'rec_revision',
        company_role: 'owner',
        onboarding: { company_linked: true, verification_completed: true },
        company: {
          public_id: 'co_revision',
          company_name: 'FPT Software',
          trade_name: 'FPT Software',
          trade_name_same_as_registered: true,
          tax_code: '0101234567',
          verification_status: 'verified',
          industries_detail: [{ id: 1, name: 'IT - Phần mềm', is_primary: true }],
          images: [],
        },
      }),
    })
  })
  await page.route('http://localhost:8000/api/employer/industries/all/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1, name: 'IT - Phần mềm' }]),
    })
  })
  await page.route('http://localhost:8000/api/employer/company/catalogs/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        business_types: [{ value: 'enterprise', label: 'Doanh nghiệp' }],
        company_sizes: [], markets: [], target_customers: [],
      }),
    })
  })
  await page.route('http://localhost:8000/api/employer/company/documents/', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' })
  })
  await page.route('http://localhost:8000/api/employer/company/update-requests/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{
        public_id: 'cur_revision',
        status: 'pending',
        proof_type: 'business_registration',
        reason: 'Đổi tên theo đăng ký mới',
        changes: { company_name: 'FPT Software 2' },
        updated_at: '2026-07-27T00:00:00Z',
        documents: [{
          id: 12,
          public_id: 'doc_revision',
          doc_type: 'business_registration',
          doc_type_label: 'Giấy đăng ký doanh nghiệp',
          is_current: true,
          status: 'changes_requested',
          status_label: 'Cần bổ sung',
          review_note: 'Ảnh bị mờ, vui lòng tải bản rõ đủ bốn góc.',
        }],
      }]),
    })
  })

  await page.goto('/tuyendung/app/account/settings/company?update=true')

  await expect(page.getByText('Quản trị viên yêu cầu bổ sung giấy tờ')).toBeVisible()
  await expect(page.getByText('Ảnh bị mờ, vui lòng tải bản rõ đủ bốn góc.')).toBeVisible()
  await page.getByRole('button', { name: 'Bổ sung giấy tờ ngay' }).click()
  await expect(page.getByText('Yêu cầu này cần bổ sung giấy tờ')).toBeVisible()
  await page.getByRole('button', { name: 'Chọn giấy tờ thay thế' }).click()
  const dialog = page.getByRole('dialog', { name: 'Xác nhận thay đổi thông tin pháp lý' })
  await expect(dialog.getByText('Giấy tờ trước chưa đạt yêu cầu')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Chọn giấy đăng ký doanh nghiệp' })).toBeVisible()
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
  await expect(page.getByLabel('Các bước xác thực').getByRole('link')).toHaveCount(5)
  await expect(page.getByLabel('Đăng tin tuyển dụng đầu tiên')).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('employer workspace: an incomplete account cannot access recruitment operations', async ({ page }) => {
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

  await page.goto('/tuyendung/app/campaigns')

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
  await page.route('http://localhost:8000/api/jobs/mine/job_draft/', async (route) => {
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
  await page.getByRole('combobox', { name: 'Cách hiển thị thu nhập' }).click()
  await page.locator('.ant-select-dropdown:visible').getByText('Thu nhập khi đạt 100% KPI', { exact: true }).click()
  await page.getByLabel('Đến mức').fill('7000000')
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
    salary_type: 'up_to',
    salary_min: null,
    salary_max: 7000000,
    income_display_type: 'income_at_kpi',
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
  await expect(page).toHaveURL(/\/tuyendung\/app\/jobs\/job_draft\/edit$/)
  await expect(page.getByLabel('Từ mức thu nhập')).toHaveValue('')
  await expect(page.getByLabel('Đến mức')).toHaveValue('7.000.000')
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

test('employer applications: grouped CV workspace is clear across responsive layouts', async ({ page }) => {
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
        public_id: 'rec_applications',
        onboarding: { verification_completed: true },
      }),
    })
  })
  const applications = [
    {
      public_id: 'app_befb3400ade3', candidate_name: 'Lê Văn Hậu',
      candidate_email: 'levanhaum@gmail.com', job: 'jb_987ecf21d547',
      job_title: 'Senior Frontend Developer', submitted_cv_title: 'CV Frontend 2026',
      submitted_cv_version: 'cvv_frontend_2', submitted_cv_source: 'builder',
      source: 'applied', status: 'submitted', employer_note: 'React tốt', employer_rating: 4,
      cover_letter: 'Tôi mong muốn đồng hành cùng đội ngũ sản phẩm.',
      applied_at: '2026-08-02T09:20:00+07:00',
    },
    {
      public_id: 'app_previous', candidate_name: 'Lê Văn Hậu',
      candidate_email: 'LEVANHAUM@gmail.com', job: 'jb_987ecf21d547',
      job_title: 'Senior Frontend Developer', submitted_cv_title: 'CV Frontend bản đầu',
      submitted_cv_version: 'cvv_frontend_1', submitted_cv_source: 'upload',
      source: 'applied', status: 'considering', employer_note: '', employer_rating: null,
      applied_at: '2026-07-28T08:00:00+07:00',
    },
  ]
  await page.route(/http:\/\/localhost:8000\/api\/v2\/recruiter\/applications\/(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ count: 2, next: null, previous: null, results: applications }),
    })
  })
  await page.route('http://localhost:8000/api/v2/recruiter/applications/app_befb3400ade3/cv/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        application_public_id: 'app_befb3400ade3', job_public_id: 'jb_987ecf21d547',
        status: 'viewed', submitted_at: '2026-08-02T09:20:00+07:00',
        submitted_cv_title: 'CV Frontend 2026', submitted_cv_source: 'builder',
        preferred_location_names: ['Đà Nẵng', 'Làm việc từ xa'], allow_ai_analysis: true,
        contact_name: 'Lê Văn Hậu', contact_email: 'levanhaum@gmail.com', contact_phone: '0905123456',
        cv: {
          public_id: 'cvv_frontend_2', version_number: 2, schema_version: 1,
          template_renderer_key: 'classic_single_column_v1', template_renderer_version: '1',
          content_json: {
            personal_info: {
              full_name: 'Lê Văn Hậu', headline: 'Senior Frontend Developer',
              email: 'levanhaum@gmail.com', phone: '0905123456', address: 'Đà Nẵng',
            },
            sections: [{
              instance_id: 'summary_1', section_key: 'summary', title: 'Tóm tắt chuyên môn',
              enabled: true, items: [{ item_id: 'summary_item_1', value: '6 năm xây dựng sản phẩm React.' }],
            }],
          },
          layout_json: { regions: [{ id: 'main', width_percent: 100, section_instance_ids: ['summary_1'] }] },
          style_json: { theme_color: '#059669', font_family: 'Roboto', font_scale: 1, line_height: 1.4 },
          assets: [],
        },
      }),
    })
  })
  await page.route('http://localhost:8000/api/v2/recruiter/applications/app_befb3400ade3/history/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        { from_status: '', to_status: 'submitted', note: '', changed_by_name: '', created_at: '2026-08-02T09:20:00+07:00' },
        { from_status: 'submitted', to_status: 'viewed', note: '', changed_by_name: 'HR Team', created_at: '2026-08-02T09:30:00+07:00' },
      ]),
    })
  })

  await page.goto('/tuyendung/app/applications?job=jb_987ecf21d547&q=levanhaum%40gmail.com&application=app_befb3400ade3')

  const candidateList = page.getByTestId('application-candidate-list')
  const cvPreview = page.getByTestId('application-cv-preview')
  const inspector = page.getByTestId('application-inspector')
  const backToJobButton = page.getByRole('button', { name: 'Quay lại chi tiết tin tuyển dụng' })
  await expect(backToJobButton).toBeVisible()
  await expect(candidateList).toBeVisible()
  await expect(page.getByRole('button', { name: 'Thu gọn hồ sơ của Lê Văn Hậu' })).toBeVisible()
  await expect(candidateList.getByText('2 CV', { exact: true })).toBeVisible()
  await expect(candidateList.getByRole('button', { name: 'Xem CV Frontend 2026 của Lê Văn Hậu' })).toBeVisible()
  await expect(candidateList.getByRole('button', { name: 'Xem CV Frontend bản đầu của Lê Văn Hậu' })).toBeVisible()
  await expect(cvPreview.getByLabel('Xem trước CV classic_single_column_v1 trang 1')).toBeVisible()
  const viewportWidth = page.viewportSize().width
  if (viewportWidth < 768) {
    await expect(inspector).toBeHidden()
    await page.getByRole('tab', { name: 'Thông tin liên quan' }).click()
    await expect(inspector).toBeVisible()
    await expect(cvPreview).toBeHidden()
  }
  await expect(inspector.getByText('levanhaum@gmail.com', { exact: true }).first()).toBeVisible()
  await expect(inspector.getByText('Đà Nẵng, Làm việc từ xa')).toBeVisible()
  await expect(inspector.getByText('Đã xem', { exact: true })).toBeVisible()

  if (viewportWidth >= 1280) {
    const [listBox, previewBox, inspectorBox] = await Promise.all([
      candidateList.boundingBox(), cvPreview.boundingBox(), inspector.boundingBox(),
    ])
    expect(listBox.x).toBeLessThan(previewBox.x)
    expect(previewBox.x).toBeLessThan(inspectorBox.x)
    expect(Math.abs(listBox.y - previewBox.y)).toBeLessThanOrEqual(2)
    expect(Math.abs(previewBox.y - inspectorBox.y)).toBeLessThanOrEqual(2)
  } else if (viewportWidth >= 768) {
    const [listBox, previewBox, inspectorBox] = await Promise.all([
      candidateList.boundingBox(), cvPreview.boundingBox(), inspector.boundingBox(),
    ])
    expect(listBox.x).toBeLessThan(previewBox.x)
    expect(inspectorBox.y).toBeGreaterThan(previewBox.y)
  }
  await expectNoHorizontalOverflow(page)
  await backToJobButton.click()
  await expect(page).toHaveURL('/tuyendung/app/jobs/jb_987ecf21d547')
})

test('employer campaigns: operational list shows compact campaign controls', async ({ page }) => {
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
          public_id: 'camp_q3', name: 'Tuyển dụng Quý 3/2026', status: 'active',
          job_count: 0, candidate_count: 0, application_submission_count: 0,
          accepted_count: 0,
        }),
      })
      return
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        count: 1,
        next: null,
        previous: null,
        results: [{
          public_id: 'camp_frontend', name: 'Tuyển Frontend', status: 'active',
          job_count: 1, active_job_count: 1, candidate_count: 1,
          candidate_previews: [{
            public_id: 'candidate_frontend', full_name: 'Nguyễn Minh Anh', avatar_url: '',
          }],
          application_submission_count: 2, application_pair_count: 2, unviewed_count: 1,
          accepted_count: 1,
          last_activity: {
            event_type: 'application_received',
            label: 'Nhận CV ứng tuyển',
            occurred_at: '2026-07-22T09:00:00+07:00',
          },
        }],
      }),
    })
  })
  await page.route(/http:\/\/localhost:8000\/api\/employer\/campaigns\/suggestions\/(?:\?.*)?$/, async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' })
  })

  await page.goto('/tuyendung/app/campaigns')
  await expect(page.getByRole('combobox', { name: 'Lọc trạng thái chiến dịch' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Lọc nhu cầu xử lý' })).toBeVisible()
  await expect(page.getByText('Tìm thấy').filter({ visible: true })).toContainText('1')
  await expect(page.getByText('#camp_frontend').filter({ visible: true })).toBeVisible()
  await expect(page.getByTitle('Nguyễn Minh Anh').filter({ visible: true })).toBeVisible()
  await expect(page.getByText('Nhận CV ứng tuyển').filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tuyển Frontend' }).filter({ visible: true })).toHaveAttribute('href', '/tuyendung/app/campaigns/camp_frontend')
  await expect(page.getByText('Xem báo cáo', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: 'Thao tác' })).toHaveCount(0)
  await expect(page.getByRole('switch', {
    name: 'Dừng chiến dịch Tuyển Frontend',
  }).filter({ visible: true })).toBeChecked()
  const editCampaignAction = page.getByRole('button', { name: 'Sửa chiến dịch' }).filter({ visible: true })
  if (page.viewportSize().width >= 1024) {
    const actionReveal = editCampaignAction.locator('..').locator('..')
    await expect(actionReveal).toHaveCSS('opacity', '0')
    await page.locator('tr').filter({ hasText: 'Tuyển Frontend' }).hover()
    await expect(actionReveal).toHaveCSS('opacity', '1')
  }
  await expect(editCampaignAction).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.getByRole('button', { name: /Thêm chiến dịch mới/ }).click()
  await page.getByLabel('Tên chiến dịch tuyển dụng').fill('Tuyển dụng Quý 3/2026')
  await page.getByRole('button', { name: 'Tạo chiến dịch' }).click()

  const activityDialog = page.getByRole('dialog', { name: 'Khởi động chiến dịch: Tuyển dụng Quý 3/2026' })
  await expect(activityDialog.getByRole('button', { name: 'Xem chiến dịch' })).toBeVisible()
  await activityDialog.getByRole('button', { name: 'Đăng tin tuyển dụng' }).click()
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
        created_at: '2026-07-01T08:00:00+07:00',
        updated_at: '2026-07-20T10:00:00+07:00',
        job_count: 1, candidate_count: 1, application_submission_count: 2,
        application_pair_count: 1,
        unviewed_count: 1, accepted_count: 1,
        last_activity: {
          event_type: 'application_received',
          label: 'Nhận CV ứng tuyển',
          occurred_at: '2026-07-22T09:00:00+07:00',
        },
      }),
    })
  })
  await page.route('http://localhost:8000/api/employer/campaigns/camp_frontend/report/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        candidate_count: 1,
        application_submission_count: 2,
        application_pair_count: 1,
        unviewed_count: 1,
        unanswered_count: 1,
        accepted_count: 1,
        applications: { total: 2, new: 1 },
        jobs: { total: 1, active: 1 },
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
        count: 1,
        next: null,
        previous: null,
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
  await page.route(/http:\/\/localhost:8000\/api\/employer\/campaigns\/camp_frontend\/activities\/(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        count: 2,
        next: null,
        previous: null,
        results: [
          {
            id: 2,
            group: 'application',
            group_label: 'Ứng viên',
            event_type: 'application_received',
            event_label: 'Nhận CV ứng tuyển',
            actor_name: null,
            subject_public_id: 'app_frontend',
            metadata: { candidate_name: 'Trần Minh', job_title: 'Kỹ sư Frontend' },
            occurred_at: '2026-07-22T09:00:00+07:00',
          },
          {
            id: 1,
            group: 'job',
            group_label: 'Tin tuyển dụng',
            event_type: 'job_status_changed',
            event_label: 'Đổi trạng thái tin',
            actor_name: 'Nhà tuyển dụng',
            subject_public_id: 'jb_frontend',
            metadata: { title: 'Kỹ sư Frontend', from_status: 'pending', to_status: 'active' },
            occurred_at: '2026-07-21T16:30:00+07:00',
          },
        ],
      }),
    })
  })

  const compactCampaignTabs = page.viewportSize().width < 640
  const chooseCampaignTab = async (label) => {
    if (compactCampaignTabs) {
      await page.getByRole('combobox', { name: 'Chọn nội dung chiến dịch' }).click()
      await page.locator('.ant-select-dropdown:visible').getByText(label, { exact: false }).click()
      return
    }
    await page.getByRole('tab', { name: label }).click()
  }

  await page.goto('/tuyendung/app/campaigns/camp_frontend')

  await expect(page.getByRole('main').getByRole('heading', { name: 'Tuyển Frontend' })).toBeVisible()
  await expect(page.getByTestId('campaign-hero')).toContainText('camp_frontend')
  await expect(page.getByRole('button', { name: 'Sửa chiến dịch' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Đăng thêm tin' })).toHaveAttribute('href', '/tuyendung/app/jobs/new?campaign=camp_frontend')
  await expect(page.getByText('Ứng viên duy nhất', { exact: true })).toBeVisible()
  await expect(page.getByText('Hồ sơ mới / chưa xem')).toBeVisible()
  await expect(page.getByText('Phân bổ trạng thái hồ sơ')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Biểu đồ lượt hiển thị, lượt xem và lượt ứng tuyển' })).toBeVisible()
  if (compactCampaignTabs) {
    await expect(page.getByRole('combobox', { name: 'Chọn nội dung chiến dịch' })).toBeVisible()
  } else {
    await expect(page.getByRole('tab', { name: 'Tổng quan' })).toHaveAttribute('aria-selected', 'true')
  }
  await expectNoHorizontalOverflow(page)

  await chooseCampaignTab('CV ứng tuyển')
  await expect(page).toHaveURL(/active_tab=apply_cv/)
  await expect(page.getByPlaceholder('Tìm ứng viên, CV hoặc tin...')).toBeVisible()
  await expect(page.getByText('Tìm thấy 1 hồ sơ ứng tuyển')).toBeVisible()
  await expect(page.getByText('Hồ sơ chưa xem 1')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Xuất danh sách CV' })).toBeEnabled()
  await expect(page.getByText('Trần Minh')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Xử lý' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Chi tiết' })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await chooseCampaignTab('Tin tuyển dụng')
  await expect(page).toHaveURL(/active_tab=job/)
  await expect(page.getByText('Báo cáo Tin tuyển dụng:')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Biểu đồ lượt hiển thị, lượt xem và lượt ứng tuyển' })).toBeVisible()
  if (compactCampaignTabs) {
    await page.getByTestId('campaign-chart-hit-0').click({ force: true })
  } else {
    await page.getByTestId('campaign-chart-hit-0').hover({ force: true })
  }
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

  await chooseCampaignTab('Lịch sử hoạt động')
  await expect(page).toHaveURL(/active_tab=activity/)
  await expect(page.getByRole('heading', { name: 'Lịch sử hoạt động' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Lọc nhóm hoạt động' })).toBeVisible()
  await expect(
    page.getByTestId('activity-day-2026-07-22').getByText('Nhận CV ứng tuyển', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByTestId('activity-day-2026-07-22').getByText('Hệ thống', { exact: true }),
  ).toBeVisible()
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
  await expect(page.getByRole('link', { name: /Tra cứu.*thuế/i })).toHaveCount(0)
  await expect(page.getByText('Năm thành lập')).toHaveCount(0)
  await expect(page.getByRole('toolbar', { name: 'Công cụ định dạng văn bản' })).toHaveCount(2)
  await expect(page.getByRole('button', { name: /Lưu và liên kết công ty/ })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.locator('label.ant-radio-button-wrapper').filter({ hasText: 'Hộ kinh doanh' }).click()
  await expect(page.getByLabel(/Mã số thuế người đại diện/)).toBeVisible()
  await expect(page.getByLabel(/Tên hộ kinh doanh/)).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('employer company settings: pending values remain editable without creating another request', async ({ page }) => {
  await mockPublicApi(page)
  await setEmployerSession(page, {
    email_verified: true,
    employer_onboarding_required: false,
    employer_onboarding_step: 'complete',
  })
  const company = {
    public_id: 'co_pending',
    company_name: 'FE Credit',
    trade_name: 'FE Credit',
    trade_name_same_as_registered: true,
    tax_code: '0101234567',
    business_type: 'enterprise',
    logo_url: '',
    has_no_logo: true,
    website_url: 'https://fecredit.vn/',
    has_no_website: false,
    email: 'hr@fecredit.vn',
    phone: '0912345678',
    address: 'TP.HCM',
    company_size: '25-99',
    description: '<p>Giới thiệu công ty</p>',
    employee_benefits: '',
    markets: ['domestic'],
    target_customers: ['b2b'],
    industries_detail: [{ id: 1, name: 'Tài chính', is_primary: true }],
    primary_industry_id: 1,
    images: [],
    verification_status: 'verified',
  }
  await page.route('http://localhost:8000/api/employer/me/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'rec_pending',
        company,
        company_role: 'owner',
        onboarding: { company_linked: true },
      }),
    })
  })
  await page.route('http://localhost:8000/api/employer/industries/all/', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 1, name: 'Tài chính', slug: 'tai-chinh' }]) })
  })
  await page.route('http://localhost:8000/api/employer/company/catalogs/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        business_types: [{ value: 'enterprise', label: 'Doanh nghiệp' }],
        company_sizes: [{ value: '25-99', label: '25 - 99 nhân viên' }],
        markets: [{ value: 'domestic', label: 'Nội địa' }],
        target_customers: [{ value: 'b2b', label: 'B2B' }],
      }),
    })
  })
  await page.route('http://localhost:8000/api/employer/company/update-requests/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          public_id: 'cur_pending',
          status: 'pending',
          changes: {
            website_url: 'https://fecredit.vn/abc',
            gallery_additions: ['employers/co_pending/gallerys/office.png'],
          },
          media_previews: {
            gallery_additions: ['http://localhost:8000/media/employers/co_pending/gallerys/office.png'],
          },
          revision: 1,
          lock_version: 0,
          documents: [],
          created_at: '2026-07-25T10:00:00Z',
          updated_at: '2026-07-26T10:00:00Z',
        },
        {
          public_id: 'cur_rejected',
          status: 'rejected',
          changes: { trade_name: 'Tên cũ đã bị từ chối' },
          review_note: 'Lý do từ chối của yêu cầu trước.',
          created_at: '2026-07-24T10:00:00Z',
          updated_at: '2026-07-24T11:00:00Z',
        },
      ]),
    })
  })
  await page.route('http://localhost:8000/api/employer/company/documents/', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' })
  })

  await page.goto('/tuyendung/app/account/settings/company')
  await expect(page.getByText('Đang xử lý', { exact: true })).toBeVisible()
  await expect(page.getByText('Bị từ chối', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Lý do từ chối của yêu cầu trước.')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Chỉnh sửa yêu cầu' })).toBeEnabled()
  await page.getByRole('button', { name: 'Chỉnh sửa yêu cầu' }).click()

  await expect(page.getByRole('textbox', { name: /^Website/ })).toHaveValue('https://fecredit.vn/abc')
  await expect(page.getByRole('img', { name: 'Ảnh công ty đang chờ duyệt 1' })).toHaveAttribute(
    'src',
    'http://localhost:8000/media/employers/co_pending/gallerys/office.png',
  )
  await expect(page.getByText('Chờ duyệt')).toBeVisible()
  await page.getByLabel('Tên công ty').fill('FE Credit mới')
  await page.getByRole('button', { name: 'Gửi yêu cầu cập nhật' }).click()
  await expect(page.getByRole('dialog', { name: 'Xác nhận thay đổi thông tin pháp lý' })).toBeVisible()
  await expect(page.getByLabel('Lý do thay đổi')).toBeVisible()
  await expect(page.getByText('Giấy đăng ký doanh nghiệp hoặc giấy tờ tương đương')).toBeVisible()
  await expectNoHorizontalOverflow(page)
})
