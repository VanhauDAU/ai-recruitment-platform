import { expect, test } from '@playwright/test'

const adminUser = {
  public_id: 'usr_root',
  email: 'root@example.com',
  full_name: 'System Admin',
  role: 'admin',
  status: 'active',
  admin_access: {
    is_superuser: true,
    permissions: [],
    memberships: [],
  },
}

const company = {
  public_id: 'co_alpha',
  company_name: 'Công ty Alpha',
  trade_name: 'Alpha',
  logo_url: '',
  business_type: 'enterprise',
  business_type_label: 'Doanh nghiệp',
  tax_code: '0101234567',
  owners: [{
    public_id: 'rec_owner',
    user_public_id: 'usr_owner',
    full_name: 'Owner chính',
    email: 'owner@alpha.example',
  }],
  recruiter_count: 2,
  owner_count: 1,
  member_count: 1,
  pending_update_count: 1,
  recruiter_verification_summary: {
    none: 1,
    draft: 0,
    pending: 0,
    changes_requested: 0,
    approved: 1,
    rejected: 0,
  },
  website_url: 'https://alpha.example',
  email: 'contact@alpha.example',
  phone: '0901234567',
  address: 'Hà Nội',
  company_size: '25-99',
  company_size_label: '25 - 99 nhân viên',
  description: '<p>Công ty <strong>công nghệ</strong></p><script>window.bad = true</script>',
  industries: [{ id: 1, name: 'Công nghệ', slug: 'cong-nghe', is_primary: true }],
  created_by: {
    public_id: 'usr_owner',
    full_name: 'Owner chính',
    email: 'owner@alpha.example',
  },
  images: [],
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-02T00:00:00Z',
}

test('admin company directory: three-level navigation, detail and owner roster', async ({
  page,
}, testInfo) => {
  const usesDrawer = testInfo.project.name !== 'desktop-chromium'
  let companyJobsRequest
  await page.route(/^http:\/\/(?:localhost|127\.0\.0\.1):(?:5173|8000)\/api\//, async (route) => {
    const requestUrl = new URL(route.request().url())
    const path = requestUrl.pathname
    if (path === '/api/jobs/admin/moderation/') companyJobsRequest = requestUrl
    const body = path === '/api/auth/refresh/'
      ? { access: 'e2e-access' }
      : path === '/api/auth/me/'
        ? adminUser
        : path === '/api/admin/companies/'
          ? { count: 1, next: null, previous: null, results: [company] }
          : path === '/api/admin/companies/co_alpha/'
            ? company
            : path === '/api/admin/companies/co_alpha/recruiters/'
              ? {
                  count: 1,
                  next: null,
                  previous: null,
                  results: [{
                    public_id: 'rec_owner',
                    account: {
                      public_id: 'usr_owner',
                      full_name: 'Owner chính',
                      email: 'owner@alpha.example',
                      avatar_url: '',
                      status: 'active',
                      email_verified: true,
                      is_deleted: false,
                    },
                    company_role: 'owner',
                    company_role_label: 'Người tạo công ty',
                    position_title: 'HR Manager',
                    contact_phone: '0901111111',
                    phone_verified: true,
                    onboarding_completed: true,
                    verification: {
                      public_id: 'evc_owner',
                      status: 'approved',
                      status_label: 'Đã xác thực',
                    },
                    created_at: '2026-07-01T00:00:00Z',
                  }],
                }
              : path === '/api/admin/company-update-requests/'
                ? { count: 0, next: null, previous: null, results: [] }
                : path === '/api/jobs/admin/moderation/'
                  ? {
                      count: 1,
                      next: null,
                      previous: null,
                      results: [{
                        public_id: 'job_alpha',
                        title: 'Backend Engineer',
                        employer_name: 'Owner chính',
                        employer_email: 'owner@alpha.example',
                        status: 'active',
                        status_label: 'Đang tuyển',
                        is_expired: false,
                        policy_hold: '',
                        moderation_hold: '',
                        deadline: '2026-08-30',
                        submitted_at: '2026-08-01T08:00:00Z',
                        application_count: 4,
                        view_count: 25,
                        pending_report_count: 0,
                        updated_at: '2026-08-02T08:00:00Z',
                      }],
                    }
                : path === '/api/privacy/consent/'
                ? {
                    consent: {
                      necessary: true,
                      preferences: false,
                      analytics: false,
                      marketing: false,
                    },
                  }
                : {}
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })

  await page.goto('/admin/app/companies')
  await expect(page.getByRole('heading', { name: 'Quản lý công ty' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Danh sách công ty' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('columnheader', { name: 'Hồ sơ pháp nhân' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Lọc trạng thái công ty' })).toHaveCount(0)
  await expect(page.getByLabel('Công ty Alpha chưa cập nhật logo')).toBeVisible()

  if (usesDrawer) {
    await page.getByRole('button', { name: 'Mở điều hướng' }).click()
    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Doanh nghiệp' }).click()
    await expect(drawer.getByRole('button', { name: 'Thành viên' })).toHaveCount(0)
    await drawer.getByRole('button', { name: 'Công ty' }).click()
  } else {
    await expect(page.getByRole('navigation', { name: 'Điều hướng quản trị' })
      .getByRole('button', { name: 'Thành viên' })).toHaveCount(0)
    await page.getByRole('navigation', { name: 'Điều hướng quản trị' })
      .getByRole('button', { name: 'Công ty' })
      .click()
  }
  const companyListLeaf = page.getByRole('button', { name: 'Tất cả công ty' })
  await expect(companyListLeaf).toBeVisible()
  await companyListLeaf.click()

  await page.getByRole('button', { name: /Công ty Alpha/ }).click()
  await expect(page).toHaveURL('/admin/app/companies/co_alpha')
  await expect(page.getByRole('heading', { name: 'Công ty Alpha' })).toBeVisible()
  await expect(page.locator('.company-directory__rich-text strong')).toHaveText('công nghệ')
  await expect(page.locator('.company-directory__rich-text script')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Xác thực NTD' }).click()
  await expect(page.getByText('Xác thực nhà tuyển dụng')).toBeVisible()
  await expect(page.getByText('Trạng thái pháp lý công ty')).toHaveCount(0)
  await page.getByRole('tab', { name: /Nhà tuyển dụng/ }).click()
  await expect(page.getByText('HR Manager')).toBeVisible()
  await expect(page.getByLabel('Ảnh đại diện Owner chính')).toBeVisible()
  await expect(
    page.getByLabel('Nhà tuyển dụng (2)').getByText('Đã xác thực', { exact: true }),
  ).toBeVisible()
  await page.getByRole('tab', { name: 'Tin tuyển dụng' }).click()
  await expect(page.getByText('Backend Engineer', { exact: true })).toBeVisible()
  await expect.poll(() => companyJobsRequest?.searchParams.get('company')).toBe('co_alpha')
  expect(companyJobsRequest.searchParams.get('ordering')).toBe('-updated_at')
  await expect(page.getByRole('columnheader', { name: 'Cập nhật' })).toHaveAttribute(
    'aria-sort',
    'descending',
  )

  await page.goto('/admin/app/companies?tab=updates&company=co_alpha')
  await expect(page.getByRole('tab', { name: 'Yêu cầu cập nhật' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('textbox', { name: 'Tìm yêu cầu cập nhật' })).toBeVisible()
  await expect(page.getByText('Ưu tiên yêu cầu có thay đổi pháp lý')).toBeVisible()
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )
})
