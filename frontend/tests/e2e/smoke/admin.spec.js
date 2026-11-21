import { expect, test } from '@playwright/test'
import { ADMIN_ROUTES } from '../../../src/app/router/admin/admin-routes.config.js'
import { API_ROUTE, expectAnimatedLoginButton, mockPublicApi } from './helpers'

test('admin smoke: login loads and dashboard stays role-protected', { tag: '@responsive' }, async ({ page }) => {
  // One full navigation per admin route (23 and growing): the budget has to
  // scale with the route table instead of sharing a single 30s test timeout.
  test.slow()
  await mockPublicApi(page)
  await page.goto('/admin/app/login')
  await expect(page.getByRole('heading', { name: 'Đăng nhập quản trị' })).toBeVisible()
  await expectAnimatedLoginButton(page)
  await expect(page.getByText(/quên mật khẩu\? liên hệ kỹ thuật/i)).toBeVisible()
  await expect(page.getByRole('link', { name: /quên mật khẩu/i })).toHaveCount(0)
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )

  for (const route of ADMIN_ROUTES) {
    await page.goto(`/admin/app${route.segment}`)
    await expect(page).toHaveURL(/\/admin\/app\/login\?returnUrl=/)
  }
})

test('admin account management: filters, table actions and quick detail are responsive', { tag: '@responsive' }, async ({ page }, testInfo) => {
  const pageErrors = []
  let verificationQueueStatus = null
  const isMobile = testInfo.project.name === 'mobile-chromium'
  const usesNavigationDrawer = page.viewportSize().width < 1024
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const adminUser = {
    public_id: 'usr_root',
    email: 'root@example.com',
    full_name: 'System Admin',
    role: 'admin',
    status: 'active',
    admin_access: { is_superuser: true },
  }
  const candidate = {
    public_id: 'usr_candidate',
    email: 'candidate@example.com',
    full_name: 'Nguyễn Minh Anh',
    phone: '0901234567',
    avatar_url: '',
    role: 'candidate',
    status: 'active',
    email_verified: true,
    has_usable_password: true,
    active_session_count: 1,
    last_activity_at: '2026-07-25T08:00:00Z',
    last_login: '2026-07-25T08:00:00Z',
    date_joined: '2026-07-01T08:00:00Z',
    updated_at: '2026-07-25T08:00:00Z',
    context: { kind: 'candidate', current_position: 'Frontend Developer' },
    admin_access: null,
    invitation: null,
  }
  await page.route(API_ROUTE, async (route) => {
    const requestUrl = new URL(route.request().url())
    const path = requestUrl.pathname
    const body = path === '/api/auth/refresh/'
      ? { access: 'e2e-access' }
      : path === '/api/auth/me/'
        ? adminUser
      : path === '/api/admin/accounts/summary/'
        ? requestUrl.searchParams.get('scope') === 'recruiters'
          ? {
              scope: 'recruiters',
              totals: { total: 1, active: 1, restricted: 0, unverified: 0 },
              linked_company: 1,
              companyless: 0,
              onboarding_incomplete: 0,
              verification: {
                approved: 0,
                pending: 2,
                overdue: 1,
                changes_requested: 0,
              },
            }
          : {
              scope: 'users',
              totals: { total: 1, active: 1, restricted: 0, unverified: 0 },
              by_role: {
                candidate: { total: 1, active: 1, restricted: 0, unverified: 0 },
                admin: { total: 0, active: 0, restricted: 0, unverified: 0 },
              },
              queues: { pending_admin_invitations: 0 },
            }
        : path === '/api/admin/accounts/'
          ? { count: 1, next: null, previous: null, results: [candidate] }
          : path === '/api/admin/employer-verifications/'
            ? (() => {
                verificationQueueStatus = requestUrl.searchParams.get('status')
                return {
                  count: 2,
                  next: null,
                  previous: null,
                  results: [
                    {
                      public_id: 'evc_pending',
                      user_public_id: 'usr_pending',
                      full_name: 'NTD chờ duyệt',
                      email: 'pending@example.com',
                      company: { name: 'Công ty Pending', tax_code: '0101234567' },
                      status: 'pending',
                      pending_document_count: 1,
                      missing_steps: ['business_documents_approved'],
                      phone_verified: true,
                      submitted_at: '2026-07-28T08:00:00Z',
                    },
                    {
                      public_id: 'evc_review',
                      user_public_id: 'usr_review',
                      full_name: 'NTD đang xử lý',
                      email: 'review@example.com',
                      company: { name: 'Công ty Review', tax_code: '0107654321' },
                      status: 'in_review',
                      pending_document_count: 0,
                      missing_steps: [],
                      phone_verified: true,
                      submitted_at: '2026-07-28T09:00:00Z',
                    },
                  ],
                }
              })()
          : path === '/api/admin/company-domain-claims/'
            ? {
                count: 1,
                next: null,
                previous: null,
                results: [{
                  public_id: 'dmc_manual',
                  domain: 'company.vn',
                  company: 'cmp_test',
                  company_name: 'Công ty Domain',
                  requested_by: 'usr_pending',
                  requested_by_email: 'hr@company.vn',
                  method: 'admin_manual',
                  status: 'pending',
                  manual_review_requested_at: '2026-07-28T10:00:00Z',
                  lock_version: 2,
                  revision: 2,
                }],
              }
          : path === '/api/public/privacy/consent/'
            ? { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
            : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/admin/app/accounts')
  await expect(page).toHaveURL('/admin/app/accounts')
  await expect.poll(() => pageErrors).toEqual([])
  if (usesNavigationDrawer) {
    await page.getByRole('button', { name: 'Mở điều hướng' }).click()
  }
  const adminNavigation = page.getByRole('navigation', { name: 'Điều hướng quản trị' })
  await expect(adminNavigation.getByRole('link', { name: 'Tổng quan' }))
    .toHaveAttribute('href', '/admin/app/dashboard')
  // Accordion: the current page's group opens and closes the queues.
  await expect(adminNavigation.getByRole('button', { name: 'Cần xử lý' }))
    .toHaveAttribute('aria-expanded', 'false')
  await expect(adminNavigation.getByRole('button', { name: 'Người dùng' }))
    .toHaveAttribute('aria-expanded', 'true')
  await expect(adminNavigation.getByText('Tài khoản cá nhân')).toHaveCount(0)
  if (usesNavigationDrawer) {
    await page.keyboard.press('Escape')
  }
  // The account workspace is one of the largest lazy chunks; leave headroom
  // when the full smoke suite compiles several portals in parallel.
  await expect(page.getByRole('region', { name: 'Tổng quan tài khoản' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByPlaceholder('Tìm theo tên, email hoặc mã tài khoản')).toBeVisible()
  await expect(page.getByText('Nguyễn Minh Anh')).toBeVisible()
  await expect(page.getByRole('tab', { name: /Chờ xác thực NTD/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Xem nhanh', exact: true }).click()
  const quickDrawer = page.getByLabel('Thông tin tài khoản')
  await expect(quickDrawer).toBeVisible()
  await expect(quickDrawer.getByText('Frontend Developer')).toBeVisible()
  const viewport = page.viewportSize()
  await expect.poll(async () => {
    const drawerBox = await quickDrawer.boundingBox()
    return Math.round(drawerBox.x + drawerBox.width)
  }).toBeLessThanOrEqual(viewport.width)
  await page.keyboard.press('Escape')
  await expect(quickDrawer).toBeHidden()

  await page.goto('/admin/app/recruiters?tab=verification')
  await expect(page.getByRole('heading', {
    name: 'Nhà tuyển dụng',
    exact: true,
  })).toBeVisible()
  const verificationTab = page.getByRole('tab', { name: /Chờ xác thực NTD/ })
  await expect(verificationTab).toContainText('2')
  await expect(verificationTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#admin-main').getByText('Cần xử lý', { exact: true })
    .filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hồ sơ xác thực nhà tuyển dụng' })).toBeVisible()
  await expect(page.getByText('NTD chờ duyệt')).toBeVisible()
  await expect(page.getByText('NTD đang xử lý')).toBeVisible()
  expect(verificationQueueStatus).toBe('actionable')
  await expect.poll(() => page.getByRole('tabpanel', { name: /Chờ xác thực NTD/ })
    .locator('.account-management-tab-content')
    .evaluate((element) => getComputedStyle(element).paddingTop)).toBe(isMobile ? '16px' : '24px')
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )

  await page.goto('/admin/app/recruiters?tab=domain-verification')
  const domainTab = page.getByRole('tab', { name: 'Xác minh domain' })
  await expect(domainTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('company.vn', { exact: true })).toBeVisible()
  await expect(page.getByText('Công ty Domain')).toBeVisible()
  await expect(page.getByRole('button', { name: /Duyệt thủ công/ })).toBeVisible()
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )
})

const RECRUITER_ROWS = [
  {
    public_id: 'usr_overdue',
    email: 'overdue@company.vn',
    full_name: 'Trần Quá Hạn',
    role: 'employer',
    status: 'active',
    email_verified: true,
    active_session_count: 1,
    last_activity_at: '2026-11-18T08:00:00Z',
    date_joined: '2026-10-01T08:00:00Z',
    context: {
      kind: 'employer',
      position_title: 'Trưởng phòng nhân sự',
      company_role_label: 'Quản lý công ty',
      phone_verified: true,
      company: { public_id: 'com_1', name: 'Công ty Cổ phần Ánh Dương', tax_code: '***5678' },
      verification: {
        public_id: 'evc_1', status: 'pending', status_label: 'Chờ duyệt',
        submitted_at: '2026-11-10T08:00:00Z', missing_step_count: 1,
      },
      next_action: { code: 'verification_overdue', company_update_public_id: null },
    },
  },
  {
    public_id: 'usr_waiting',
    email: 'waiting@company.vn',
    full_name: 'Lê Chờ Bổ Sung',
    role: 'employer',
    status: 'active',
    email_verified: true,
    active_session_count: 0,
    last_activity_at: null,
    date_joined: '2026-09-01T08:00:00Z',
    context: {
      kind: 'employer',
      company: null,
      verification: { public_id: null, status: 'draft', status_label: 'Chưa nộp', missing_step_count: 10 },
      next_action: { code: 'awaiting_company', company_update_public_id: null },
    },
  },
]

test('admin recruiter workspace: segments, next action and quick view', { tag: '@responsive' }, async ({ page }) => {
  const listRequests = []
  await page.route(API_ROUTE, async (route) => {
    const requestUrl = new URL(route.request().url())
    const path = requestUrl.pathname
    if (path === '/api/admin/accounts/') listRequests.push(Object.fromEntries(requestUrl.searchParams))
    const body = path === '/api/auth/refresh/'
      ? { access: 'e2e-access' }
      : path === '/api/auth/me/'
        ? { public_id: 'usr_root', email: 'root@example.com', role: 'admin', status: 'active', admin_access: { is_superuser: true } }
        : path === '/api/admin/accounts/summary/'
          ? {
              scope: 'recruiters',
              totals: { total: 2, active: 2, restricted: 0, unverified: 0 },
              companyless: 1,
              next_actions: { admin_queue: 1, verification_overdue: 1, awaiting_resubmission: 0 },
              verification: { pending: 1, overdue: 1 },
            }
          : path === '/api/admin/accounts/'
            ? { count: RECRUITER_ROWS.length, next: null, previous: null, results: RECRUITER_ROWS }
            : path.endsWith('/activity/')
              ? { results: [], next_cursor: null, category_counts: { all: 0 } }
              : path === '/api/admin/company-domain-claims/summary/'
                ? { total: 0, manual_pending: 0 }
                : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/admin/app/recruiters')
  const segments = page.getByRole('region', { name: 'Tổng quan nhà tuyển dụng' })
  await expect(segments).toBeVisible({ timeout: 15_000 })
  await expect(page.getByPlaceholder('Tìm tên, email, công ty, MST hoặc số điện thoại…')).toBeVisible()
  const queueTile = segments.getByRole('button', { name: /Cần admin duyệt/ })
  await expect(queueTile).toContainText('1')
  await queueTile.click()
  await expect(page).toHaveURL(/next_action=admin_queue/)
  await expect(queueTile).toHaveAttribute('aria-pressed', 'true')
  expect(listRequests.at(-1)).toMatchObject({ next_action: 'admin_queue', ordering: 'next_action' })

  const cta = page.getByRole('link', { name: 'Duyệt xác thực' }).first()
  await expect(cta).toHaveAttribute('href', '/admin/app/recruiters/usr_overdue?tab=verification')
  await expect(page.getByText('Hồ sơ quá hạn 72 giờ').first()).toBeVisible()

  await page.getByRole('button', { name: 'Xem nhanh Trần Quá Hạn' }).click()
  const drawer = page.getByLabel('Thông tin tài khoản')
  await expect(drawer.getByText('Công ty Cổ phần Ánh Dương · MST ***5678')).toBeVisible()
  await drawer.getByRole('button', { name: 'Nhà tuyển dụng tiếp theo' }).click()
  await expect(drawer.getByText('Lê Chờ Bổ Sung')).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )
})

test('regular admin: candidate accounts only, no admin accounts, invitations or settings', async ({ page }) => {
  const accountRequests = []
  await page.route(API_ROUTE, async (route) => {
    const requestUrl = new URL(route.request().url())
    const path = requestUrl.pathname
    if (path === '/api/admin/accounts/') accountRequests.push(requestUrl.searchParams.get('role'))
    const body = path === '/api/auth/refresh/'
      ? { access: 'e2e-access' }
      : path === '/api/auth/me/'
        ? {
            public_id: 'usr_staff',
            email: 'staff@example.com',
            full_name: 'Nhân viên vận hành',
            role: 'admin',
            status: 'active',
            admin_access: { is_superuser: false },
          }
        : path === '/api/admin/accounts/summary/'
          ? {
              scope: 'users',
              totals: { total: 1, active: 1, restricted: 0, unverified: 0 },
              by_role: { candidate: { total: 1, active: 1, restricted: 0, unverified: 0 } },
            }
          : path === '/api/admin/accounts/'
            ? { count: 0, next: null, previous: null, results: [] }
            : path === '/api/public/privacy/consent/'
              ? { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
              : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/admin/app/accounts?tab=invitations')
  await expect(page.getByRole('tab', { name: /Ứng viên/ })).toHaveAttribute('aria-selected', 'true', {
    timeout: 15_000,
  })
  await expect(page.getByRole('tab', { name: /Quản trị viên/ })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: /Lời mời quản trị/ })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: /Tất cả người dùng/ })).toHaveCount(0)
  await expect.poll(() => accountRequests).toContain('candidate')
  expect(accountRequests).not.toContain('admin')

  await page.goto('/admin/app/settings')
  await expect(page).toHaveURL('/admin/app/access-denied')
})

test('superuser recovers email, then sends password reset', { tag: '@responsive' }, async ({ page }) => {
  const calls = []
  const adminUser = {
    public_id: 'usr_root',
    email: 'root@example.com',
    full_name: 'System Admin',
    role: 'admin',
    status: 'active',
    admin_access: { is_superuser: true },
  }
  let account = {
    public_id: 'usr_recovery',
    email: 'old-identity@example.com',
    full_name: 'Nguyễn Cần Hỗ Trợ',
    phone: '0901234567',
    avatar_url: '',
    role: 'candidate',
    status: 'active',
    email_verified: true,
    has_usable_password: true,
    active_session_count: 2,
    last_activity_at: '2026-07-29T08:00:00Z',
    last_login: '2026-07-29T08:00:00Z',
    date_joined: '2026-07-01T08:00:00Z',
    updated_at: '2026-07-29T08:00:00Z',
    context: { kind: 'candidate' },
    profile: { headline: 'Frontend Developer' },
    section_counts: {
      active_sessions: 2,
      activity: 0,
      cvs: 0,
      applications: 0,
      consents: 0,
    },
    admin_access: null,
    invitation: null,
  }
  await page.route(API_ROUTE, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const payload = request.postDataJSON() || {}
    let body = {}
    if (path === '/api/auth/refresh/') body = { access: 'e2e-access' }
    else if (path === '/api/auth/me/') body = adminUser
    else if (path === '/api/public/privacy/consent/') {
      body = {
        consent: {
          necessary: true,
          preferences: false,
          analytics: false,
          marketing: false,
        },
      }
    } else if (
      path === '/api/admin/accounts/usr_recovery/'
      && request.method() === 'GET'
    ) body = account
    else if (path === '/api/admin/accounts/usr_recovery/sessions/') body = []
    else if (path === '/api/admin/accounts/usr_recovery/email-impact/') {
      calls.push({ path, payload })
      body = {
        operation: 'account.email.change',
        target: {
          public_id: account.public_id,
          email: account.email,
          role: account.role,
          status: account.status,
        },
        before: {
          email: account.email,
          email_verified: true,
          has_usable_password: true,
        },
        after: {
          email: payload.email,
          email_verified: false,
          has_usable_password: false,
        },
        active_session_count: 2,
        oauth_providers_to_revoke: ['google'],
        password_reset_required: true,
        password_reset_available: true,
        email_verification_required: true,
        can_apply: true,
        impact_token: 'email-impact-token',
      }
    } else if (path === '/api/admin/accounts/usr_recovery/change-email/') {
      calls.push({ path, payload })
      account = {
        ...account,
        email: payload.email,
        email_verified: false,
        has_usable_password: false,
        active_session_count: 0,
        section_counts: { ...account.section_counts, active_sessions: 0 },
      }
      body = account
    } else if (path === '/api/admin/accounts/usr_recovery/send-password-reset/') {
      calls.push({ path, payload })
      body = { detail: 'queued' }
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })

  await page.goto('/admin/app/accounts/usr_recovery?tab=security')
  await expect(page.getByRole('heading', { name: 'Nguyễn Cần Hỗ Trợ' })).toBeVisible()
  await expect(page.getByText('Khôi phục quyền truy cập'))
    .toBeVisible()
  await expect(page.getByText(/không có mật khẩu tạm/i)).toBeVisible()

  await page.getByRole('button', { name: 'Đổi email đăng nhập' }).click()
  const emailDialog = page.getByRole('dialog', { name: 'Khôi phục email đăng nhập' })
  await expect(emailDialog.getByText('Nguyễn Cần Hỗ Trợ')).toBeVisible()
  await expect(emailDialog.getByText('0901234567')).toBeVisible()
  await expect(emailDialog.getByText('usr_recovery')).toBeVisible()
  await expect(emailDialog.getByText(/Không đọc sẵn dữ liệu/)).toBeVisible()
  await expect(emailDialog.locator('label.ant-form-item-required')).toHaveText([
    'Email đăng nhập mới',
    'Lý do khôi phục',
    'Bằng chứng xác minh',
  ])
  const viewport = page.viewportSize()
  await expect.poll(async () => {
    const box = await emailDialog.boundingBox()
    return box.width
  }).toBeGreaterThan(Math.min(600, viewport.width * 0.85))
  // ActionDialog is a full-width bottom sheet under 640px and 640px wide above;
  // wait for the open animation to settle instead of measuring a scaled frame.
  await expect.poll(async () => Math.round((await emailDialog.boundingBox()).width))
    .toBe(Math.min(640, viewport.width))
  await emailDialog.getByLabel('Email đăng nhập mới').fill('NEW-IDENTITY@Example.com')
  await emailDialog.getByLabel('Lý do khôi phục').fill(
    'Người dùng mất quyền truy cập danh tính cũ',
  )
  await emailDialog.getByLabel('Bằng chứng xác minh').fill(
    'Đã gọi lại số trên hồ sơ pháp lý và đối chiếu giấy tờ.',
  )
  // The impact previews by itself once email + evidence are filled in.
  await expect(emailDialog.getByText('new-identity@example.com')).toBeVisible()
  await expect(emailDialog.getByText('Phiên bị đăng xuất')).toBeVisible()
  await emailDialog.getByRole('button', { name: 'Đổi email' }).click()
  await expect(emailDialog).toBeHidden()
  await expect(page.getByText('new-identity@example.com', { exact: true })).toBeVisible()
  await expect(page.getByText('Tiếp theo: gửi link đặt lại mật khẩu'))
    .toBeVisible()
  await expect(page.getByRole('button', { name: 'Gửi đặt lại mật khẩu' }))
    .toBeEnabled()

  await page.getByRole('button', { name: 'Gửi đặt lại mật khẩu' }).click()
  const resetDialog = page.getByRole('dialog', {
    name: 'Gửi liên kết đặt lại mật khẩu',
  })
  await expect(resetDialog.getByText('Nguyễn Cần Hỗ Trợ')).toBeVisible()
  await expect(resetDialog.getByText('0901234567')).toBeVisible()
  await expect(resetDialog.getByText('usr_recovery')).toBeVisible()
  await expect(resetDialog.locator('label.ant-form-item-required'))
    .toHaveText(['Lý do gửi liên kết'])
  await resetDialog.getByLabel('Lý do gửi liên kết').fill(
    'Đã hoàn tất đổi email theo runbook',
  )
  await resetDialog.getByRole('button', { name: 'Gửi email đặt lại' }).click()
  await expect(resetDialog).toBeHidden()
  await expect(page.getByText('Đã gửi link — đang chờ người dùng'))
    .toBeVisible()

  // Preview on input, re-preview with the reason on submit, then confirm.
  expect(calls.map((call) => call.path)).toEqual([
    '/api/admin/accounts/usr_recovery/email-impact/',
    '/api/admin/accounts/usr_recovery/email-impact/',
    '/api/admin/accounts/usr_recovery/change-email/',
    '/api/admin/accounts/usr_recovery/send-password-reset/',
  ])
  expect(calls[0].payload).toMatchObject({ email: 'new-identity@example.com', reason: '' })
  expect(calls[1].payload.reason).toBe('Người dùng mất quyền truy cập danh tính cũ')
  expect(calls[2].payload.impact_token).toBe('email-impact-token')
})

test('admin employer detail: company media and compact verification comparison render', { tag: '@responsive' }, async ({ page }) => {
  const adminUser = {
    public_id: 'usr_root',
    email: 'root@example.com',
    full_name: 'System Admin',
    role: 'admin',
    status: 'active',
    admin_access: { is_superuser: true },
  }
  const employer = {
    public_id: 'usr_employer',
    email: 'hr@example.com',
    full_name: 'Nguyễn Minh HR',
    role: 'employer',
    status: 'active',
    email_verified: true,
    context: {
      kind: 'employer',
      verification: {
        public_id: 'evc_1', status: 'in_review', status_label: 'Đang xử lý',
        submitted_at: '2026-07-26T08:00:00Z', missing_step_count: 2,
      },
      company: {
        public_id: 'co_1', name: 'FPT Software', tax_code: '***4567',
      },
    },
  }
  const verificationCase = {
    public_id: 'evc_1',
    status: 'in_review',
    full_name: employer.full_name,
    email: employer.email,
    company: { public_id: 'co_1', name: 'FPT Software', tax_code: '***4567' },
    verification_method_label: 'Giấy đăng ký doanh nghiệp',
    revision: 2,
    submitted_at: '2026-07-26T08:00:00Z',
    reviewer_email: null,
    phone_verified: true,
    lock_version: 0,
    final_rejection_count: 1,
    rejection_limit: 3,
    resubmission_locked: false,
    resubmission_locked_at: null,
    recruiter: { company_role: 'member' },
    checks: {
      email_verified: true,
      registration_completed: true,
      consulting_need_completed: true,
      phone_verified: true,
      company_linked: true,
      representative_documents_submitted: true,
      business_documents_approved: true,
      candidate_dpa_approved: true,
      dpa_accepted: true,
    },
    tax_lookup_evidence: {
      provider: 'vietqr',
      status: 'found',
      workflow_revision: 2,
      tax_code: '0101234567',
      returned_tax_code: '0101234567',
      submitted_company_name: 'FPT Software',
      registered_name: 'FPT SOFTWARE',
      comparison: {
        tax_code: 'match',
        company_name: 'match',
      },
      completed_at: '2026-07-26T08:05:00Z',
    },
    documents: [
      {
        public_id: 'doc_business',
        doc_type: 'business_registration',
        doc_type_label: 'Giấy đăng ký doanh nghiệp',
        file_name: 'dang-ky-doanh-nghiep.svg',
        mime_type: 'image/svg+xml',
        version: 1,
        is_current: true,
        status: 'approved',
        status_label: 'Đã duyệt',
        created_at: '2026-07-26T08:00:00Z',
        duplicate_company_count: 0,
      },
      {
        public_id: 'doc_auth',
        doc_type: 'authorization_letter',
        doc_type_label: 'Giấy ủy quyền',
        file_name: 'uy-quyen.pdf',
        mime_type: 'application/pdf',
        version: 1,
        is_current: true,
        status: 'approved',
        status_label: 'Đã duyệt',
        created_at: '2026-07-26T08:00:00Z',
        duplicate_company_count: 0,
      },
      {
        public_id: 'doc_dpa',
        doc_type: 'data_processing_agreement',
        doc_type_label: 'Thỏa thuận xử lý dữ liệu cá nhân',
        file_name: 'dpa.pdf',
        mime_type: 'application/pdf',
        version: 1,
        is_current: true,
        status: 'approved',
        status_label: 'Đã duyệt',
        created_at: '2026-07-26T08:00:00Z',
        duplicate_company_count: 0,
      },
    ],
    events: [],
  }
  const mediaImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect width='100%25' height='100%25' fill='%230ea5e9'/%3E%3C/svg%3E"
  const accountProfile = {
    employer: {
      position_title: 'HR Manager',
      company_role: 'owner',
      company: {
        public_id: 'co_1',
        slug: 'fpt-software',
        legal_name: 'FPT Software',
        trade_name: 'FPT Software',
        trade_name_same_as_registered: true,
        business_type: 'enterprise',
        tax_code: '***4567',
        company_size: '500-1000',
        founded_year: 1999,
        primary_industry: 'IT - Phần mềm',
        logo_url: mediaImage,
        cover_image_url: mediaImage,
        has_no_logo: false,
        address: 'Đà Nẵng',
        website_url: 'https://fpt.example',
        has_no_website: false,
        email: 'hr@fpt.example',
        phone: '0901234567',
        markets: ['domestic', 'asia'],
        target_customers: ['b2b'],
        has_brand_page: true,
        industries: [{ id: 1, name: 'IT - Phần mềm', is_primary: true }],
        description: '<p>Công ty công nghệ</p>',
        employee_benefits: '<p>Chế độ phúc lợi đầy đủ</p>',
        created_by_email: employer.email,
        created_by_public_id: employer.public_id,
        created_at: '2026-07-01T08:00:00Z',
        updated_at: '2026-07-27T00:00:00Z',
        images: [{ id: 1, image_url: mediaImage, caption: 'Văn phòng Đà Nẵng' }],
      },
    },
  }
  const companyUpdate = {
    public_id: 'cur_1',
    company: { public_id: 'co_1', name: 'FPT Software', tax_code: '***4567' },
    requested_by_email: employer.email,
    requested_by_public_id: employer.public_id,
    changes: {
      trade_name: 'FPT Digital',
      description: '<p>Mô tả mới</p>',
      gallery_additions: ['employers/co_1/gallery/proposed.jpg'],
    },
    current_values: {
      trade_name: 'FPT Software',
      description: '<p>Mô tả hiện tại</p>',
      gallery_additions: [],
    },
    industry_labels: {},
    media_previews: {
      gallery_additions: [
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='120'%3E%3Crect width='100%25' height='100%25' fill='%230ea5e9'/%3E%3C/svg%3E",
      ],
    },
    is_sensitive: false,
    status: 'pending',
    status_label: 'Chờ duyệt',
    revision: 2,
    lock_version: 0,
    documents: [],
    created_at: '2026-07-25T08:00:00Z',
    updated_at: '2026-07-26T09:00:00Z',
  }
  await page.route(API_ROUTE, async (route) => {
    const path = new URL(route.request().url()).pathname
    let body = {}
    if (path === '/api/auth/refresh/') body = { access: 'e2e-access' }
    else if (path === '/api/auth/me/') body = adminUser
    else if (path === '/api/admin/accounts/usr_employer/') body = employer
    else if (path === '/api/admin/accounts/usr_employer/profile/') body = accountProfile
    else if (path === '/api/admin/employer-verifications/evc_1/documents/doc_business/content/') {
      await route.fulfill({
        contentType: 'image/svg+xml',
        body: "<svg xmlns='http://www.w3.org/2000/svg' width='900' height='1200'><rect width='100%' height='100%' fill='#fff'/><text x='60' y='100' font-size='40'>Giấy đăng ký doanh nghiệp</text></svg>",
      })
      return
    }
    else if (path === '/api/admin/employer-verifications/evc_1/decision-impact/') {
      body = {
        case_public_id: 'evc_1',
        case_revision: 2,
        lock_version: 0,
        decision: 'approved',
        reason: '',
        checks: verificationCase.checks,
        tax_advisory: {
          status: 'matched',
          provider_status: 'found',
          evidence_public_id: 'tle_1',
          comparison: { tax_code: 'match', company_name: 'match' },
          requires_override: false,
        },
        tax_override: false,
        tax_override_reason: '',
        capability_impact: {
          candidate_data_access: 'eligible_after_recompute',
          job_approval: 'eligible_after_recompute',
          job_workspace: 'unchanged',
        },
        verification_hold_impact: {
          hold_count: 0, campaign_count: 1, job_count: 2, active_jobs_to_unhide: 0,
        },
        rejection_impact: {
          current_count: 1,
          next_count: 1,
          limit: 3,
          will_lock_resubmission: false,
        },
        unlocks_employer_capabilities: true,
        impact_token: 'e2e-verification-impact',
      }
    }
    else if (path === '/api/admin/employer-verifications/evc_1/decision/') {
      verificationCase.status = 'approved'
      verificationCase.status_label = 'Đã xác thực'
      verificationCase.decision_reason = ''
      body = verificationCase
    }
    else if (path === '/api/admin/employer-verifications/evc_1/') body = verificationCase
    else if (path === '/api/admin/employer-verifications/') {
      body = {
        count: 1,
        next: null,
        previous: null,
        results: [{ public_id: 'evc_next', user_public_id: 'usr_next', status: 'pending' }],
      }
    } else if (path === '/api/admin/accounts/usr_employer/activity/') {
      const category = new URL(route.request().url()).searchParams.get('category') || ''
      const entries = [
        {
          id: 'auth:1',
          category: 'security',
          event: 'login',
          title: 'Đăng nhập cổng NTD',
          summary: 'Mật khẩu · Chrome trên macOS',
          tone: 'neutral',
          actor: { type: 'self', label: 'Chính tài khoản' },
          occurred_at: new Date().toISOString(),
          details: [{ label: 'Địa chỉ IP', value: '203.0.113.5', type: 'text' }],
        },
        {
          id: 'vevt:1',
          category: 'verification',
          event: 'submitted',
          title: 'Nộp hồ sơ xác thực',
          summary: '',
          tone: 'neutral',
          actor: { type: 'self', label: 'Chính tài khoản' },
          occurred_at: '2026-07-26T09:00:00Z',
          details: [],
        },
      ]
      body = {
        results: entries.filter((entry) => !category || entry.category === category),
        next_cursor: null,
        category_counts: { all: 2, security: 1, account: 0, verification: 1, company: 0, recruitment: 0 },
      }
    }
    else if (path === '/api/admin/company-update-requests/cur_1/') body = companyUpdate
    else if (path === '/api/admin/company-update-requests/') {
      body = { count: 1, next: null, previous: null, results: [companyUpdate] }
    } else if (path === '/api/public/privacy/consent/') {
      body = { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/admin/app/recruiters/usr_employer')
  await expect(page.getByLabel('Số liệu nhà tuyển dụng')).toBeVisible()
  await expect(page.getByLabel('Tóm tắt nhà tuyển dụng')).toContainText('FPT Software')
  await expect(page.getByRole('heading', { name: 'Hồ sơ nhà tuyển dụng' })).toBeVisible()
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )

  await page.goto('/admin/app/accounts/usr_employer?tab=company')

  await expect(page).toHaveURL(/\/admin\/app\/recruiters\/usr_employer\?tab=company$/)
  await expect(page.getByRole('tab', { name: 'Công ty' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('img', { name: 'Logo FPT Software' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Ảnh bìa FPT Software' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Văn phòng Đà Nẵng' })).toBeVisible()
  await expect(page.getByText('Chế độ phúc lợi đầy đủ')).toBeVisible()
  await expect(page.getByText('hr@fpt.example')).toBeVisible()
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )

  await page.goto('/admin/app/accounts/usr_employer?tab=verification&company_update=cur_1')

  await expect(page).toHaveURL(
    /\/admin\/app\/recruiters\/usr_employer\?tab=verification&company_update=cur_1$/,
  )
  await expect(page.getByRole('tab', { name: 'Xác thực' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', {
    name: 'Hồ sơ đã hoàn tất toàn bộ điều kiện',
  })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Bảng trạng thái giấy tờ' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Đã duyệt, 3 giấy tờ' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Xem Giấy đăng ký doanh nghiệp' })).toBeVisible()
  await expect(page.getByText('Duyệt từng giấy tờ, rồi ra một quyết định chung cho hồ sơ.')).toBeVisible()
  await expect(page.locator('.verification-review-workspace')).toBeVisible()
  await expect(page.locator('.verification-review-main')).toBeVisible()
  await expect(page.locator('.verification-review-rail')).toBeVisible()
  await page.getByText('Xem điều kiện xác thực', { exact: true }).click()
  await expect(page.getByRole('region', {
    name: 'Hồ sơ đã hoàn tất toàn bộ điều kiện',
  })).toBeVisible()
  await page.getByRole('button', { name: 'Xem 9 bước' }).click()
  await expect(page.getByRole('list', { name: 'Chi tiết 9 bước xác thực' })).toBeVisible()
  await expect(page.getByText('Địa chỉ đăng ký')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Phóng to giấy tờ' })).toBeVisible()
  await expect(page.locator('.verification-image-zoom-value')).toHaveText('Vừa khung')
  await page.getByRole('button', { name: 'Phóng to giấy tờ' }).click()
  await expect(page.locator('.verification-image-zoom-value')).toHaveText('125%')
  await page.getByRole('button', { name: 'Đưa toàn bộ giấy tờ vừa khung xem' }).click()
  await expect(page.locator('.verification-image-zoom-value')).toHaveText('Vừa khung')
  await expect.poll(() => page.locator('.verification-review-layout').evaluate(
    (element) => getComputedStyle(element).gap,
  )).toBe('20px')
  await expect(page.locator('.verification-final-actions')).toHaveCSS('display', 'grid')
  await expect(page.getByRole('button', { name: 'Duyệt hồ sơ' })).toHaveCSS('white-space', 'nowrap')

  await page.getByRole('button', { name: 'Duyệt hồ sơ' }).click()
  const finalDecisionDialog = page.getByRole('dialog', { name: /Duyệt hồ sơ/ })
  // The impact loads as the dialog opens; one click confirms.
  await expect(finalDecisionDialog.getByText(/Chỉ áp dụng cho nhà tuyển dụng này/)).toBeVisible()
  await finalDecisionDialog.getByRole('button', { name: 'Duyệt hồ sơ' }).click()
  await expect(page.getByText('Hồ sơ đang có hiệu lực')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hồ sơ tiếp theo (còn 1)' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Xem chi tiết và đối chiếu/ })).toBeVisible()
  await expect(page.getByText('FPT Digital')).toHaveCount(0)

  await page.getByRole('button', { name: /Xem chi tiết và đối chiếu/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Đối chiếu yêu cầu sửa thông tin công ty' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.company-comparison-grid__header')).toContainText('Hiện tại')
  await expect(dialog.locator('.company-comparison-grid__header')).toContainText('Đề xuất mới')
  const tradeNameRow = dialog.locator('.company-comparison-grid__row').filter({ hasText: 'Tên thương mại' })
  await expect(tradeNameRow.getByText('FPT Software')).toBeVisible()
  await expect(tradeNameRow.getByText('FPT Digital')).toBeVisible()
  await expect(dialog.getByRole('img', { name: 'Ảnh thư viện thêm mới 1' })).toBeVisible()
  await page.keyboard.press('Escape')

  // Activity: grouped by day, clock times, filterable by category.
  await page.goto('/admin/app/recruiters/usr_employer?tab=activity')
  const timeline = page.getByRole('region', { name: 'Nhật ký hoạt động' })
  await expect(timeline.getByText('Hôm nay')).toBeVisible()
  await expect(timeline.getByText('Đăng nhập cổng NTD')).toBeVisible()
  await expect(timeline.locator('.activity-entry__time').first()).toHaveText(/^\d{2}:\d{2}$/)
  await timeline.getByRole('button', { name: /^Xác thực/ }).click()
  await expect(page).toHaveURL(/activity_category=verification/)
  await expect(timeline.getByText('Nộp hồ sơ xác thực')).toBeVisible()
  await expect(timeline.getByText('Đăng nhập cổng NTD')).toHaveCount(0)
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )
})

test('admin invitation acceptance activates the account with a password', async ({ page }) => {
  await mockPublicApi(page)
  await page.route('**/api/auth/admin-invitations/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const body = path.endsWith('/validate/')
      ? {
          email: 'new-admin@example.com',
          full_name: 'Admin mới',
          expires_at: '2026-12-31T00:00:00Z',
        }
      : {
          user_public_id: 'usr_new_admin',
        }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/admin/app/invitation?token=signed-token')
  await expect(page).toHaveTitle('Hoàn tất tài khoản quản trị | Quản trị ProCV')
  await expect(page.getByRole('heading', { name: 'Hoàn tất tài khoản quản trị' })).toBeVisible()
  await expect(page.getByText('new-admin@example.com')).toBeVisible()
  await page.getByLabel('Mật khẩu mới').fill('StrongPass123')
  await page.getByLabel('Xác nhận mật khẩu').fill('StrongPass123')
  await page.getByRole('button', { name: 'Kích hoạt tài khoản' }).click()
  await expect(page.getByText('Tài khoản Admin đã sẵn sàng')).toBeVisible()
  await expect(page.getByText(/Đăng nhập cổng quản trị để bắt đầu làm việc/)).toBeVisible()
})

test('admin password reset stays on the Admin portal', async ({ page }) => {
  await mockPublicApi(page)
  await page.route('**/api/auth/password-reset/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'GET') {
      expect(url.searchParams.get('portal')).toBe('admin')
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ email: 'moderator@example.com', role: 'admin' }),
      })
      return
    }
    expect(request.postDataJSON()).toMatchObject({
      token: 'admin-reset-token',
      portal: 'admin',
    })
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Đặt lại mật khẩu thành công.', role: 'admin' }),
    })
  })

  await page.goto('/admin/app/reset-password?token=admin-reset-token')
  await expect(page).toHaveTitle('Đặt lại mật khẩu quản trị | Quản trị ProCV')
  await expect(page.getByRole('heading', { name: 'Đặt lại mật khẩu quản trị' })).toBeVisible()
  await page.getByLabel('Mật khẩu mới').fill('StrongPass123')
  await page.getByLabel('Nhập lại mật khẩu').fill('StrongPass123')
  await page.getByRole('button', { name: 'Đặt lại mật khẩu' }).click()
  await expect(page.getByRole('heading', { name: 'Đã đổi mật khẩu' })).toBeVisible()
  await expect(page.getByText(/Đăng nhập lại cổng quản trị để tiếp tục/)).toBeVisible()
})

test('admin job management: list, detail and revision-bound hide workflow', { tag: '@responsive' }, async ({ page }) => {
  let decisionPayload
  const adminUser = {
    public_id: 'usr_moderator',
    email: 'moderator@example.com',
    full_name: 'Nguyễn Kiểm Duyệt',
    role: 'admin',
    status: 'active',
    admin_access: { is_superuser: false },
  }
  const baseJob = {
    public_id: 'job_active',
    slug: 'backend-engineer',
    title: 'Backend Engineer',
    company_public_id: 'co_1',
    company_name: 'Công ty Mẫu',
    employer_public_id: 'usr_employer',
    employer_name: 'Nguyễn Nhà Tuyển Dụng',
    employer_email: 'employer@example.com',
    employer_account_status: 'active',
    employer_email_verified: true,
    employer_phone_verified: true,
    employer_verification_completed: true,
    company_role_label: 'Chủ sở hữu',
    status: 'active',
    status_label: 'Đang tuyển',
    is_expired: false,
    policy_hold: '',
    policy_hold_label: 'Không giữ',
    moderation_hold: '',
    moderation_hold_label: 'Không giữ',
    tier: 'standard',
    tier_label: 'Tin thường',
    deadline: '2026-08-30',
    submitted_at: '2026-07-30T09:00:00Z',
    updated_at: '2026-07-30T09:00:00Z',
    view_count: 8,
    application_count: 2,
    pending_report_count: 0,
    report_count: 0,
    published_job_count: 3,
  }
  const detailJob = {
    ...baseJob,
    description: '<p>Xây dựng nền tảng tuyển dụng.</p>',
    requirements: '<p>Tối thiểu hai năm kinh nghiệm.</p>',
    benefits: '<p>Bảo hiểm đầy đủ.</p>',
    work_types: ['hybrid'],
    employment_type: 'full_time',
    experience_years: '2',
    position_level: 'employee',
    education_level: 'university',
    gender_requirement: 'any',
    number_of_vacancies: 2,
    salary_type: 'range',
    salary_min: '20000000.00',
    salary_max: '30000000.00',
    currency: 'VND',
    category_assignments: [],
    job_locations: [],
    job_skills: [],
    work_schedules: [],
    job_benefits: [],
    language_requirements: [],
    application_contact: {
      recipient_name: 'Phòng nhân sự',
      phone: '0901234567',
      emails: [{ id: 1, email: 'hr@example.com' }],
    },
    can_view_sensitive_contact: true,
    status_history: [],
    moderation_events: [],
    reports: [],
    review_token: 'signed-review-token',
    state_actions: ['hide'],
    blocked_reasons: [
      { code: 'verification_required', label: 'Nhà tuyển dụng chưa được duyệt xác thực.' },
    ],
    content_changes: { has_baseline: false, changed_count: 0, hidden_sensitive_count: 0, changes: [] },
    employer_account_level: 3,
    employer_verification_completed: true,
  }

  await page.route(API_ROUTE, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (
      path === '/api/admin/jobs/moderation/job_active/decisions/'
      && request.method() === 'POST'
    ) {
      decisionPayload = request.postDataJSON()
    }
    const body = path === '/api/auth/refresh/'
      ? { access: 'e2e-access' }
      : path === '/api/auth/me/'
        ? adminUser
        : path === '/api/public/privacy/consent/'
          ? { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
          : path === '/api/admin/jobs/moderation/summary/'
            ? { total: 1, draft: 0, active: 1, expired: 0, closed: 0, held: 0, pending_reports: 0 }
            : path === '/api/admin/jobs/moderation/'
              ? { count: 1, next: null, previous: null, results: [baseJob] }
              : path === '/api/admin/jobs/moderation/job_active/'
                ? detailJob
                : path === '/api/admin/jobs/moderation/job_active/decisions/'
                  ? {
                      ...detailJob,
                      moderation_hold: 'manual_review',
                      moderation_hold_label: 'Tạm ẩn để rà soát nội dung',
                      review_token: 'next-review-token',
                      state_actions: ['restore'],
                    }
                  : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/admin/app/job-moderation')
  await expect(page.getByText('Backend Engineer', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Xem chi tiết' }).click()
  await expect(page).toHaveURL('/admin/app/job-moderation/job_active')
  await expect(page).toHaveTitle('Chi tiết tin tuyển dụng | Quản trị ProCV')
  const contentTab = page.getByRole('tab', { name: 'Nội dung', exact: true })
  const contactTab = page.getByRole('tab', { name: 'Nhận hồ sơ' })

  await expect(contentTab).toHaveAttribute('aria-selected', 'true')
  await expect(contactTab).toHaveAttribute('aria-selected', 'false')
  await expect(page.getByText('Xây dựng nền tảng tuyển dụng.')).toBeVisible()
  await expect(page.getByText('0901234567')).toHaveCount(0)

  await contactTab.click()
  await expect(contactTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('0901234567')).toBeVisible()

  await contentTab.click()
  await expect(contentTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Xây dựng nền tảng tuyển dụng.')).toBeVisible()

  await expect(page.getByRole('button', { name: 'Duyệt tin' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Mở hồ sơ xác thực' })).toHaveAttribute(
    'href',
    '/admin/app/recruiters/usr_employer?tab=verification',
  )

  await page.getByRole('button', { name: 'Tạm ẩn tin' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Căn cứ xử lý' }).click()
  await page.locator('.ant-select-dropdown:visible').getByText('Có dấu hiệu lừa đảo', { exact: true }).click()
  await dialog.getByRole('textbox', { name: 'Ghi chú tạm ẩn' }).fill('Cần xác minh lại nội dung.')
  await dialog.getByRole('button', { name: 'Tạm ẩn tin' }).click()

  await expect.poll(() => decisionPayload).toEqual({
    action: 'hide',
    hold: 'manual_review',
    reason_code: 'fraud_risk',
    note: 'Cần xác minh lại nội dung.',
    review_token: 'signed-review-token',
  })
  await expect(page.getByRole('button', { name: 'Khôi phục hiển thị' })).toBeVisible()
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )
})

test('admin job reports: deep link, filter and resolve workflow', { tag: '@responsive' }, async ({ page }) => {
  let status = 'pending'
  let resolvePayload
  const adminUser = {
    public_id: 'usr_moderator',
    email: 'moderator@example.com',
    full_name: 'Nguyễn Kiểm Duyệt',
    role: 'admin',
    status: 'active',
    admin_access: { is_superuser: false },
  }
  const report = {
    public_id: 'jrep_1',
    job_slug: 'backend-engineer',
    brand_slug: null,
    job_title: 'Backend Engineer',
    company_name: 'Công ty Mẫu',
    reporter_email: 'candidate@example.com',
    reason: 'wrong_info',
    reason_label: 'Thông tin tin đăng sai sự thật',
    detail: 'Mức lương công bố không chính xác.',
    status,
    resolution_note: '',
    resolved_by_email: null,
    resolved_at: null,
    created_at: '2026-07-27T01:00:00Z',
    resolution_history: [],
  }

  await page.route(API_ROUTE, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (path === '/api/admin/jobs/reports/jrep_1/resolve/' && request.method() === 'POST') {
      resolvePayload = request.postDataJSON()
      status = resolvePayload.status
    }
    const currentReport = { ...report, status }
    const matchesFilter = !url.searchParams.get('status')
      || url.searchParams.get('status') === status
    const body = path === '/api/auth/refresh/'
      ? { access: 'e2e-access' }
      : path === '/api/auth/me/'
        ? adminUser
      : path === '/api/public/privacy/consent/'
        ? { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
        : path === '/api/admin/jobs/reports/'
          ? {
              count: matchesFilter ? 1 : 0,
              next: null,
              previous: null,
              results: matchesFilter ? [currentReport] : [],
            }
          : path === '/api/admin/jobs/reports/jrep_1/resolve/'
            ? currentReport
            : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/admin/app/job-moderation?tab=reports')
  await expect(page.getByRole('tab', { name: 'Báo cáo vi phạm' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByText('Backend Engineer')).toBeVisible()
  await page.getByRole('button', { name: 'Xác nhận vi phạm' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Ghi chú xử lý' }).fill('Đã đối chiếu nội dung tin.')
  await dialog.getByRole('button', { name: 'Xác nhận vi phạm' }).click()

  await expect(dialog).toBeHidden()
  expect(resolvePayload).toEqual({
    status: 'upheld',
    note: 'Đã đối chiếu nội dung tin.',
  })
  await expect(page.getByText('Chưa có báo cáo trong hàng đợi.')).toBeVisible()
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )
})

test('admin company reports: queue resolves a report and can hide the company page', { tag: '@responsive' }, async ({ page }) => {
  let status = 'pending'
  let resolvePayload
  const listRequests = []
  const adminUser = {
    public_id: 'usr_moderator',
    email: 'moderator@example.com',
    full_name: 'Nguyễn Kiểm Duyệt',
    role: 'admin',
    status: 'active',
    admin_access: { is_superuser: false },
  }
  const report = {
    public_id: 'crp_1',
    company: { public_id: 'co_alpha', slug: 'alpha', display_name: 'Alpha', logo_url: '', content_policy_hold: false },
    reporter_email: 'candidate@example.com',
    reason: 'impersonation',
    reason_label: 'Mạo danh doanh nghiệp khác',
    section_key: 'about',
    section_title: 'Giới thiệu công ty',
    detail: 'Trang dùng tên của doanh nghiệp khác.',
    status,
    resolution_note: '',
    resolved_at: null,
    resolved_by_email: '',
    resolution_history: [],
    created_at: '2026-11-14T01:00:00Z',
  }

  await page.route(API_ROUTE, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (path === '/api/admin/company-reports/crp_1/resolve/' && request.method() === 'POST') {
      resolvePayload = request.postDataJSON()
      status = resolvePayload.status
    }
    if (path === '/api/admin/company-reports/') listRequests.push(Object.fromEntries(url.searchParams))
    const currentReport = {
      ...report,
      status,
      company: { ...report.company, content_policy_hold: status === 'upheld' },
    }
    const matchesFilter = !url.searchParams.get('status') || url.searchParams.get('status') === status
    const body = path === '/api/auth/refresh/'
      ? { access: 'e2e-access' }
      : path === '/api/auth/me/'
        ? adminUser
        : path === '/api/public/privacy/consent/'
          ? { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
          : path === '/api/admin/company-reports/'
            ? { count: matchesFilter ? 1 : 0, next: null, previous: null, results: matchesFilter ? [currentReport] : [] }
            : path === '/api/admin/company-reports/crp_1/resolve/'
              ? currentReport
              : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/admin/app/company-reports')
  await expect(page.getByRole('heading', { level: 1, name: 'Báo cáo công ty' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Alpha', exact: true })).toHaveAttribute(
    'href',
    '/admin/app/companies/co_alpha?tab=public-page',
  )
  await expect(page.getByText('Phần: Giới thiệu công ty')).toBeVisible()
  expect(listRequests[0]).toEqual({ status: 'pending', ordering: '-created_at', page: '1' })

  await page.getByRole('button', { name: 'Xác nhận vi phạm' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Xác nhận vi phạm' }).click()
  await expect(dialog.getByText('Nhập ghi chú xử lý.')).toBeVisible()
  await dialog.getByRole('textbox', { name: 'Ghi chú xử lý' }).fill('Đã đối chiếu giấy đăng ký doanh nghiệp.')
  await dialog.getByRole('checkbox', { name: 'Đồng thời tạm ẩn trang công ty' }).check()
  await dialog.getByRole('button', { name: 'Xác nhận vi phạm' }).click()

  await expect(dialog).toBeHidden()
  expect(resolvePayload).toEqual({
    status: 'upheld',
    note: 'Đã đối chiếu giấy đăng ký doanh nghiệp.',
    apply_hold: true,
  })
  await expect(page.getByText('Chưa có báo cáo trong hàng đợi.')).toBeVisible()

  await page.getByRole('combobox', { name: 'Lọc trạng thái báo cáo' }).click()
  await page.locator('.ant-select-item-option-content', { hasText: 'Đã xác nhận vi phạm' }).click()
  await expect(page).toHaveURL(/\/admin\/app\/company-reports\?status=upheld$/)
  await expect(page.getByText('Đang tạm ẩn')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gỡ kết luận' })).toBeVisible()
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )
})
