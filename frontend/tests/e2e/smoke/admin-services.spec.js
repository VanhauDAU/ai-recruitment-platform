import { expect, test } from '@playwright/test'

const adminUser = {
  public_id: 'usr_services_admin',
  email: 'services-admin@example.com',
  full_name: 'Quản trị dịch vụ',
  role: 'admin',
  status: 'active',
  admin_access: {
    is_superuser: true,
    permissions: [],
    memberships: [],
  },
}

test('admin services: version workspace stays clear and responsive', async ({ page }) => {
  await page.route(/^http:\/\/(?:localhost|127\.0\.0\.1):(?:5173|8000)\/api\//, async (route) => {
    const path = new URL(route.request().url()).pathname
    const body = path === '/api/auth/refresh/'
      ? { access: 'services-e2e-access' }
      : path === '/api/auth/me/'
        ? adminUser
        : path === '/api/services/admin/categories/'
          ? [{ id: 1, key: 'jobs', name_vi: 'Tin tuyển dụng', name_en: '', description_vi: '', packages_count: 1, order: 1, is_active: true }]
          : path === '/api/services/admin/packages/'
            ? [{ id: 10, category: 1, category_key: 'jobs', slug: 'priority', name_vi: 'Ưu tiên', name_en: '', tagline_vi: '', price: '299000', currency: 'VND', benefits_vi: [], benefits_en: [], cta_type: 'contact', is_highlight: false, is_active: true, order: 1 }]
            : path === '/api/services/admin/capabilities/'
              ? [{ code: 'sponsored_placement', name_vi: 'Vị trí tài trợ', scope: 'placement', effect_type: 'placement', is_active: true }]
              : path === '/api/services/admin/package-versions/'
                ? [{ id: 20, package: 10, package_name: 'Ưu tiên', package_slug: 'priority', version_number: 1, status: 'draft', price: '299000', currency: 'VND', activate_within_days: 90, terms_vi: '', terms_en: '', items: [{ capability: 'sponsored_placement', capability_name: 'Vị trí tài trợ', quantity: 1, duration_days: 14, configuration: { placement: 'search_sponsored' }, order: 0 }], created_at: '2026-08-12T00:00:00Z', updated_at: '2026-08-12T00:00:00Z', published_at: null }]
                : path === '/api/privacy/consent/'
                  ? { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
                  : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/admin/app/services?tab=versions')
  await expect(page.getByRole('heading', { name: 'Dịch vụ nhà tuyển dụng' })).toBeVisible()
  await expect(page.getByText('Phiên bản đã phát hành là bất biến')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Ưu tiên' })).toBeVisible()
  await page.getByRole('button', { name: /Tạo phiên bản/ }).click()
  await expect(page.getByRole('dialog', { name: 'Tạo phiên bản gói' })).toBeVisible()
  await expect(page.getByLabel('Gói dịch vụ')).toBeVisible()
  await expect(page.getByLabel('Hạn bắt đầu dùng')).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('admin services: activation workspace reports usage and requires a termination reason', async ({ page }) => {
  const activeActivation = {
    public_id: 'act_top_job_001',
    company_public_id: 'company_acme',
    company_name: 'Công ty Acme',
    job_public_id: 'job_ai_engineer',
    job_title: 'Kỹ sư AI',
    job_status: 'published',
    campaign_public_id: 'campaign_q3',
    campaign_name: 'Tuyển đội AI quý 3',
    package_name: 'Top Job 14 ngày',
    version_number: 2,
    status: 'active',
    is_effective: true,
    starts_at: '2026-08-10T02:00:00Z',
    ends_at: '2026-08-24T02:00:00Z',
    terminated_at: null,
    termination_reason: '',
    metrics: {
      available: true,
      impressions: 1250,
      views: 186,
      saves: 21,
      applies: 14,
    },
    items: [{
      capability: 'sponsored_placement',
      name: 'Ưu tiên hiển thị',
      quantity: 1,
      remaining_quantity: 1,
      starts_at: '2026-08-10T02:00:00Z',
      ends_at: '2026-08-24T02:00:00Z',
      configuration: { placement: 'search_sponsored' },
    }],
  }
  let terminated = false
  let terminationRequest = null

  await page.route(/^http:\/\/(?:localhost|127\.0\.0\.1):(?:5173|8000)\/api\//, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const activation = terminated
      ? {
          ...activeActivation,
          status: 'terminated',
          is_effective: false,
          terminated_at: '2026-08-13T09:00:00Z',
          termination_reason: 'Chiến dịch đã dừng theo yêu cầu doanh nghiệp',
        }
      : activeActivation

    if (
      path === '/api/services/admin/activations/act_top_job_001/terminate/'
      && request.method() === 'POST'
    ) {
      terminationRequest = request.postDataJSON()
      terminated = true
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        ...activation,
        status: 'terminated',
        is_effective: false,
        terminated_at: '2026-08-13T09:00:00Z',
        termination_reason: terminationRequest.reason,
      }) })
      return
    }

    const body = path === '/api/auth/refresh/'
      ? { access: 'services-activation-e2e-access' }
      : path === '/api/auth/me/'
        ? adminUser
        : path === '/api/services/admin/categories/'
          ? []
          : path === '/api/services/admin/packages/'
            ? []
            : path === '/api/services/admin/activations/summary/'
              ? {
                  activation_counts: {
                    total: 1,
                    active: terminated ? 0 : 1,
                    expired: 0,
                    terminated: terminated ? 1 : 0,
                  },
                  active_total: terminated ? 0 : 1,
                  metrics: {
                    available: true,
                    impressions: 1250,
                    views: 186,
                    saves: 21,
                    applies: 14,
                  },
                  unit_counts: { available: 2, consumed: 1, expired: 0, revoked: 0 },
                }
              : path === '/api/services/admin/activations/'
                ? { count: 1, next: null, previous: null, results: [activation] }
                : path === '/api/admin/companies/'
                  ? {
                      count: 1,
                      results: [{ public_id: 'company_acme', company_name: 'Công ty Acme' }],
                    }
                  : path === '/api/privacy/consent/'
                    ? { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
                    : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/admin/app/services?tab=activations')

  await expect(page.getByRole('heading', { name: 'Dịch vụ nhà tuyển dụng' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Dịch vụ đang chạy' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: 'Tổng quan kích hoạt dịch vụ' })).toContainText('Đang chạy thực tế')
  await expect(page.getByText('1.250', { exact: true })).toBeVisible()

  const activationRow = page.getByRole('row').filter({ hasText: 'Kỹ sư AI' })
  await expect(activationRow).toContainText('Công ty Acme')
  await expect(activationRow).toContainText('Tuyển đội AI quý 3')
  await expect(activationRow).toContainText('Đang chạy')
  await activationRow.getByRole('button', { name: 'Dừng dịch vụ' }).click()

  const dialog = page.getByRole('dialog', { name: 'Dừng dịch vụ đang chạy' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Quyền lợi chưa dùng sẽ không được hoàn lại vào kho lượt.')
  const confirmButton = dialog.getByRole('button', { name: 'Dừng dịch vụ' })
  await expect(confirmButton).toBeDisabled()

  await dialog.getByLabel('Lý do dừng dịch vụ').fill('Chiến dịch đã dừng theo yêu cầu doanh nghiệp')
  await expect(confirmButton).toBeEnabled()
  await confirmButton.click()

  await expect.poll(() => terminationRequest).toEqual({
    reason: 'Chiến dịch đã dừng theo yêu cầu doanh nghiệp',
  })
  await expect(page.getByText('Đã dừng dịch vụ và ghi nhận vào lịch sử.')).toBeVisible()
  await expect(activationRow).toContainText('Đã dừng')

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
