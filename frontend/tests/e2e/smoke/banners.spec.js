import { expect, test } from '@playwright/test'
import { API_ROUTE, mockPublicApi } from './helpers'

const COMPANY = {
  public_id: 'cmp_e2e',
  slug: 'anh-duong',
  company_name: 'Ngân hàng Ánh Dương',
  trade_name: '',
  logo_url: '',
  cover_image_url: '',
  description_excerpt: 'Ngân hàng bán lẻ',
  headquarters: 'Hà Nội',
  active_public_job_count: 12,
  industries_detail: [],
}

const BANNERS = [
  {
    id: 1, kind: 'image', title: 'Banner Ánh Dương', eyebrow: '', subtitle: '', theme: 'green',
    image_url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', cta_label: '', cta_url: '/viec-lam?search=ngan-hang',
    cta_secondary_label: '', cta_secondary_url: '', company: null,
  },
  {
    id: 2, kind: 'company', title: '', eyebrow: '', subtitle: '', theme: 'blue', image_url: '',
    cta_label: '', cta_url: '', cta_secondary_label: '', cta_secondary_url: '', company: COMPANY,
  },
]

async function routeBannerApi(page, { banners = BANNERS, onCreate } = {}) {
  await mockPublicApi(page)
  await page.route(API_ROUTE, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/public/site/banners/') return route.fulfill({ json: banners })
    if (path === '/api/auth/refresh/') return route.fulfill({ json: { access: 'e2e-access' } })
    if (path === '/api/auth/me/') {
      return route.fulfill({
        json: { public_id: 'usr_admin', email: 'admin@example.com', full_name: 'System Admin', role: 'admin', email_verified: true, admin_access: { is_superuser: false } },
      })
    }
    if (path === '/api/admin/site/banners/' && request.method() === 'GET') {
      return route.fulfill({ json: banners.map((banner, order) => ({ ...banner, placement: 'home_hero', order, is_active: true, schedule_state: 'running', image_path: '', starts_at: null, ends_at: null })) })
    }
    if (path === '/api/admin/site/banners/' && request.method() === 'POST') {
      onCreate?.(request.postDataJSON())
      return route.fulfill({ status: 201, json: { id: 9 } })
    }
    return route.fallback()
  })
}

test('home carousel shows admin banners on desktop and phone', { tag: '@responsive' }, async ({ page }) => {
  await routeBannerApi(page)
  await page.goto('/')
  const carousel = page.getByRole('region', { name: 'Banner nổi bật' })
  await expect(carousel).toBeVisible()
  await expect(carousel.getByRole('link', { name: 'Banner Ánh Dương' })).toHaveAttribute('href', '/viec-lam?search=ngan-hang')

  // Header dính và lớp cookie có thể che chấm điều hướng trên điện thoại.
  await carousel.getByRole('button', { name: 'Chuyển đến banner 2' }).dispatchEvent('click')
  await expect(carousel.getByRole('link', { name: 'Xem 12 việc làm' })).toHaveAttribute('href', '/cong-ty/anh-duong?tab=viec-lam')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('admin banners: list homepage slides and create a promo slide', { tag: '@responsive' }, async ({ page }) => {
  let created
  await routeBannerApi(page, { onCreate: (payload) => { created = payload } })
  await page.goto('/admin/app/banner')
  await expect(page.getByRole('heading', { name: 'Banner quảng bá' })).toBeVisible()
  await expect(page.getByText('Banner Ánh Dương')).toBeVisible()

  await page.getByRole('button', { name: 'Thêm banner' }).click()
  await page.getByText('Bố cục chữ', { exact: true }).click()
  await page.getByRole('textbox', { name: 'Tiêu đề' }).fill('Ngày hội việc làm IT')
  await page.getByRole('textbox', { name: 'Link của nút' }).fill('/viec-lam?search=IT')
  await page.getByRole('button', { name: 'Tạo banner' }).click()
  await expect.poll(() => created).toMatchObject({ kind: 'promo', title: 'Ngày hội việc làm IT', cta_url: '/viec-lam?search=IT', placement: 'home_hero' })
})
