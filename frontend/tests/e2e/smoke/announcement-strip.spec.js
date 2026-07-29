import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

const FEEDS = {
  candidate: 'Thông báo dành cho ứng viên.',
  employer_marketing: 'Giải pháp tuyển dụng vừa được cập nhật.',
  employer_workspace: 'Workspace nhà tuyển dụng hoạt động ổn định.',
  admin_workspace: 'Không gian quản trị đã sẵn sàng.',
}

function feed(surface) {
  return {
    remote_enabled: true,
    items: [{
      public_id: `ann_${surface}`,
      revision: 1,
      kind: 'feature',
      priority_tier: 6,
      priority: 100,
      message: FEEDS[surface],
      badge: 'Mới',
      icon: 'sparkles',
      cta: null,
      animation: 'slide',
      display_seconds: 6,
      dismiss: { mode: 'locked', snooze_seconds: null, version: 1 },
      starts_at: null,
      ends_at: null,
    }],
    next_transition_at: null,
  }
}

async function enableAnnouncementRollout(page) {
  await page.addInitScript(() => {
    window.__ANNOUNCEMENT_ROLLOUT_SURFACES__ = 'all'
  })
}

async function routeAnnouncementFeed(page, requestedSurfaces = []) {
  await page.route('http://localhost:8000/api/site/announcements/active/**', async (route) => {
    const surface = new URL(route.request().url()).searchParams.get('surface')
    requestedSurfaces.push(surface)
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(feed(surface)),
    })
  })
}

async function expectHealthyStrip(page, message, header) {
  const strip = page.getByRole('region', { name: 'Thông báo hệ thống' })
  await expect(strip).toBeVisible()
  await expect(strip).toContainText(message)
  const [stripBox, headerBox] = await Promise.all([
    strip.boundingBox(),
    header.boundingBox(),
  ])
  expect(stripBox).not.toBeNull()
  expect(headerBox).not.toBeNull()
  expect(stripBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1)
  expect(stripBox.x + stripBox.width).toBeLessThanOrEqual(page.viewportSize().width + 1)
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ))).toBeLessThanOrEqual(1)

  const messageStyle = await strip.locator('.announcement-strip__message').evaluate(
    (element) => ({
      lineClamp: getComputedStyle(element).webkitLineClamp,
      whiteSpace: getComputedStyle(element).whiteSpace,
    }),
  )
  if (page.viewportSize().width < 768) expect(messageStyle.lineClamp).toBe('2')
  else expect(messageStyle.whiteSpace).toBe('nowrap')
}

test('announcement strip: candidate and employer marketing headers stay responsive', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await enableAnnouncementRollout(page)
  await mockPublicApi(page)
  const requestedSurfaces = []
  await routeAnnouncementFeed(page, requestedSurfaces)

  await page.goto('/chinh-sach-cookie')
  await expect.poll(() => requestedSurfaces).toContain('candidate')
  await expectHealthyStrip(
    page,
    FEEDS.candidate,
    page.locator('header').first(),
  )

  await page.goto('/tuyendung')
  await expectHealthyStrip(
    page,
    FEEDS.employer_marketing,
    page.locator('header').first(),
  )
  expect(pageErrors).toEqual([])
})

test('announcement strip: employer workspace keeps its measured 100dvh shell', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await enableAnnouncementRollout(page)
  await mockPublicApi(page)
  await page.route('http://localhost:8000/api/auth/refresh/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ access: 'e2e-access' }),
    })
  })
  await page.route('http://localhost:8000/api/auth/me/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'usr_employer',
        email: 'hr@example.com',
        full_name: 'Nguyễn An',
        role: 'employer',
        email_verified: true,
        employer_onboarding_required: false,
        employer_onboarding_step: 'complete',
        two_factor_enabled: true,
      }),
    })
  })
  await page.route('http://localhost:8000/api/employer/me/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'rec_e2e',
        onboarding: {
          email_verified: true,
          phone_verified: true,
          company_linked: true,
          business_doc_submitted: true,
          business_doc_approved: true,
          candidate_dpa_submitted: true,
          dpa_accepted: true,
          first_job_posted: true,
        },
      }),
    })
  })
  await routeAnnouncementFeed(page)

  await page.goto('/tuyendung/app/dashboard')
  await expectHealthyStrip(
    page,
    FEEDS.employer_workspace,
    page.getByTestId('employer-topbar'),
  )
  await expect(page.getByTestId('employer-workspace')).toHaveCSS(
    'height',
    `${page.viewportSize().height}px`,
  )
  await expect.poll(() => page.getByTestId('employer-workspace').evaluate(
    (element) => element.style.getPropertyValue('--announcement-strip-height'),
  )).toMatch(/^\d+px$/)
  expect(pageErrors).toEqual([])
})

test('announcement strip: admin workspace remains below its responsive topbar', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await enableAnnouncementRollout(page)
  await page.route('http://localhost:8000/api/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const path = requestUrl.pathname
    const body = path === '/api/auth/refresh/'
      ? { access: 'e2e-access' }
      : path === '/api/auth/me/'
        ? {
            public_id: 'usr_admin',
            email: 'admin@example.com',
            full_name: 'Quản trị hệ thống',
            role: 'admin',
            email_verified: true,
            admin_access: {
              is_superuser: true,
              permissions: [],
              memberships: [],
            },
          }
        : path === '/api/site/announcements/active/'
          ? feed(requestUrl.searchParams.get('surface'))
          : path === '/api/admin/accounts/summary/'
            ? requestUrl.searchParams.get('scope') === 'recruiters'
              ? { totals: {}, verification: { pending: 0 } }
              : { totals: {}, queues: { pending_admin_invitations: 0 } }
            : path === '/api/admin/companies/summary/'
              ? {
                  verification: { pending: 0 },
                  pending_update_requests: 0,
                }
              : path === '/api/privacy/consent/'
                ? {
                    consent: {
                      necessary: true,
                      preferences: false,
                      analytics: false,
                      marketing: false,
                    },
                  }
                : {}
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })

  await page.goto('/admin/app/dashboard')
  await expectHealthyStrip(
    page,
    FEEDS.admin_workspace,
    page.locator('.admin-topbar'),
  )
  await expect(page.getByRole('region', { name: 'Tóm tắt quyền truy cập' })).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('announcement strip: remote kill switch fails closed without breaking public headers', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await enableAnnouncementRollout(page)
  await mockPublicApi(page)
  await page.route('http://localhost:8000/api/site/announcements/active/**', async (route) => {
    const surface = new URL(route.request().url()).searchParams.get('surface')
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ...feed(surface),
        remote_enabled: false,
      }),
    })
  })

  await page.goto('/chinh-sach-cookie')
  await expect(page.locator('header').first()).toBeVisible()
  await expect(page.getByText(FEEDS.candidate)).not.toBeVisible()

  await page.goto('/tuyendung')
  await expect(page.locator('header').first()).toBeVisible()
  await expect(page.getByText(FEEDS.employer_marketing)).not.toBeVisible()
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ))).toBeLessThanOrEqual(1)
  expect(pageErrors).toEqual([])
})
