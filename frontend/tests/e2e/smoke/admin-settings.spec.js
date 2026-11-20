import { expect, test } from '@playwright/test'
import { API_ROUTE } from './helpers'

// Trang Cấu hình hệ thống (ADR-0026): thanh bên 3 khu, tìm kiếm, nút "?",
// lưu chung và hỏi lại khi bật bảo trì; không cuộn ngang ở mọi kích thước.
const row = (key, label, section, overrides = {}) => ({
  key, label, section, value: '', default_value: '', value_type: 'text', options: {},
  description: `Mô tả ${label.toLowerCase()}`, help: '', is_public: true, updated_at: '2026-11-20T08:00:00Z', ...overrides,
})
const GROUPS = [
  {
    key: 'brand', label: 'Thương hiệu', area: 'content', area_label: 'Giao diện & nội dung',
    settings: [
      row('site_name', 'Tên site', 'Nhận diện', { value: 'ProCV', default_value: 'ProCV', help: 'Dùng ở header, footer và email.', options: { applies_to: ['Email', 'SEO'], max_length: 60 } }),
      row('site_tagline', 'Slogan', 'Nhận diện', { value: 'Nền tảng việc làm & AI Career Coach' }),
      row('brand_primary_color', 'Màu thương hiệu chính', 'Màu sắc', { value: '#19734e', default_value: '#00b14f', value_type: 'color' }),
    ],
  },
  {
    key: 'employer', label: 'Nhà tuyển dụng & xác thực', area: 'recruiting', area_label: 'Nghiệp vụ tuyển dụng',
    settings: [
      row('employer_stats', 'Số liệu trang NTD', 'Trang giới thiệu nhà tuyển dụng', {
        value_type: 'json', value: [{ value: '60.000+', label_vi: 'việc làm', label_en: 'jobs' }],
        options: { schema: { item: 'object', fields: ['value', 'label_vi', 'label_en'], required: ['value', 'label_vi'] } },
      }),
    ],
  },
  {
    key: 'operations', label: 'Vận hành', area: 'compliance', area_label: 'Tuân thủ & vận hành',
    settings: [
      row('maintenance_mode', 'Chế độ bảo trì', 'Bảo trì', { value: false, default_value: false, value_type: 'boolean', options: { risky: 'on' } }),
      row('maintenance_message', 'Thông báo bảo trì', 'Bảo trì', { value: 'Đang bảo trì', options: { depends_on: 'maintenance_mode' } }),
    ],
  },
]
const PARAMETERS = [{ key: 'auth', label: 'Đăng nhập & phiên', items: [
  { key: 'AUTH_SESSION_IDLE_TIMEOUT_SECONDS', label: 'Tự đăng xuất khi không hoạt động', value: '30 phút', source: 'env', help: '' },
] }]

function respond(path, method) {
  if (path === '/api/auth/refresh/') return { access: 'e2e-access' }
  if (path === '/api/public/privacy/consent/') return { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
  if (path === '/api/auth/me/') return { public_id: 'usr_admin', email: 'admin@example.com', full_name: 'Quản trị', role: 'admin', email_verified: true, admin_access: { is_superuser: true } }
  if (path === '/api/admin/site/settings/' && method === 'PATCH') return { updated: ['maintenance_mode'], errors: {}, values: { maintenance_mode: true }, display_values: {} }
  if (path === '/api/admin/site/settings/') return { groups: GROUPS }
  if (path === '/api/admin/site/system-parameters/') return { groups: PARAMETERS }
  return {}
}

test('admin settings: grouped sidebar, search, help and confirmed risky save', { tag: '@responsive' }, async ({ page }) => {
  const errors = []
  const patches = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(API_ROUTE, async (route) => {
    const request = route.request()
    if (request.method() === 'PATCH') patches.push(request.postDataJSON())
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(respond(new URL(request.url()).pathname, request.method())) })
  })
  const noHorizontalScroll = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)

  await page.goto('/admin/app/settings?group=general')
  const nav = page.getByRole('navigation', { name: 'Nhóm cấu hình' })
  await expect(nav.getByRole('button', { name: 'Thương hiệu' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('Chữ trắng trên màu chính', { exact: false })).toBeVisible()
  await noHorizontalScroll()

  await page.getByRole('button', { name: 'Giải thích: Tên site' }).click()
  await expect(page.getByText('Dùng ở header, footer và email.')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('textbox', { name: 'Tìm cấu hình' }).fill('số liệu')
  await expect(page.getByText('1 kết quả cho "số liệu"')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Giá trị 1' })).toHaveValue('60.000+')
  await noHorizontalScroll()

  await nav.getByRole('button', { name: 'Vận hành' }).click()
  await expect(page.getByText('Tự đăng xuất khi không hoạt động')).toBeVisible()
  await expect(page.getByText('Bật "Chế độ bảo trì" để dùng mục này.')).toBeVisible()
  await page.getByRole('switch').click()
  await expect(page.getByText('1 thay đổi chưa lưu')).toBeVisible()
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
  const confirm = page.getByRole('dialog', { name: 'Xác nhận thay đổi quan trọng' })
  await expect(confirm).toContainText('Chế độ bảo trì: Tắt → Bật')
  await confirm.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(page.getByText('Chưa có thay đổi')).toBeVisible()
  expect(patches).toEqual([{ values: { maintenance_mode: true } }])
  await noHorizontalScroll()
  expect(errors).toEqual([])
})
