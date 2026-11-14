import { expect, test } from '@playwright/test'
import { API_ROUTE } from './helpers'

// Cổng admin Mẫu CV (CVT-4): điều hướng chung, wizard theo bước có checklist,
// trang vị trí; không cuộn ngang ở mọi kích thước.
const SECTIONS = ['nameplate', 'contact', 'summary', 'experience', 'education', 'skills'].map((key) => ({ section_key: key, region_key: 'main', is_required: key === 'nameplate' || key === 'contact', is_default_enabled: true }))
const VERSION = { id: 7, version_number: 2, version_status: 'draft', renderer_key: 'single_column_v1', default_layout_json: { regions: [{ id: 'main', row: 0, width_percent: 100, section_instance_ids: [] }] }, default_style_json: { font_family: 'Inter', font_scale: 1, line_height: 1.4, theme_color: '#00A66A' }, sections: SECTIONS, published_at: null, published_by_name: '' }
const TEMPLATE = {
  public_id: 'tpl_e2e', name: 'Gọn gàng', slug: 'gon-gang', display_name_vi: 'Gọn gàng', display_name_en: 'Tidy', lifecycle_status: 'published',
  usage_count: 3, current_published_version_id: 6, category_public_ids: [], thumbnail_url: '', sort_order: 0,
  colors: [{ public_id: 'col_1', name: 'Xanh', hex_code: '#00A66A', is_default: true }],
  versions: [VERSION, { ...VERSION, id: 6, version_number: 1, version_status: 'published', published_at: '2026-11-10T00:00:00Z', published_by_name: 'Quản trị' }],
}
const CHECKLIST = { items: [
  { key: 'names', ok: true, label: 'Có tên tiếng Việt và tiếng Anh' },
  { key: 'colors', ok: true, label: 'Có ít nhất một màu và một màu mặc định' },
  { key: 'identity', ok: true, label: 'Tên và thông tin liên hệ được đặt vào một vùng' },
  { key: 'core_sections', ok: true, label: 'Mục tiêu, kinh nghiệm, học vấn, kỹ năng không bị ẩn' },
  { key: 'test_pdf', ok: false, label: 'Đã xuất PDF thử thành công cho phiên bản này' },
] }
const POSITION = { public_id: 'cvpos_1', position_public_id: 'jobcat_1', position_name: 'Sales Online', industry_name: 'Kinh doanh', section_preset: [], keywords: [], is_active: true, sort_order: 0, field_count: 2, updated_at: '2026-11-14T00:00:00Z' }

function respond(path) {
  if (path === '/api/auth/refresh/') return { access: 'e2e-access' }
  if (path === '/api/privacy/consent/') return { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
  if (path === '/api/auth/me/') return { public_id: 'usr_admin', email: 'admin@example.com', full_name: 'Quản trị', role: 'admin', email_verified: true, admin_access: { is_superuser: true, permissions: [], memberships: [] } }
  if (path === '/api/v2/admin/cv-stats/overview/') return { templates_published: 1, cvs_created_7d: 2, cvs_created_30d: 5, cvs_uploaded_30d: 1, import_success_rate_30d: 100, ai_cost_month_usd: 0.12, top_templates: [{ public_id: 'tpl_e2e', name: 'Gọn gàng', usage_count: 3, cvs_30d: 2 }], todos: { samples_in_review: 2, positions_without_content: 0, stale_template_drafts: 0, missing_thumbnails: 0, failed_generations_7d: 0 } }
  if (path === '/api/v2/admin/cv-templates/') return [TEMPLATE]
  if (path === '/api/v2/admin/cv-templates/tpl_e2e/') return TEMPLATE
  if (path.endsWith('/checklist/')) return CHECKLIST
  if (path.endsWith('/preview/')) return { renderer_key: 'single_column_v1', document: { schema_version: 1, content_json: { schema_version: 1, locale: 'vi-VN', personal_info: { full_name: 'Nguyễn Minh Anh', headline: 'Sales Online' }, sections: [{ instance_id: 'nameplate_1', section_key: 'nameplate', title: 'Danh thiếp', enabled: true, items: [] }] }, layout_json: { regions: [{ id: 'main', row: 0, width_percent: 100, section_instance_ids: ['nameplate_1'] }] }, style_json: { theme_color: '#00A66A', font_family: 'Inter', font_scale: 1, line_height: 1.4 } } }
  if (path === '/api/v2/admin/cv-positions/') return [POSITION]
  if (path === '/api/v2/admin/cv-positions/cvpos_1/') return POSITION
  if (['/api/v2/admin/cv-categories/', '/api/v2/admin/cv-colors/'].includes(path)) return []
  if (path === '/api/v2/admin/cv-positions/coverage/') return { results: [{ position_public_id: 'jobcat_1', position_name: 'Sales Online', coverage: { 'vi-VN': { entry: 'published', junior: 'pending', mid: 'generic', senior: 'generic' }, 'en-US': { entry: 'generic', junior: 'generic', mid: 'generic', senior: 'generic' } } }] }
  return {}
}

test('admin CV portal: one-page template editor, publish checklist and position setup stay usable', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(API_ROUTE, async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(respond(new URL(route.request().url()).pathname)) })
  })
  const noHorizontalScroll = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)

  await page.goto('/admin/app/cv/overview')
  const nav = page.getByRole('navigation', { name: 'Các trang Mẫu CV' })
  await expect(nav).toBeVisible()
  await expect(page.getByText('Bản AI viết chờ duyệt')).toBeVisible()
  await expect(page.getByRole('link', { name: /Tạo mẫu CV/ })).toBeVisible()
  await noHorizontalScroll()

  await nav.getByRole('link', { name: /Mẫu CV/ }).click()
  await expect(page).toHaveURL(/\/admin\/app\/cv\/templates$/)
  await page.getByRole('button', { name: 'Tạo mẫu' }).click()
  const create = page.getByRole('dialog', { name: 'Tạo mẫu CV' })
  await expect(create.getByRole('radiogroup', { name: 'Bố cục' })).toBeVisible()
  await create.getByRole('button', { name: 'Hủy' }).click()

  await page.getByRole('link', { name: 'Gọn gàng', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Gọn gàng', level: 1 })).toBeVisible()
  await expect(page.getByText('Thông tin', { exact: true })).toBeVisible()
  // Màn hẹp: thiết lập và xem trước là hai tab; màn rộng hiện cạnh nhau.
  const previewTab = page.getByText('Xem trước', { exact: true })
  if (await previewTab.isVisible()) await previewTab.click()
  await expect(page.locator('[data-cv-page="1"]')).toBeVisible()
  await page.getByRole('button', { name: 'Xuất bản' }).click()
  const publish = page.getByRole('dialog', { name: /Xuất bản phiên bản 2/ })
  await expect(publish.getByRole('button', { name: /Xuất PDF thử/ })).toBeVisible()
  await expect(publish.getByRole('button', { name: 'Xuất bản' })).toBeDisabled()
  await publish.getByRole('button', { name: 'Để sau' }).click()
  await noHorizontalScroll()


  await nav.getByRole('link', { name: /Nội dung theo vị trí/ }).click()
  await expect(page.getByText('1/8 bản riêng')).toBeVisible()
  await expect(page.getByText('1 bản chưa xuất bản')).toBeVisible()
  await page.getByRole('link', { name: /Thiết lập/ }).click()
  await expect(page.getByRole('tab', { name: 'Các mục' })).toBeVisible()
  const receivedTab = page.getByText('CV ứng viên nhận', { exact: true })
  if (await receivedTab.isVisible()) await receivedTab.click()
  await expect(page.getByText('CV ứng viên nhận · Sales Online')).toBeVisible()
  await noHorizontalScroll()
  expect(errors).toEqual([])
})
