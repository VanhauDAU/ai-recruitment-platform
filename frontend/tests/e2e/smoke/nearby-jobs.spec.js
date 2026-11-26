import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

// Việc làm gần tôi (ADR-0029): GPS giả lập, API giả lập, style VietMap giả (không tải tile thật).
const ORIGIN = {
  latitude: 15.887,
  longitude: 108.247,
  radius_km: 10,
  ward: { id: 1, name: 'Phường Điện Bàn', slug: 'phuong-dien-ban-20551', province_id: 2, province_name: 'Thành phố Đà Nẵng' },
}

function job(slug, title, distance) {
  return {
    public_id: slug,
    slug,
    title,
    company_name: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ VÀ SẢN XUẤT RAINSCALES VIỆT NAM',
    company_logo_url: '',
    locations_detail: [{ id: 2, name: 'Thành phố Đà Nẵng', level: 'province' }],
    salary_type: 'from',
    salary_min: 7_500_000,
    currency: 'VND',
    deadline: '2026-12-17',
    distance_km: distance,
    match_kind: 'distance',
    nearby_workplace_count: 1,
    nearest_workplace: { id: 1, display: 'Phường Điện Bàn, Thành phố Đà Nẵng', latitude: 15.89, longitude: 108.25, precision: 'exact', distance_km: distance },
  }
}

async function mockNearbyApi(page) {
  await mockPublicApi(page)
  await page.route('http://localhost:8000/api/public/site/settings/', (route) => route.fulfill({
    json: { map_style_url: 'https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=e2e', map_attribution: '© VIETMAP' },
  }))
  await page.route('https://maps.vietmap.vn/**', (route) => route.fulfill({ json: { version: 8, sources: {}, layers: [] } }))
  const requests = []
  await page.route(/\/api\/public\/jobs\/nearby\/(?:\?.*)?$/, (route) => {
    const url = new URL(route.request().url())
    requests.push(Object.fromEntries(url.searchParams))
    const radius = Number(url.searchParams.get('radius_km'))
    const results = radius >= 10
      ? [job('nhan-vien-phu-xe', 'Nhân Viên Phụ Xe & Làm Kho', 3.4), job('tai-xe-giao-hang', 'Tài Xế Giao Hàng (Bằng B2)', 3.4)]
      : []
    return route.fulfill({
      json: { count: results.length, next: null, previous: null, results, origin: { ...ORIGIN, radius_km: radius }, expand_suggestion: results.length ? null : { radius_km: 10, count: 2 } },
    })
  })
  await page.route(/\/api\/public\/jobs\/nearby\/map\/(?:\?.*)?$/, (route) => route.fulfill({
    json: { origin: ORIGIN, truncated: false, points: [] },
  }))
  return requests
}

test('candidate finds jobs near the current location and widens the radius', { tag: '@responsive' }, async ({ page, context }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 15.8871, longitude: 108.2468 })
  const requests = await mockNearbyApi(page)

  await page.goto('/viec-lam-gan-ban?r=5')
  await expect(page.getByText('Chọn vị trí để xem việc làm quanh bạn')).toBeVisible()

  await page.getByRole('button', { name: /Dùng vị trí của tôi/ }).click()
  await expect(page.getByRole('heading', { name: 'Việc làm gần tôi tại Đà Nẵng' })).toBeVisible()
  // Vị trí hiện tại được điền vào ô vị trí, kèm phường gần nhất.
  await expect(page.getByTitle('Vị trí của bạn · P. Điện Bàn, Đà Nẵng')).toBeVisible()
  // Tọa độ được làm tròn ~110 m trước khi gửi và không lên URL.
  await expect.poll(() => requests.at(-1)).toMatchObject({ lat: '15.887', lng: '108.247', radius_km: '5' })
  expect(page.url()).not.toContain('15.88')

  await page.getByRole('button', { name: 'Mở rộng 10 km (2 việc)' }).click()
  await expect(page.getByText('Nhân Viên Phụ Xe & Làm Kho')).toBeVisible()
  await expect(page.getByText('3,4 km').first()).toBeVisible()
  const project = test.info().project.name
  if (project.startsWith('mobile')) {
    // Điện thoại: bán kính là ô chọn, bộ lọc phụ nằm trong bảng trượt.
    await expect(page.locator('.nearby-filter__radius-select')).toContainText('10 km')
    await page.getByRole('button', { name: 'Bộ lọc' }).click()
    await expect(page.getByRole('checkbox', { name: 'Gồm việc làm từ xa' })).toBeVisible()
    await page.getByRole('button', { name: 'Xem kết quả' }).click()
    await expect(page.getByRole('button', { name: 'Xem kết quả' })).toBeHidden()
  } else {
    await expect(page.getByRole('radio', { name: '10 km' })).toHaveAttribute('aria-checked', 'true')
  }
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  await expect.poll(overflow).toBe(0)
  // Phần tràn có thể bị lớp cha cắt (trang không cuộn ngang) nên đo trực tiếp: thẻ việc
  // làm không được rộng hơn khung lọc phía trên (tên công ty dài, không xuống dòng).
  const cardOverhang = () => page.evaluate(() => {
    const frame = document.querySelector('.nearby-filter').getBoundingClientRect().right
    return Math.max(...[...document.querySelectorAll('.nearby-card')].map((card) => card.getBoundingClientRect().right - frame))
  })
  await expect.poll(cardOverhang).toBeLessThanOrEqual(0.5)

  // Dưới lg danh sách và bản đồ là hai chế độ xem; canvas bản đồ không được đẩy trang rộng ra.
  const mapView = page.getByTitle('Bản đồ', { exact: true })
  const isDesktop = project.startsWith('desktop')
  await expect(mapView).toBeVisible({ visible: !isDesktop })
  if (!isDesktop) await mapView.click()
  await expect(page.locator('.maplibregl-canvas')).toBeVisible()
  await expect.poll(overflow).toBe(0)
})

test('denied location access points the candidate to the ward picker', async ({ page, context }) => {
  await context.clearPermissions()
  await mockNearbyApi(page)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (_, fail) => fail({ code: 1 }) },
    })
  })

  await page.goto('/viec-lam-gan-ban')
  await page.getByRole('button', { name: /Dùng vị trí của tôi/ }).click()
  await expect(page.getByRole('alert')).toContainText('Bạn đã chặn quyền vị trí')
})
