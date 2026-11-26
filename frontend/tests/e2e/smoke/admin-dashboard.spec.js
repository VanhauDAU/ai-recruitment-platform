import { expect, test } from '@playwright/test'
import { API_ROUTE } from './helpers'

const adminUser = {
  public_id: 'usr_root',
  email: 'root@example.com',
  full_name: 'Lê Minh Quản',
  role: 'admin',
  status: 'active',
  admin_access: { is_superuser: false },
}

const hoursAgo = (hours) => new Date(Date.now() - hours * 36e5).toISOString()

function dashboard(days) {
  const activity = Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.now() - (days - 1 - index) * 864e5)
    const wave = Math.round(6 + 4 * Math.sin(index / 2))
    return {
      date: date.toISOString().slice(0, 10),
      candidates: wave + 3,
      employers: Math.round(wave / 3),
      jobs: wave,
      applications: wave * 4 + (index % 5),
    }
  })
  return {
    generated_at: new Date().toISOString(),
    period: { days, start: activity[0].date, end: activity.at(-1).date },
    queues: [
      { key: 'recruiter_verification', count: 4, overdue: 0, oldest_at: hoursAgo(50), sla_hours: 72 },
      { key: 'domain_verification', count: 0, overdue: 0, oldest_at: null, sla_hours: 72 },
      { key: 'company_updates', count: 2, overdue: 0, oldest_at: hoursAgo(6), sla_hours: 72 },
      { key: 'job_reports', count: 3, overdue: 1, oldest_at: hoursAgo(60), sla_hours: 48 },
      { key: 'company_reports', count: 0, overdue: 0, oldest_at: null, sla_hours: 48 },
      { key: 'job_resubmissions', count: 1, overdue: 0, oldest_at: hoursAgo(2), sla_hours: 48 },
      { key: 'company_content_changes', count: 1, overdue: 0, oldest_at: hoursAgo(20), sla_hours: 48 },
    ],
    kpis: {
      candidates: { current: 284, previous: 231 },
      employers: { current: 61, previous: 70 },
      jobs: { current: 198, previous: 198 },
      applications: { current: 1124, previous: 0 },
    },
    activity,
    totals: { candidates: 5210, employers: 840, companies: 512, jobs_active: 1386 },
    jobs: {
      states: { draft: 42, active: 1386, hidden: 57, expired: 310, closed: 128 },
      held: 9,
      without_applications: 412,
      expiring_soon: 76,
    },
    applications: {
      funnel: { submitted: 1124, viewed: 803, shortlisted: 296, interviewed: 118, accepted: 37, rejected: 210, withdrawn: 14 },
      avg_first_view_hours: 19.4,
      stale_unviewed: 58,
    },
    trust: {
      job_reports: { new: 17, upheld: 6, dismissed: 8 },
      company_reports: { new: 3, upheld: 1, dismissed: 1 },
      restricted_accounts: { candidates: 12, employers: 4 },
      compliance_holds_active: 2,
    },
    content: { knowledge_review_overdue: 3 },
    top_categories: [
      { public_id: 'c1', name: 'Kinh doanh, bán hàng', active_jobs: 214, applications: 260 },
      { public_id: 'c2', name: 'Lập trình viên Backend', active_jobs: 162, applications: 301 },
      { public_id: 'c3', name: 'Chăm sóc khách hàng', active_jobs: 120, applications: 98 },
      { public_id: 'c4', name: 'Kế toán tổng hợp', active_jobs: 91, applications: 77 },
      { public_id: 'c5', name: 'Marketing nội dung', active_jobs: 66, applications: 120 },
    ],
    ai: {
      match_analyses: { total: 640, succeeded: 621, failed: 7 },
      generation: { invocations: 182, failures: 3, total_tokens: 412300, cost_usd: 1.84, avg_latency_ms: 3034 },
    },
  }
}

test('admin dashboard: urgent queues first, period filter and no horizontal overflow', { tag: '@responsive' }, async ({ page }, testInfo) => {
  const pageErrors = []
  const requestedPeriods = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route(API_ROUTE, async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (path === '/api/admin/dashboard/queues/') {
      const { generated_at: generatedAt, queues } = dashboard(30)
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ generated_at: generatedAt, queues, knowledge_review_overdue: 3 }),
      })
      return
    }
    if (path === '/api/admin/dashboard/') {
      const period = Number(url.searchParams.get('period'))
      requestedPeriods.push(period)
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(dashboard(period)) })
      return
    }
    const body = path === '/api/auth/refresh/'
      ? { access: 'e2e-access' }
      : path === '/api/auth/me/'
        ? adminUser
        : path === '/api/public/site/announcements/active/'
          ? { remote_enabled: false, items: [], next_transition_at: null }
          : path === '/api/public/privacy/consent/'
            ? { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
            : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/quan-tri/tong-quan')
  await expect(page.getByRole('heading', { level: 1, name: /Lê Minh Quản/ })).toBeVisible()

  const queue = page.getByRole('region', { name: 'Cần xử lý' })
  const rows = queue.getByRole('listitem')
  await expect(rows).toHaveCount(5)
  await expect(rows.first()).toContainText('Báo cáo tin tuyển dụng')
  await expect(rows.first()).toContainText('1 quá hạn')
  await expect(rows.first().getByRole('link')).toHaveAttribute('href', '/quan-tri/duyet-tin?tab=reports')
  await expect(queue).toContainText('Đã xử lý hết: Xác minh tên miền thủ công, Báo cáo công ty')

  await expect(page.getByText('Mới trong kỳ, 30 ngày trước chưa có')).toBeVisible()

  const bell = page.getByRole('button', { name: '11 mục cần xử lý, 1 quá hạn' })
  await bell.click()
  await expect(page.locator('.admin-bell').getByRole('link', { name: /Báo cáo tin tuyển dụng/ }))
    .toHaveAttribute('href', '/quan-tri/duyet-tin?tab=reports')
  await page.keyboard.press('Escape')

  if (page.viewportSize().width < 1024) {
    await page.getByRole('button', { name: 'Mở điều hướng' }).click()
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Đăng xuất' })).toBeVisible()
    await page.getByRole('button', { name: 'Đóng điều hướng' }).click()
  } else {
    await expect(page.locator('.admin-sider').getByRole('button', { name: 'Đăng xuất' })).toBeVisible()
    await expect(page.getByLabel('Tìm chức năng quản trị')).toHaveCount(0)
  }
  await expect(page.getByText('Phễu ứng tuyển')).toBeVisible()
  expect(requestedPeriods).toContain(30)

  await page.getByRole('radiogroup', { name: 'Kỳ thống kê' }).getByText('7 ngày').click()
  await expect(page).toHaveURL(/period=7/)
  await expect.poll(() => requestedPeriods.at(-1)).toBe(7)
  await expect(page.getByText(/so với 7 ngày trước/).first()).toBeVisible()

  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )
  if (process.env.ADMIN_DASHBOARD_SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.ADMIN_DASHBOARD_SCREENSHOT_DIR}/${testInfo.project.name}.png`,
      fullPage: true,
    })
  }
  expect(pageErrors).toEqual([])
})
