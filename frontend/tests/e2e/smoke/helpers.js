import { expect } from '@playwright/test'

export const API_ROUTE = /^https?:\/\/[^/]+\/api\/.*$/

// Mirrors GET /api/public/applications/rules/ (the limits the server enforces).
export const APPLICATION_RULES = {
  max_submissions_per_job: 3,
  reapply_cooldown_seconds: 300,
  candidate_reminder_after_days: 3,
  candidate_reminder_interval_days: 3,
  max_candidate_reminders: 2,
  auto_reject_default_days: 21,
  auto_reject_after_day_choices: [
    { value: 14, label: '2 tuần' },
    { value: 21, label: '3 tuần' },
    { value: 28, label: '4 tuần' },
    { value: 42, label: '6 tuần' },
    { value: 56, label: '8 tuần' },
  ],
  auto_rejection_warning_days: 3,
  auto_rejection_email_grace_days: 3,
}

export async function mockPublicApi(page) {
  await page.route('http://localhost:8000/api/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (
      path === '/api/auth/refresh/'
      && route.request().headers()['x-session-probe'] === '1'
    ) {
      await route.fulfill({ status: 204, body: '' })
      return
    }
    if (path === '/api/auth/me/' || path === '/api/auth/refresh/') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Authentication credentials were not provided.' }),
      })
      return
    }
    const body = path === '/api/public/jobs/best/'
      ? []
      : path === '/api/public/jobs/'
        ? { count: 0, results: [] }
        : path === '/api/public/jobs/stats/'
          ? {
              candidates: 0,
              employers: 0,
              active_jobs: 0,
              new_jobs_24h: 0,
              growth: [],
              demand: [],
              salary_demand: [],
              latest_jobs: [],
              featured_employers: [],
            }
      : path === '/api/public/site/banners/'
        ? []
      : path === '/api/public/site/link-groups/'
        ? []
      : path === '/api/public/site/announcements/active/'
        ? { remote_enabled: false, items: [], next_transition_at: null }
      : path === '/api/public/privacy/consent/'
        // Consent đã quyết định -> banner cookie không che các nút trong smoke test.
        ? { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
        : path === '/api/employer/dashboard/'
          ? {
              account: {
                public_id: '48261937', company_name: 'Công ty Acme',
                company_size: '25-99', work_location_name: 'Hà Nội',
                verification: { email_verified: true, phone_verified: false, company_linked: false, business_doc_submitted: false, candidate_dpa_submitted: false, dpa_accepted: false, representative_verified: false, first_job_posted: false },
              },
              summary: { jobs_total: 0, jobs_active: 0, jobs_draft: 0, job_views: 0, applications_total: 0, applications_new: 0, applications_shortlisted: 0, applications_interviewed: 0 },
              application_activity: Array.from({ length: 7 }, (_, index) => ({ date: `2026-07-${String(12 + index).padStart(2, '0')}`, count: 0 })),
              recruitment_need: null, recent_jobs: [], recent_applications: [],
            }
        : path === '/api/public/locations/'
          ? url.searchParams.get('level') === 'ward'
            ? []
            : [{ id: 1, name: 'Hà Nội', level: 'province' }, { id: 2, name: 'TP. Hồ Chí Minh', level: 'province' }]
          : path === '/api/public/cv-templates/'
            ? { count: 0, next: null, previous: null, results: [] }
            : ['/api/public/jobs/categories/', '/api/employer/industries/'].includes(path)
            ? []
          : path === '/api/auth/sessions/'
            ? []
          : path === '/api/public/applications/rules/'
            ? APPLICATION_RULES
            : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
}

export async function expectAnimatedLoginButton(page) {
  const button = page.getByTestId('login-submit')
  const track = button.locator('.submit-btn__track')

  await expect(button).toBeVisible()
  await expect(button).toHaveAccessibleName('Đăng nhập')
  await expect(button.locator('.submit-btn__label')).toHaveCount(2)

  // Thiết bị cảm ứng không có hover; desktop kiểm tra thêm trạng thái chuyển động.
  if (page.viewportSize().width >= 1024) {
    await button.hover()
    await expect.poll(
      () => track.evaluate((element) => getComputedStyle(element).transform),
    ).not.toBe('none')
  }
}

// CI runners occasionally drop a click on an Ant Design tab, leaving the
// previous tab selected. Click again until the tab reports itself selected.
export async function selectTab(page, name) {
  const tab = page.getByRole('tab', { name })
  await expect(async () => {
    await tab.click()
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 })
  }).toPass()
}

// Same failure mode for Ant Design selects: the option click can land while the
// dropdown is still animating, leaving the field empty. Retry until the select
// itself displays the chosen option instead of trusting the click.
export async function chooseSelectOption(page, combobox, optionText) {
  const select = combobox.locator('xpath=ancestor::div[contains(concat(" ", @class, " "), " ant-select ")][1]')
  const option = page.locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: optionText })
  await expect(async () => {
    if (!(await option.isVisible())) await combobox.click()
    await option.click({ timeout: 2_000 })
    await expect(select).toContainText(optionText, { timeout: 1_000 })
  }).toPass()
}
