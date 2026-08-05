import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

const REVISION = {
  number: 1,
  message_vi: 'Hệ thống sẽ bảo trì lúc 22:00.',
  message_en: 'Scheduled maintenance at 22:00.',
  badge_vi: 'Bảo trì',
  badge_en: 'Maintenance',
  icon: 'wrench',
  cta_label_vi: 'Xem trạng thái',
  cta_label_en: 'View status',
  cta_url: '/trang-thai',
  kind: 'maintenance',
  surfaces: ['candidate', 'admin_workspace'],
  auth_audiences: ['guest', 'authenticated'],
  roles: [],
  include_path_prefixes: [],
  exclude_path_prefixes: [],
  starts_at: null,
  ends_at: '2026-08-03T01:00:00Z',
  priority: 80,
  animation: 'slide',
  display_seconds: 6,
  dismiss_mode: 'close',
  snooze_seconds: null,
  creator: { public_id: 'usr_admin', name: 'System Admin' },
  is_active: false,
  published_at: null,
  created_at: '2026-07-29T06:00:00Z',
}

function announcementDetail(overrides = {}) {
  return {
    public_id: 'ann_e2e',
    internal_name: 'Bảo trì hệ thống',
    lifecycle_state: 'draft',
    presentation_status: 'draft',
    kind: null,
    surfaces: [],
    starts_at: null,
    ends_at: null,
    priority: null,
    active_revision_number: null,
    draft_revision_number: 1,
    creator: { public_id: 'usr_admin', name: 'System Admin' },
    publisher: null,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    dismisses: 0,
    published_at: null,
    created_at: '2026-07-29T06:00:00Z',
    updated_at: '2026-07-29T06:00:00Z',
    revision_token: 1,
    dismissal_version: 1,
    paused_at: null,
    archived_at: null,
    revisions: [REVISION],
    audit_events: [{
      public_id: 'alog_e2e',
      action: 'announcement_create',
      source: 'admin',
      actor: { public_id: 'usr_admin', name: 'System Admin' },
      payload: { revision: 1 },
      created_at: '2026-07-29T06:00:00Z',
    }],
    ...overrides,
  }
}

function listItem(detail) {
  const active = detail.revisions.find((revision) => revision.is_active)
  return {
    ...detail,
    kind: active?.kind || null,
    surfaces: active?.surfaces || [],
    starts_at: active?.starts_at || null,
    ends_at: active?.ends_at || null,
    priority: active?.priority ?? null,
    revisions: undefined,
    audit_events: undefined,
  }
}

async function routeAdminApi(page, permissions) {
  let detail = announcementDetail()
  let stalePause = true
  await mockPublicApi(page)
  await page.route('http://localhost:8000/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    let status = 200
    let body = {}

    if (path === '/api/auth/refresh/') body = { access: 'e2e-access' }
    else if (path === '/api/auth/me/') {
      body = {
        public_id: 'usr_admin',
        email: 'admin@example.com',
        full_name: 'System Admin',
        role: 'admin',
        email_verified: true,
        admin_access: {
          is_superuser: false,
          permissions,
          memberships: [],
        },
      }
    } else if (path === '/api/site/admin/announcements/' && request.method() === 'GET') {
      body = { count: 1, next: null, previous: null, results: [listItem(detail)] }
    } else if (path === '/api/site/admin/announcements/' && request.method() === 'POST') {
      const payload = request.postDataJSON()
      detail = announcementDetail({
        internal_name: payload.internal_name,
        revisions: [{ ...payload.revision, ...REVISION, message_vi: payload.revision.message_vi }],
      })
      status = 201
      body = detail
    } else if (
      path === `/api/site/admin/announcements/${detail.public_id}/metrics/`
    ) {
      body = {
        public_id: detail.public_id,
        date_from: '2026-07-01',
        date_to: '2026-07-29',
        consent_notice: 'Số liệu chỉ gồm người dùng đã bật Analytics.',
        summary: {
          impressions: 125,
          unique_impressions: 110,
          clicks: 25,
          unique_clicks: 20,
          dismisses: 5,
          ctr: 20,
          dismiss_rate: 4,
        },
        daily: [{
          date: '2026-07-29',
          surface: 'candidate',
          impressions: 125,
          unique_impressions: 110,
          clicks: 25,
          unique_clicks: 20,
          dismisses: 5,
          ctr: 20,
          dismiss_rate: 4,
        }],
      }
    } else if (path === `/api/site/admin/announcements/${detail.public_id}/`) {
      body = detail
    } else if (path.endsWith('/publish/')) {
      const payload = request.postDataJSON()
      const revisions = detail.revisions.map((revision) => ({
        ...revision,
        is_active: revision.number === payload.revision,
        published_at: revision.number === payload.revision
          ? '2026-07-29T07:00:00Z'
          : revision.published_at,
      }))
      const active = revisions.find((revision) => revision.is_active)
      detail = {
        ...detail,
        lifecycle_state: 'published',
        presentation_status: 'live',
        revision_token: detail.revision_token + 1,
        active_revision_number: active.number,
        draft_revision_number: null,
        kind: active.kind,
        surfaces: active.surfaces,
        priority: active.priority,
        revisions,
      }
      body = detail
    } else if (path.endsWith('/pause/')) {
      if (stalePause) {
        stalePause = false
        detail = { ...detail, revision_token: detail.revision_token + 1 }
        status = 409
        body = {
          code: 'announcement_revision_stale',
          detail: 'Thông báo đã được thay đổi ở phiên khác.',
          current_revision_token: detail.revision_token,
        }
      } else {
        detail = {
          ...detail,
          lifecycle_state: 'paused',
          presentation_status: 'paused',
          revision_token: detail.revision_token + 1,
        }
        body = detail
      }
    } else if (path === '/api/privacy/consent/') {
      body = { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
    } else if (path.endsWith('/summary/')) {
      body = { totals: {}, queues: {}, verification: {} }
    }

    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
}

test('announcement admin: create, publish and stale conflict stay responsive', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await routeAdminApi(page, [
    'announcement.view',
    'announcement.manage',
    'announcement.publish',
  ])

  await page.goto('/admin/app/announcements')
  await expect(page).toHaveURL('/admin/app/announcements')
  await page.waitForLoadState('networkidle')
  expect(pageErrors).toEqual([])
  await expect(page.getByRole('heading', { name: 'Trung tâm thông báo' })).toBeVisible()
  await expect(page.getByText('Bảo trì hệ thống')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /Cập nhật/ }))
    .toHaveAttribute('aria-sort', 'descending')
  await page.getByRole('button', { name: 'Tạo thông báo' }).click()
  await page.getByRole('textbox', { name: 'Tên vận hành' })
    .fill('Thông báo tạo từ E2E')
  await page.getByRole('textbox', { name: 'Nội dung tiếng Việt' })
    .fill('Nội dung mới được kiểm tra qua trình soạn thảo nhiều bước.')
  await page.getByRole('button', { name: 'Tiếp tục' }).click()

  await page.getByText('Trang trong hệ thống', { exact: true }).click()
  await page.getByRole('textbox', { name: 'Nhãn CTA tiếng Việt' })
    .fill('Dành cho nhà tuyển dụng')
  await page.getByRole('combobox', { name: 'Trang đích trong hệ thống' })
    .fill('dịch vụ')
  await page.getByText('Dịch vụ · Công khai — /tuyendung/dich-vu', { exact: true })
    .click()
  await expect(page.getByText('Marketing NTD · Công khai')).toBeVisible()
  await expect(page.getByText(/CTA sẽ mở sang cổng khác/)).toBeVisible()
  await page.getByRole('button', { name: 'Tiếp tục' }).click()

  await page.getByRole('combobox', { name: 'Chỉ hiển thị tại các nhóm trang' })
    .click()
  await page.getByText('Danh sách việc làm · Công khai — /viec-lam', { exact: true })
    .click()
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await page.getByRole('button', { name: 'Tiếp tục' }).click()

  await expect(page.getByRole('region', { name: 'Xem trước thông báo' }))
    .toContainText('Nội dung mới được kiểm tra qua trình soạn thảo nhiều bước.')
  await expect(page.getByRole('region', { name: 'Xem trước thông báo' }))
    .not.toContainText('Nội dung thông báo sẽ xuất hiện tại đây.')
  await expect(page.getByRole('region', { name: 'Mô phỏng ưu tiên' })).toBeVisible()
  await page.getByRole('button', { name: 'Tạo bản nháp' }).click()
  await expect(page.getByRole('tab', { name: 'Revision (1)' })).toBeVisible()
  await page.getByRole('tab', { name: 'Hiệu quả' }).click()
  await expect(page.getByRole('region', { name: 'Hiệu quả thông báo' }))
    .toContainText('Số liệu chỉ gồm người dùng đã bật Analytics.')
  await expect(page.getByRole('region', { name: 'Hiệu quả thông báo' }))
    .toContainText('125')
  await page.getByRole('tab', { name: 'Audit (1)' }).click()
  await expect(
    page.getByRole('tabpanel', { name: 'Audit (1)' })
      .getByText('Tạo thông báo', { exact: true }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Phát hành' }).click()
  await expect(page.getByRole('button', { name: 'Tạm dừng' })).toBeVisible()
  await page.getByRole('button', { name: 'Tạm dừng' }).click()
  await expect(page.getByText('Dữ liệu đã thay đổi ở phiên khác')).toBeVisible()
  await page.getByRole('button', { name: 'Tải bản mới nhất' }).click()
  await expect(page.getByText('Dữ liệu đã thay đổi ở phiên khác')).toBeHidden()
  await page.getByRole('button', { name: 'Tạm dừng' }).click()
  await expect(page.getByRole('button', { name: 'Tiếp tục' })).toBeVisible()

  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )
  expect(pageErrors).toEqual([])
})

test('announcement admin: view-only permission exposes no mutation controls', async ({ page }) => {
  await routeAdminApi(page, ['announcement.view'])
  await page.goto('/admin/app/announcements')
  await expect(page).toHaveURL('/admin/app/announcements')
  await expect(page.getByRole('heading', { name: 'Trung tâm thông báo' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tạo thông báo' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Chi tiết' }).click()
  await expect(page.getByRole('button', { name: 'Tạo revision' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Phát hành' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Nhân bản' })).toHaveCount(0)
})
