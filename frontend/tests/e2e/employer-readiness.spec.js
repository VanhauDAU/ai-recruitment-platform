import { expect, test } from '@playwright/test'
import { mockPublicApi } from './smoke/helpers'

const DENIED_PROFILE = {
  public_id: 'rec_readiness_denied',
  job_workspace_ready: true,
  verification_approved: true,
  candidate_data_access: false,
  dpa_status: 'outdated',
  blockers: [{
    code: 'dpa_outdated',
    capabilities: ['candidate_data', 'job_approval'],
    message: 'DPA cần được cập nhật trước khi xem dữ liệu ứng viên.',
    action: 'accept_current_dpa',
  }],
  onboarding: {
    phone_verified: true,
    company_linked: true,
    business_doc_submitted: true,
    candidate_dpa_submitted: true,
    dpa_accepted: true,
    verification_completed: true,
  },
}

async function setDeniedEmployerSession(page) {
  await page.route('http://localhost:8000/api/auth/refresh/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ access: 'e2e-readiness-access' }),
    })
  })
  await page.route('http://localhost:8000/api/auth/me/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'usr_readiness',
        email: 'hr@example.com',
        role: 'employer',
        full_name: 'Nguyễn An',
        email_verified: true,
        employer_onboarding_required: false,
        employer_onboarding_step: 'complete',
        employer_job_workspace_ready: true,
        employer_verification_completed: false,
      }),
    })
  })
  await page.route('http://localhost:8000/api/employer/me/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(DENIED_PROFILE),
    })
  })
}

test.beforeEach(async ({ page }) => {
  await mockPublicApi(page)
  await setDeniedEmployerSession(page)
})

test('candidate-data guard preserves a denied applications URL and makes zero sensitive calls', async ({ page }) => {
  let applicationCalls = 0
  await page.route(/http:\/\/localhost:8000\/api\/v2\/recruiter\/applications\/.*/, async (route) => {
    applicationCalls += 1
    await route.fulfill({ contentType: 'application/json', body: '[]' })
  })

  await page.goto('/tuyendung/app/applications?job=jb_private&application=app_private')

  await expect(page).toHaveURL(/\/tuyendung\/app\/applications\?job=jb_private&application=app_private$/)
  await expect(page.getByText('Dữ liệu ứng viên đang được bảo vệ')).toBeVisible()
  await expect(page.getByText(
    'DPA cần được cập nhật trước khi xem dữ liệu ứng viên.',
    { exact: true },
  )).toBeVisible()
  await expect(page.getByRole('link', { name: 'Cập nhật DPA hiện hành' }).last()).toBeVisible()
  await expect.poll(() => applicationCalls).toBe(0)
})

test('job detail keeps aggregate CV count but does not request or render candidate PII', async ({ page }) => {
  let applicationCalls = 0
  await page.route(/http:\/\/localhost:8000\/api\/v2\/recruiter\/applications\/.*/, async (route) => {
    applicationCalls += 1
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{
        public_id: 'app_private',
        candidate_name: 'Tên ứng viên không được hiển thị',
        source: 'applied',
        status: 'submitted',
      }]),
    })
  })
  await page.route('http://localhost:8000/api/jobs/mine/jb_private/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'jb_private',
        title: 'Kỹ sư bảo mật',
        status: 'active',
        deadline: '2026-09-30',
        application_count: 8,
        view_count: 20,
      }),
    })
  })

  await page.goto('/tuyendung/app/jobs/jb_private?active_tab=apply_cv')

  await expect(page).toHaveURL(/\/tuyendung\/app\/jobs\/jb_private\?active_tab=apply_cv$/)
  await expect(page.getByRole('heading', { name: 'Kỹ sư bảo mật' })).toBeVisible()
  await expect(page.getByTestId('job-metric-total-cvs')).toContainText('8')
  await expect(page.getByTestId('job-metric-applied-cvs')).toContainText('—')
  await expect(page.getByText('Dữ liệu ứng viên đang được bảo vệ')).toBeVisible()
  await expect(page.getByText('Tên ứng viên không được hiển thị')).toHaveCount(0)
  await expect.poll(() => applicationCalls).toBe(0)
})

test('campaign sensitive tabs keep their URLs without mounting Apply CV or Activity APIs', async ({ page }) => {
  let applicationCalls = 0
  let activityCalls = 0
  await page.route(/http:\/\/localhost:8000\/api\/v2\/recruiter\/applications\/.*/, async (route) => {
    applicationCalls += 1
    await route.fulfill({ contentType: 'application/json', body: '{"count":0,"results":[]}' })
  })
  await page.route(/http:\/\/localhost:8000\/api\/employer\/campaigns\/camp_private\/activities\/.*/, async (route) => {
    activityCalls += 1
    await route.fulfill({ contentType: 'application/json', body: '{"count":0,"results":[]}' })
  })
  await page.route('http://localhost:8000/api/employer/campaigns/camp_private/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'camp_private',
        name: 'Chiến dịch bảo mật',
        status: 'active',
        application_count: 5,
        job_count: 2,
      }),
    })
  })
  await page.route('http://localhost:8000/api/employer/campaigns/camp_private/report/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ application_pair_count: 5, jobs: { total: 2 } }),
    })
  })

  await page.goto('/tuyendung/app/campaigns/camp_private?active_tab=apply_cv')

  await expect(page).toHaveURL(/active_tab=apply_cv$/)
  await expect(page.getByText('Dữ liệu ứng viên đang được bảo vệ')).toBeVisible()
  await expect.poll(() => applicationCalls).toBe(0)

  if (page.viewportSize().width < 640) {
    await page.getByRole('combobox', { name: 'Chọn nội dung chiến dịch' }).click()
    await page.locator('.ant-select-dropdown:visible').getByText(/Lịch sử hoạt động/).click()
  } else {
    await page.getByRole('tab', { name: 'Lịch sử hoạt động' }).click()
  }

  await expect(page).toHaveURL(/active_tab=activity$/)
  await expect(page.getByText('Dữ liệu ứng viên đang được bảo vệ')).toBeVisible()
  await expect.poll(() => activityCalls).toBe(0)
  await expect.poll(() => applicationCalls).toBe(0)
})
