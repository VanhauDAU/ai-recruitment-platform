import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

async function setReadyEmployerSession(page) {
  await page.route('http://localhost:8000/api/auth/refresh/', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '{"access":"e2e-notice"}' })
  })
  await page.route('http://localhost:8000/api/auth/me/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'usr_notice',
        email: 'hr@example.com',
        role: 'employer',
        full_name: 'Nguyễn An',
        email_verified: true,
        employer_onboarding_required: false,
        employer_onboarding_step: 'complete',
      }),
    })
  })
  await page.route('http://localhost:8000/api/employer/me/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'rec_notice',
        job_workspace_ready: true,
        verification_approved: true,
        candidate_data_access: true,
        dpa_status: 'current',
        blockers: [],
        onboarding: {
          phone_verified: true,
          company_linked: true,
          business_doc_submitted: true,
          business_doc_approved: true,
          candidate_dpa_submitted: true,
          dpa_accepted: true,
        },
      }),
    })
  })
}

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => (
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
  ))).toBeLessThanOrEqual(1)
}

test.beforeEach(async ({ page }) => {
  await mockPublicApi(page)
  await setReadyEmployerSession(page)
  await page.route('http://localhost:8000/api/employer/notifications/unread-count/', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '{"count":1}' })
  })
  await page.route(/http:\/\/localhost:8000\/api\/employer\/notifications\/\?.*/, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        count: 1,
        next: null,
        previous: null,
        results: [{
          public_id: 'eno_1',
          event_type: 'verification_changes_requested',
          title: 'Hồ sơ xác thực cần bổ sung',
          message: 'Vui lòng bổ sung giấy đăng ký doanh nghiệp.',
          action_path: '/tuyendung/app/employer-verify',
          metadata: { case_public_id: 'evc_1' },
          is_read: false,
          read_at: null,
          created_at: '2026-08-10T02:00:00Z',
        }],
      }),
    })
  })
  await page.route('http://localhost:8000/api/employer/notifications/eno_1/read/', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '{"public_id":"eno_1","is_read":true}' })
  })
  await page.route(/http:\/\/localhost:8000\/api\/employer\/activities\/\?.*/, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        count: 1,
        next: null,
        previous: null,
        results: [{
          public_id: 'eac_1',
          event_type: 'verification_changes_requested',
          summary: 'Hồ sơ xác thực cần bổ sung',
          subject_public_id: 'evc_1',
          metadata: {},
          actor_name: 'Quản trị viên',
          occurred_at: '2026-08-10T02:00:00Z',
        }],
      }),
    })
  })
})

test('employer notification and activity routes are usable and responsive', async ({ page }) => {
  await page.goto('/tuyendung/app/notifications')
  await expect(page.getByRole('heading', { name: 'Thông báo hệ thống' })).toBeVisible()
  await expect(page.getByText('Hồ sơ xác thực cần bổ sung').first()).toBeVisible()
  await expect(page.locator('.ant-badge-count')).toContainText('1')
  await expectNoHorizontalOverflow(page)

  await page.goto('/tuyendung/app/activities')
  await expect(page.getByRole('heading', { name: 'Lịch sử hoạt động' })).toBeVisible()
  await expect(page.getByText('Thực hiện bởi: Quản trị viên')).toBeVisible()
  await expectNoHorizontalOverflow(page)
})
