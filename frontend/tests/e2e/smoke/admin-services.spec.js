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
