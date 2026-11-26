import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

const API = 'http://localhost:8000/api'

function candidate(index, overrides = {}) {
  return {
    ref: `ref${index}`.padEnd(24, '0'),
    code: `UV-0${index}A1B2`,
    score: 88 - index * 9,
    level: index < 2 ? 'very_high' : 'medium',
    title: ['Lập trình viên PHP / Laravel', 'Lập trình viên Fullstack', 'Kỹ sư phần mềm'][index] || 'Lập trình viên',
    experience_months: 26 - index * 6,
    education_level: 'university',
    position_level: 'employee',
    languages: [{ code: 'en', level: 'working' }],
    matched_skills: ['PHP', 'Laravel', 'MySQL'].slice(0, 3 - index),
    matched_skill_count: 3 - index,
    job_skill_count: 4,
    experience: [
      { title: 'Lập trình viên PHP / Laravel', start: '2024-06', end: null },
      { title: 'Thực tập sinh phát triển phần mềm', start: '2023-05', end: '2023-08' },
    ],
    experience_count: 3,
    education: [{ title: 'Cử nhân Công nghệ thông tin', subtitle: 'Đại học Duy Tân, Đà Nẵng' }],
    desired_positions: ['Lập trình viên Backend', 'Lập trình viên PHP'],
    provinces: ['Đà Nẵng'],
    cv_updated_at: new Date(Date.now() - (index + 1) * 3_600_000).toISOString(),
    applied: false,
    invited: false,
    invitation_status: null,
    ...overrides,
  }
}

async function setReadyEmployerSession(page) {
  await page.route(`${API}/auth/refresh/`, (route) => route.fulfill({ contentType: 'application/json', body: '{"access":"e2e-search"}' }))
  await page.route(`${API}/auth/me/`, (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      public_id: 'usr_search',
      email: 'hr@example.com',
      role: 'employer',
      full_name: 'Nguyễn An',
      email_verified: true,
      employer_onboarding_required: false,
      employer_onboarding_step: 'complete',
    }),
  }))
  await page.route(`${API}/employer/me/`, (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      public_id: 'rec_search',
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
  }))
}

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => (
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
  ))).toBeLessThanOrEqual(1)
}

test.beforeEach(async ({ page }) => {
  await mockPublicApi(page)
  await setReadyEmployerSession(page)
  await page.route(/^http:\/\/localhost:8000\/api\/employer\/jobs\/\?/, (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ count: 1, next: null, previous: null, results: [{ public_id: 'jb_php', title: 'Lập trình viên PHP (Laravel)' }] }),
  }))
  await page.route(/^http:\/\/localhost:8000\/api\/employer\/candidate-search\/\?/, (route) => {
    const url = new URL(route.request().url())
    const results = url.searchParams.get('q') === 'Golang'
      ? []
      : [candidate(0), candidate(1, { invited: true, invitation_status: 'pending' }), candidate(2, { experience: [], experience_count: 0 })]
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ count: results.length, page_size: 20, results }),
    })
  })
})

test('employer searches anonymous CVs with filters and invites from the list', { tag: '@responsive' }, async ({ page }) => {
  const invites = []
  await page.route(/^http:\/\/localhost:8000\/api\/employer\/candidate-search\/[^/?]+\/invite\/$/, (route) => {
    invites.push(new URL(route.request().url()).pathname)
    return route.fulfill({ status: 204, body: '' })
  })

  await page.goto('/tuyendung/app/tim-ung-vien?job=jb_php')
  await expect(page.getByRole('heading', { name: 'Ứng viên phù hợp' })).toBeVisible()
  await expect(page.getByText('3 CV phù hợp')).toBeVisible()
  const first = page.locator('.cs-card').first()
  await expect(first.getByText('UV-00A1B2')).toBeVisible()
  await expect(first.getByText('Kinh nghiệm (2 năm 2 tháng)')).toBeVisible()
  await expect(first.getByText('Cử nhân Công nghệ thông tin – Đại học Duy Tân, Đà Nẵng')).toBeVisible()
  await expectNoHorizontalOverflow(page)

  // Người đã được mời không chọn được: "Chọn tất cả" lấy hai người còn lại.
  await page.getByText('Chọn tất cả').click()
  await expect(page.getByText('Đã chọn 2')).toBeVisible()
  await page.locator('.cs-bar').getByRole('button', { name: 'Mời kết nối' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Mời kết nối' }).click()
  await expect.poll(() => invites.length).toBe(2)

  const filters = page.locator('.cs-rail')
  if (!(await filters.isVisible())) await page.getByRole('button', { name: 'Bộ lọc' }).click()
  await page.getByLabel('Từ khóa cần tìm').fill('Golang')
  await page.getByRole('button', { name: 'Tìm CV' }).click()
  await expect(page.getByText('Không có ứng viên nào khớp bộ lọc.')).toBeVisible()
  await expectNoHorizontalOverflow(page)
})
