import { expect, test } from '@playwright/test'
import { ADMIN_ROUTES } from '../../../src/app/router/admin/admin-routes.config.js'
import { expectAnimatedLoginButton, mockPublicApi } from './helpers'

test('admin smoke: login loads and dashboard stays role-protected', async ({ page }) => {
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

test('admin account management: filters, table actions and quick detail are responsive', async ({ page }, testInfo) => {
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
    admin_access: {
      is_superuser: true,
      permissions: [
        'account.view',
        'account.admin.view',
        'account.admin.invite',
        'account.profile.manage',
        'account.security.manage',
        'account.status.manage',
      ],
      memberships: [],
    },
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
    two_factor_enabled: false,
    mfa_methods: { email: false, totp: false, backup_codes_remaining: 0 },
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
  await page.route('http://localhost:8000/api/**', async (route) => {
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
          : path === '/api/privacy/consent/'
            ? { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
          : path === '/api/admin/departments/' || path === '/api/admin/roles/'
            ? []
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
  await expect(adminNavigation.getByRole('button', { name: 'Trang chủ' })).not
    .toHaveAttribute('aria-expanded')
  await expect(adminNavigation.getByRole('button', { name: 'Tài khoản cá nhân' })).not
    .toHaveAttribute('aria-expanded')
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
  await page.getByRole('button', { name: 'Xem nhanh' }).click()
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
  await expect(page.getByText('Cần xử lý', { exact: true }).filter({ visible: true })).toBeVisible()
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
})

test('superuser recovers email, resets MFA, then sends password reset', async ({ page }) => {
  const calls = []
  const adminUser = {
    public_id: 'usr_root',
    email: 'root@example.com',
    full_name: 'System Admin',
    role: 'admin',
    status: 'active',
    admin_access: { is_superuser: true, permissions: [], memberships: [] },
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
    two_factor_enabled: true,
    mfa_methods: { email: true, totp: true, backup_codes_remaining: 2 },
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
  await page.route('http://localhost:8000/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const payload = request.postDataJSON() || {}
    let body = {}
    if (path === '/api/auth/refresh/') body = { access: 'e2e-access' }
    else if (path === '/api/auth/me/') body = adminUser
    else if (path === '/api/privacy/consent/') {
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
        mfa_methods: account.mfa_methods,
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
    } else if (path === '/api/admin/accounts/usr_recovery/mfa-impact/') {
      calls.push({ path, payload })
      body = {
        operation: 'account.mfa.reset',
        target: {
          public_id: account.public_id,
          email: account.email,
          role: account.role,
          status: account.status,
        },
        methods_to_disable: account.mfa_methods,
        active_session_count: 0,
        password_will_remain_unchanged: true,
        can_apply: true,
        impact_token: 'mfa-impact-token',
      }
    } else if (path === '/api/admin/accounts/usr_recovery/reset-mfa/') {
      calls.push({ path, payload })
      account = {
        ...account,
        two_factor_enabled: false,
        mfa_methods: { email: false, totp: false, backup_codes_remaining: 0 },
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
  }).toBeGreaterThan(Math.min(700, viewport.width * 0.85))
  const emailDialogBox = await emailDialog.boundingBox()
  expect(emailDialogBox.width).toBeLessThanOrEqual(viewport.width - 24)
  await emailDialog.getByLabel('Email đăng nhập mới').fill('NEW-IDENTITY@Example.com')
  await emailDialog.getByLabel('Lý do khôi phục').fill(
    'Người dùng mất quyền truy cập danh tính cũ',
  )
  await emailDialog.getByLabel('Bằng chứng xác minh').fill(
    'Đã gọi lại số trên hồ sơ pháp lý và đối chiếu giấy tờ.',
  )
  await emailDialog.getByRole('button', { name: 'Xem tác động' }).click()
  await expect(emailDialog.getByText('old-identity@example.com').last()).toBeVisible()
  await expect(emailDialog.getByText('new-identity@example.com')).toBeVisible()
  await expect(emailDialog.getByText(/cần reset ở bước kế tiếp/)).toBeVisible()
  await emailDialog.getByRole('button', { name: 'Xác nhận thực hiện' }).click()
  await expect(emailDialog).toBeHidden()
  await expect(page.getByText('new-identity@example.com')).toBeVisible()
  await expect(page.getByText('Tiếp theo: đặt lại MFA')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gửi đặt lại mật khẩu' }))
    .toHaveCount(0)
  await expect(page.getByText('Chưa mở')).toBeVisible()

  await page.getByRole('button', { name: 'Đặt lại MFA' }).click()
  const mfaDialog = page.getByRole('dialog', {
    name: 'Đặt lại xác thực đa yếu tố',
  })
  await expect(mfaDialog.getByText('Nguyễn Cần Hỗ Trợ')).toBeVisible()
  await expect(mfaDialog.getByText('new-identity@example.com')).toBeVisible()
  await expect(mfaDialog.locator('label.ant-form-item-required')).toHaveText([
    'Lý do khôi phục',
    'Bằng chứng xác minh',
  ])
  await mfaDialog.getByLabel('Lý do khôi phục').fill(
    'Người dùng mất toàn bộ phương thức xác minh',
  )
  await mfaDialog.getByLabel('Bằng chứng xác minh').fill(
    'Đã gọi lại số trên hồ sơ pháp lý và đối chiếu giấy tờ.',
  )
  await mfaDialog.getByRole('button', { name: 'Xem tác động' }).click()
  await expect(mfaDialog.getByText('Giữ nguyên, không bị thay đổi')).toBeVisible()
  await mfaDialog.getByRole('button', { name: 'Xác nhận thực hiện' }).click()
  await expect(mfaDialog).toBeHidden()
  await expect(page.getByText('Chưa bật', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('0', { exact: true }).first()).toBeVisible()
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
    'Đã hoàn tất đổi email và reset MFA theo runbook',
  )
  await resetDialog.getByRole('button', { name: 'Xác nhận gửi' }).click()
  await expect(resetDialog).toBeHidden()
  await expect(page.getByText('Đã gửi link — đang chờ người dùng'))
    .toBeVisible()

  expect(calls.map((call) => call.path)).toEqual([
    '/api/admin/accounts/usr_recovery/email-impact/',
    '/api/admin/accounts/usr_recovery/change-email/',
    '/api/admin/accounts/usr_recovery/mfa-impact/',
    '/api/admin/accounts/usr_recovery/reset-mfa/',
    '/api/admin/accounts/usr_recovery/send-password-reset/',
  ])
  expect(calls[0].payload.email).toBe('new-identity@example.com')
  expect(calls[1].payload.impact_token).toBe('email-impact-token')
  expect(calls[3].payload.impact_token).toBe('mfa-impact-token')
})

test('admin employer detail: company media and compact verification comparison render', async ({ page }) => {
  const adminUser = {
    public_id: 'usr_root',
    email: 'root@example.com',
    full_name: 'System Admin',
    role: 'admin',
    status: 'active',
    admin_access: { is_superuser: true, permissions: [], memberships: [] },
  }
  const employer = {
    public_id: 'usr_employer',
    email: 'hr@example.com',
    full_name: 'Nguyễn Minh HR',
    role: 'employer',
    status: 'active',
    email_verified: true,
    two_factor_enabled: false,
    context: {
      kind: 'employer',
      verification: {
        public_id: 'evc_1', status: 'in_review', status_label: 'Đang xử lý',
        submitted_at: '2026-07-26T08:00:00Z', missing_step_count: 2,
      },
      company: {
        public_id: 'co_1', name: 'FPT Software', tax_code: '***4567',
        verification_status: 'verified',
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
        verification_status: 'verified',
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
  await page.route('http://localhost:8000/api/**', async (route) => {
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
        company_impact: {
          company_public_id: 'co_1',
          current_status: 'verified',
          will_mark_verified: false,
          will_downgrade: false,
        },
        capability_impact: {
          candidate_data_access: 'eligible_after_recompute',
          job_approval: 'eligible_after_recompute',
          job_workspace: 'unchanged',
        },
        verification_hold_impact: {
          hold_count: 0, campaign_count: 1, job_count: 2, active_jobs_to_unhide: 0,
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
    else if (path === '/api/admin/company-update-requests/') {
      body = { count: 1, next: null, previous: null, results: [companyUpdate] }
    } else if (path === '/api/privacy/consent/') {
      body = { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

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

  await page.goto('/admin/app/accounts/usr_employer?tab=verification')

  await expect(page).toHaveURL(/\/admin\/app\/recruiters\/usr_employer\?tab=verification$/)
  await expect(page.getByRole('tab', { name: 'Xác thực' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', {
    name: 'Hồ sơ đã hoàn tất toàn bộ điều kiện',
  })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Chi tiết 9 bước xác thực' })).toHaveCount(0)
  await expect(page.getByText('Quyền đại diện', { exact: true })).toBeVisible()
  await expect(page.getByText('Pháp lý doanh nghiệp', { exact: true })).toBeVisible()
  await expect(page.getByText('Bảo vệ dữ liệu', { exact: true })).toBeVisible()
  await expect(page.getByText(/là thành viên của công ty/)).toBeVisible()
  await expect(page.getByText('Giấy tờ và hồ sơ là hai lớp quyết định độc lập')).toBeVisible()
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

  await page.getByRole('button', { name: 'Duyệt hồ sơ' }).click()
  const finalDecisionDialog = page.getByRole('dialog', { name: 'Duyệt hồ sơ' })
  await finalDecisionDialog.getByRole('button', { name: 'Xem tác động' }).click()
  await expect(finalDecisionDialog.getByText('Trạng thái pháp lý của công ty không bị hạ.'))
    .toBeVisible()
  await finalDecisionDialog.getByRole('button', { name: 'Xác nhận quyết định' }).click()
  await expect(page.getByText('Hồ sơ đang có hiệu lực')).toBeVisible()
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
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )
})

test('admin detail: complete effective permissions render in access tab', async ({ page }) => {
  const currentAdmin = {
    public_id: 'usr_root',
    email: 'root@example.com',
    full_name: 'System Admin',
    role: 'admin',
    status: 'active',
    admin_access: { is_superuser: true, permissions: [], memberships: [] },
  }
  const managedAdmin = {
    public_id: 'usr_moderator',
    email: 'moderator@example.com',
    full_name: 'Nguyễn Kiểm Duyệt',
    role: 'admin',
    status: 'active',
    email_verified: true,
    two_factor_enabled: true,
    mfa_methods: { email: true, totp: true, backup_codes_remaining: 5 },
    has_usable_password: true,
    active_session_count: 1,
    date_joined: '2026-07-01T08:00:00Z',
    context: { kind: 'admin' },
    invitation: {
      status: 'accepted',
      invited_by_email: currentAdmin.email,
      expires_at: '2026-07-30T08:00:00Z',
      accepted_at: '2026-07-20T08:00:00Z',
    },
    admin_access: {
      is_superuser: false,
      access_source: 'role',
      permissions: [
        'job_moderation.approve',
        'job_moderation.reject',
        'job_moderation.resolve_report',
        'job_moderation.view',
      ],
      permission_count: 4,
      membership: {
        is_active: true,
        is_primary: true,
        assigned_at: '2026-07-20T08:00:00Z',
        assigned_by_name: currentAdmin.full_name,
        assigned_by_email: currentAdmin.email,
        role: {
          code: 'moderator',
          name: 'Nhân viên kiểm duyệt',
          description: 'Kiểm tra và xử lý tin tuyển dụng chờ duyệt.',
          rank: 10,
          is_active: true,
          is_system_managed: true,
          permission_codes: [
            'job_moderation.approve',
            'job_moderation.reject',
            'job_moderation.resolve_report',
            'job_moderation.view',
          ],
          department: {
            code: 'job-moderation',
            name: 'Kiểm duyệt tin tuyển dụng',
            description: 'Đảm bảo chất lượng nội dung tuyển dụng.',
            is_active: true,
            is_system_managed: true,
          },
        },
      },
    },
  }
  await page.route('http://localhost:8000/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const body = path === '/api/auth/refresh/'
      ? { access: 'e2e-access' }
      : path === '/api/auth/me/'
        ? currentAdmin
      : path === '/api/admin/accounts/usr_moderator/'
        ? managedAdmin
        : path === '/api/privacy/consent/'
          ? { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
          : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/admin/app/accounts/usr_moderator?tab=access')

  await expect(page.getByRole('tab', { name: 'Quyền truy cập' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Nhân viên kiểm duyệt')).toBeVisible()
  await expect(page.getByText('Kiểm duyệt tin tuyển dụng', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Quyền hiệu lực' })).toBeVisible()
  await expect(page.getByText('Duyệt tin tuyển dụng', { exact: true })).toBeVisible()
  await expect(page.getByText('Từ chối tin tuyển dụng', { exact: true })).toBeVisible()
  await expect(page.getByText('Xử lý báo cáo tin tuyển dụng', { exact: true })).toBeVisible()
  await expect(page.getByText('Xem quản lý tin tuyển dụng', { exact: true })).toBeVisible()
  await expect(page.getByText('4 quyền')).toBeVisible()
  await expect(page.getByText('Đã chấp nhận')).toBeVisible()
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )
})

test('admin access control: wide permission picker supports search and dependent rights', async ({ page }) => {
  const currentAdmin = {
    public_id: 'usr_root',
    email: 'root@example.com',
    full_name: 'System Admin',
    role: 'admin',
    status: 'active',
    admin_access: { is_superuser: true, permissions: [], memberships: [] },
  }
  const department = {
    public_id: 'dept_company',
    code: 'company-operations',
    name: 'Vận hành công ty',
    description: 'Xử lý dữ liệu công ty.',
    is_active: true,
    is_system_managed: false,
    is_restorable: false,
    role_count: 1,
    active_member_count: 1,
    revoked_member_count: 0,
  }
  const role = {
    public_id: 'arole_company',
    code: 'company-reviewer',
    name: 'Chuyên viên duyệt công ty',
    description: 'Đối chiếu và duyệt thay đổi công ty.',
    rank: 20,
    is_active: true,
    is_system_managed: false,
    is_restorable: false,
    department: {
      public_id: department.public_id,
      code: department.code,
      name: department.name,
    },
    permission_codes: [],
    active_member_count: 1,
  }
  const permissions = [
    {
      code: 'company_update.view',
      module: 'company_update',
      label: 'Xem yêu cầu sửa công ty',
      description: 'Xem hàng chờ và đối chiếu nội dung đề xuất.',
      requires: [],
      is_active: true,
      is_granted_to_role: false,
    },
    {
      code: 'company_update.review',
      module: 'company_update',
      label: 'Duyệt sửa thông tin công ty',
      description: 'Duyệt và áp dụng thay đổi công ty.',
      requires: ['company_update.view'],
      is_active: true,
      is_granted_to_role: false,
    },
    {
      code: 'cv_template.view',
      module: 'cv_template',
      label: 'Xem catalogue CV',
      description: 'Xem catalogue CV.',
      requires: [],
      is_active: true,
      is_granted_to_role: false,
    },
  ]
  await page.route('http://localhost:8000/api/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    let body = {}
    if (path === '/api/auth/refresh/') body = { access: 'e2e-access' }
    else if (path === '/api/auth/me/') body = currentAdmin
    else if (path === '/api/admin/departments/') body = [department]
    else if (path === '/api/admin/roles/') body = [role]
    else if (path === '/api/admin/permissions/') body = permissions
    else if (path === '/api/admin/memberships/') body = { count: 0, next: null, previous: null, results: [] }
    else if (path === '/api/privacy/consent/') {
      body = { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/admin/app/access-control')
  await page.getByRole('tab', { name: 'Chức danh' }).click()
  await page.getByRole('button', { name: `Quyền của ${role.name}` }).click()

  const dialog = page.getByRole('dialog', { name: /Sửa quyền/ })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(`${department.name} · ${role.name}`)).toBeVisible()
  await expect(dialog.getByText('Quyền nền được đồng bộ tự động')).toBeVisible()
  const viewport = page.viewportSize()
  await expect.poll(async () => {
    const box = await dialog.boundingBox()
    return box.width / viewport.width
  }).toBeGreaterThan(0.82)

  await dialog.getByRole('textbox', { name: 'Tìm quyền' }).fill('company_update')
  await expect(dialog.getByText(/2 quyền phù hợp/)).toBeVisible()
  const reviewPermission = dialog.getByRole('checkbox', { name: 'Duyệt sửa thông tin công ty' })
  const viewPermission = dialog.getByRole('checkbox', { name: 'Xem yêu cầu sửa công ty' })
  await reviewPermission.check()
  await expect(reviewPermission).toBeChecked()
  await expect(viewPermission).toBeChecked()
  await expect(dialog.getByText('2/3 quyền đã chọn')).toBeVisible()
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )
})

test('admin invitation acceptance keeps MFA setup as a separate security step', async ({ page }) => {
  await mockPublicApi(page)
  await page.route('**/api/auth/admin-invitations/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const body = path.endsWith('/validate/')
      ? {
          email: 'new-admin@example.com',
          full_name: 'Admin mới',
          target_role: {
            name: 'Nhân viên kiểm duyệt',
            department: { name: 'Kiểm duyệt tin' },
          },
        }
      : {
          user_public_id: 'usr_new_admin',
        }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/admin/app/invitation?token=signed-token')
  await expect(page).toHaveTitle('Hoàn tất tài khoản quản trị | ProCV')
  await expect(page.getByRole('heading', { name: 'Hoàn tất tài khoản quản trị' })).toBeVisible()
  await page.getByLabel('Mật khẩu mới').fill('StrongPass123')
  await page.getByLabel('Xác nhận mật khẩu').fill('StrongPass123')
  await page.getByRole('button', { name: 'Kích hoạt tài khoản' }).click()
  await expect(page.getByText('Tài khoản Admin đã sẵn sàng')).toBeVisible()
  await expect(page.getByText(/bật xác thực hai yếu tố sau trong phần Bảo mật/)).toBeVisible()
  await expect(page.getByText('Mã dự phòng')).toBeHidden()
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
  await expect(page).toHaveTitle('Đặt lại mật khẩu quản trị | ProCV')
  await expect(page.getByRole('heading', { name: 'Đặt lại mật khẩu quản trị' })).toBeVisible()
  await page.getByLabel('Mật khẩu mới').fill('StrongPass123')
  await page.getByLabel('Nhập lại mật khẩu').fill('StrongPass123')
  await page.getByRole('button', { name: 'Đặt lại mật khẩu' }).click()
  await expect(page.getByRole('heading', { name: 'Đã đổi mật khẩu' })).toBeVisible()
  await expect(page.getByText(/xác minh MFA email/i)).toBeVisible()
})

test('admin job management: list, detail and revision-bound approval workflow', async ({ page }) => {
  let decisionPayload
  const adminUser = {
    public_id: 'usr_moderator',
    email: 'moderator@example.com',
    full_name: 'Nguyễn Kiểm Duyệt',
    role: 'admin',
    status: 'active',
    admin_access: {
      is_superuser: false,
      permissions: [
        'job_moderation.view',
        'job_moderation.approve',
        'job_moderation.reject',
        'job_moderation.enforce_visibility',
        'job_moderation.view_sensitive_contact',
        'employer_verification.view',
      ],
      memberships: [],
    },
  }
  const baseJob = {
    public_id: 'job_pending',
    slug: 'backend-engineer',
    title: 'Backend Engineer',
    company_public_id: 'co_1',
    company_name: 'Công ty Mẫu',
    company_verification_status: 'verified',
    employer_public_id: 'usr_employer',
    employer_name: 'Nguyễn Nhà Tuyển Dụng',
    employer_email: 'employer@example.com',
    employer_account_status: 'active',
    employer_email_verified: true,
    employer_phone_verified: true,
    company_role_label: 'Chủ sở hữu',
    status: 'pending',
    status_label: 'Chờ duyệt',
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
    approved_job_count: 3,
    rejected_reason: '',
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
    state_actions: ['reject'],
    blocked_reasons: [
      { code: 'verification_required', label: 'Nhà tuyển dụng chưa được duyệt xác thực.' },
    ],
    approve_blockers: [
      { code: 'verification_required', label: 'Nhà tuyển dụng chưa được duyệt xác thực.' },
    ],
    approve_requirements: [],
    employer_account_level: 3,
    employer_verification_completed: true,
  }

  await page.route('http://localhost:8000/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (
      path === '/api/jobs/admin/moderation/job_pending/decisions/'
      && request.method() === 'POST'
    ) {
      decisionPayload = request.postDataJSON()
    }
    const body = path === '/api/auth/refresh/'
      ? { access: 'e2e-access' }
      : path === '/api/auth/me/'
        ? adminUser
        : path === '/api/privacy/consent/'
          ? { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
          : path === '/api/jobs/admin/moderation/summary/'
            ? { total: 1, pending: 1, overdue: 0, active: 0, expired: 0, held: 0, rejected: 0, pending_reports: 0, sla_hours: 24 }
            : path === '/api/jobs/admin/moderation/'
              ? { count: 1, next: null, previous: null, results: [baseJob] }
              : path === '/api/jobs/admin/moderation/job_pending/'
                ? detailJob
                : path === '/api/jobs/admin/moderation/job_pending/decisions/'
                  ? {
                      ...detailJob,
                      status: 'active',
                      status_label: 'Đang tuyển',
                      review_token: 'next-review-token',
                      state_actions: ['hide'],
                    }
                  : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/admin/app/job-moderation')
  await expect(page.getByText('Backend Engineer', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Xem chi tiết' }).click()
  await expect(page).toHaveURL('/admin/app/job-moderation/job_pending')
  await expect(page).toHaveTitle('Chi tiết tin tuyển dụng | ProCV')
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

  await expect(page.getByRole('button', { name: 'Duyệt tin' })).toBeDisabled()
  await expect(page.getByRole('link', { name: 'Mở hồ sơ xác thực' })).toHaveAttribute(
    'href',
    '/admin/app/recruiters/usr_employer?tab=verification',
  )
  detailJob.state_actions = ['approve', 'reject']
  detailJob.blocked_reasons = []
  detailJob.approve_blockers = []
  await page.reload()
  await expect(page.getByRole('button', { name: 'Duyệt tin' })).toBeEnabled()

  await page.getByRole('button', { name: 'Duyệt tin' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Duyệt và công khai' }).click()

  await expect.poll(() => decisionPayload).toEqual({
    action: 'approve',
    review_token: 'signed-review-token',
  })
  await expect(page.getByText('Đang tuyển', { exact: true }).first()).toBeVisible()
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )
})

test('admin job reports: deep link, filter and resolve workflow are permission-gated', async ({ page }) => {
  let status = 'pending'
  let resolvePayload
  const adminUser = {
    public_id: 'usr_moderator',
    email: 'moderator@example.com',
    full_name: 'Nguyễn Kiểm Duyệt',
    role: 'admin',
    status: 'active',
    admin_access: {
      is_superuser: false,
      permissions: ['job_moderation.view', 'job_moderation.resolve_report'],
      memberships: [],
    },
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

  await page.route('http://localhost:8000/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (path === '/api/jobs/admin/reports/jrep_1/resolve/' && request.method() === 'POST') {
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
      : path === '/api/privacy/consent/'
        ? { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
        : path === '/api/jobs/admin/reports/'
          ? {
              count: matchesFilter ? 1 : 0,
              next: null,
              previous: null,
              results: matchesFilter ? [currentReport] : [],
            }
          : path === '/api/jobs/admin/reports/jrep_1/resolve/'
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
