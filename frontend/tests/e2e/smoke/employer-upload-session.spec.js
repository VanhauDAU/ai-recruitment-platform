import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

async function setEmployerSession(page) {
  await page.route('http://localhost:8000/api/auth/refresh/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ access: 'e2e-upload-access' }),
    })
  })
  await page.route('http://localhost:8000/api/auth/me/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'usr_upload',
        email: 'hr-upload@example.com',
        role: 'employer',
        full_name: 'Nguyễn An',
        email_verified: true,
        employer_onboarding_required: false,
        employer_onboarding_step: 'complete',
        employer_job_workspace_ready: true,
      }),
    })
  })
  await page.route('http://localhost:8000/api/employer/me/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'rec_upload',
        company_role: 'owner',
        job_workspace_ready: true,
        verification_approved: false,
        candidate_data_access: false,
        dpa_status: 'missing',
        blockers: [],
        onboarding: { company_linked: true },
        company: {
          public_id: 'co_upload',
          company_name: 'Công ty Upload',
          verification_status: 'unverified',
        },
      }),
    })
  })
}

test('employer legal document is scanned before it is attached', async ({ page }) => {
  const sequence = []
  await mockPublicApi(page)
  await setEmployerSession(page)
  await page.route('http://localhost:8000/api/employer/company/documents/', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: '[]' })
      return
    }
    sequence.push('attach')
    expect(route.request().postData()).toContain('ups_employer_document')
    await route.fulfill({
      contentType: 'application/json',
      status: 201,
      body: JSON.stringify({
        id: 21,
        public_id: 'doc_scanned',
        doc_type: 'business_registration',
        file_name: 'business.pdf',
        status: 'pending',
        is_current: true,
      }),
    })
  })
  await page.route('http://localhost:8000/api/uploads/sessions/', async (route) => {
    sequence.push('create')
    await route.fulfill({
      contentType: 'application/json',
      status: 201,
      body: JSON.stringify({
        public_id: 'ups_employer_document',
        state: 'uploading',
        ready_for_submit: false,
      }),
    })
  })
  await page.route(
    'http://localhost:8000/api/uploads/sessions/ups_employer_document/content/',
    async (route) => {
      sequence.push('content')
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          public_id: 'ups_employer_document',
          state: 'scanning',
          ready_for_submit: false,
        }),
      })
    },
  )
  await page.route(
    'http://localhost:8000/api/uploads/sessions/ups_employer_document/',
    async (route) => {
      sequence.push('status')
      await new Promise((resolve) => setTimeout(resolve, 250))
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          public_id: 'ups_employer_document',
          state: 'clean',
          ready_for_submit: true,
        }),
      })
    },
  )

  await page.goto('/tuyendung/app/account/settings/gpkd')
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'business.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7 safe test document'),
  })
  await page.getByRole('button', { name: 'Lưu' }).click()

  await expect(page.getByText('Tệp đang được kiểm tra an toàn…')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText(
    'đã nhận được bộ giấy tờ xác thực của bạn',
  )
  expect(sequence).toEqual(['create', 'content', 'status', 'attach'])
  await expect.poll(() => page.evaluate(() => (
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
  ))).toBeLessThanOrEqual(1)
})
