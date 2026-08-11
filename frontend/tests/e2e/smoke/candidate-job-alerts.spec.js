import { expect, test } from '@playwright/test'

const API_PATTERN = /^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/api\//
const ALERTS_PATH = '/api/jobs/alerts/'

const EMAIL_NOTIFICATION_DEFAULTS = {
  important_system_updates: true,
  employer_viewed_cv: true,
  new_features_and_cv_templates: true,
  other_system_notifications: true,
  configured_job_alerts: true,
  suitable_job_recommendations: false,
  top_candidate_alerts: true,
  employer_invitations: true,
  job_and_career_events: true,
  service_introductions: true,
  program_and_event_introductions: true,
  partner_gifts_and_discounts: true,
}

const CATEGORIES = [
  { id: 1, name: 'Công nghệ thông tin', parent: null, category_type: 'occupation_group' },
  { id: 2, name: 'Phát triển phần mềm', parent: 1, category_type: 'domain' },
  { id: 3, name: 'Lập trình viên', parent: 2, category_type: 'specialization' },
  { id: 7, name: 'Kiểm thử phần mềm', parent: 2, category_type: 'specialization' },
  { id: 4, name: 'Kinh doanh/Bán hàng', parent: null, category_type: 'occupation_group' },
  { id: 5, name: 'Bán hàng', parent: 4, category_type: 'domain' },
  { id: 6, name: 'Nhân viên kinh doanh', parent: 5, category_type: 'specialization' },
  { id: 8, name: 'Tư vấn bán hàng', parent: 5, category_type: 'specialization' },
]

const PROVINCES = [
  { id: 1, name: 'Hà Nội', level: 'province', parent: null },
  { id: 2, name: 'Thành phố Hồ Chí Minh', level: 'province', parent: null },
]

const WARDS = [
  { id: 11, name: 'Phường Hoàn Kiếm', level: 'ward', parent: 1 },
  { id: 12, name: 'Phường Ba Đình', level: 'ward', parent: 1 },
]

function alertFixture(overrides = {}) {
  return {
    public_id: 'alert_1',
    keyword: 'Backend Developer',
    keyword_scope: 'title',
    categories: [CATEGORIES[2], CATEGORIES[6]],
    category_ids: [3, 6],
    province: PROVINCES[0],
    province_id: 1,
    province_name: 'Hà Nội',
    ward: WARDS[0],
    ward_id: 11,
    ward_name: 'Phường Hoàn Kiếm',
    salary_bucket: '15-20',
    experience_years: '2',
    work_type: 'hybrid',
    employment_type: 'full_time',
    frequency: 'daily',
    is_active: true,
    created_at: '2026-08-11T08:00:00+07:00',
    updated_at: '2026-08-11T08:00:00+07:00',
    ...overrides,
  }
}

function idFrom(value) {
  if (value && typeof value === 'object') return value.id
  return value ?? null
}

function responseAlert(payload, publicId) {
  const categoryIds = (payload.category_ids ?? payload.categories ?? []).map(idFrom)
  const provinceId = idFrom(payload.province_id ?? payload.province)
  const wardId = idFrom(payload.ward_id ?? payload.ward)
  const categories = CATEGORIES.filter((item) => categoryIds.includes(item.id))
  const province = PROVINCES.find((item) => item.id === provinceId) || null
  const ward = WARDS.find((item) => item.id === wardId) || null

  return alertFixture({
    ...payload,
    public_id: publicId,
    categories,
    category_ids: categoryIds,
    province,
    province_id: provinceId,
    province_name: province?.name || '',
    ward,
    ward_id: wardId,
    ward_name: ward?.name || '',
  })
}

async function mockCandidateJobAlertsApi(page, options = {}) {
  let alerts = [...(options.alerts || [])]
  let alertListFailuresRemaining = options.alertListFailures || 0
  let emailNotifications = { ...EMAIL_NOTIFICATION_DEFAULTS }
  const writes = []

  await page.route(API_PATTERN, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const { pathname } = url
    const method = request.method()

    if (pathname === '/api/auth/refresh/' && options.authenticated === false) {
      await route.fulfill({ status: 204, body: '' })
      return
    }

    if (pathname === '/api/auth/me/' && options.authenticated === false) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Authentication credentials were not provided.' }),
      })
      return
    }

    if (pathname === '/api/candidate/email-notification-settings/' && method === 'PATCH') {
      const payload = request.postDataJSON()
      writes.push({ method, pathname, payload })
      emailNotifications = { ...emailNotifications, ...payload }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(emailNotifications) })
      return
    }

    if (pathname === ALERTS_PATH && method === 'GET' && alertListFailuresRemaining > 0) {
      alertListFailuresRemaining -= 1
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Dịch vụ thông báo tạm thời gián đoạn.' }),
      })
      return
    }

    if (pathname === ALERTS_PATH && method === 'POST') {
      const payload = request.postDataJSON()
      writes.push({ method, pathname, payload })
      const created = responseAlert(payload, `alert_${alerts.length + 1}`)
      alerts = [created, ...alerts]
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) })
      return
    }

    const detailMatch = pathname.match(/^\/api\/jobs\/alerts\/([^/]+)\/$/)
    if (detailMatch && method === 'PATCH') {
      const payload = request.postDataJSON()
      writes.push({ method, pathname, payload })
      const index = alerts.findIndex((item) => item.public_id === detailMatch[1])
      const updated = responseAlert({ ...alerts[index], ...payload }, detailMatch[1])
      if (index >= 0) alerts[index] = updated
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(updated) })
      return
    }

    if (detailMatch && method === 'DELETE') {
      writes.push({ method, pathname, payload: null })
      alerts = alerts.filter((item) => item.public_id !== detailMatch[1])
      await route.fulfill({ status: 204, body: '' })
      return
    }

    let body
    if (pathname === '/api/auth/refresh/') {
      body = { access: 'e2e-access' }
    } else if (pathname === '/api/auth/me/') {
      body = {
        public_id: 'candidate_1',
        role: 'candidate',
        email: 'candidate@example.com',
        full_name: 'Nguyễn An',
        email_verified: options.emailVerified ?? true,
        has_usable_password: true,
        job_preferences_configured: true,
      }
    } else if (pathname === '/api/privacy/consent/') {
      body = { consent: { necessary: true, preferences: true, analytics: false, marketing: false } }
    } else if (pathname === '/api/candidate/email-notification-settings/') {
      body = emailNotifications
    } else if (pathname === ALERTS_PATH) {
      body = { results: alerts, limit: 5, remaining: Math.max(0, 5 - alerts.length) }
    } else if (pathname === '/api/jobs/categories/') {
      body = { count: CATEGORIES.length, next: null, previous: null, results: CATEGORIES }
    } else if (pathname === '/api/locations/' && url.searchParams.get('level') === 'ward') {
      const parent = Number(url.searchParams.get('parent'))
      body = WARDS.filter((item) => item.parent === parent)
    } else if (pathname === '/api/locations/') {
      body = PROVINCES
    } else if (pathname === '/api/jobs/') {
      body = { count: 0, next: null, previous: null, results: [] }
    } else if (pathname === '/api/employer/industries/' || pathname === '/api/site/banners/') {
      body = []
    } else if (pathname === '/api/site/settings/') {
      body = {}
    } else {
      body = {}
    }

    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  return {
    getAlerts: () => alerts,
    getEmailNotifications: () => emailNotifications,
    writes,
  }
}

async function chooseSelectOption(page, scope, label, option) {
  await scope.getByRole('combobox', { name: label, exact: true }).click()
  await page.locator('.ant-select-dropdown:visible').getByText(option, { exact: true }).click()
}

async function chooseCategoryPositions(page, scope, selections) {
  await scope.getByRole('button', { name: 'Ngành nghề' }).click()
  const picker = page.getByRole('dialog', {
    name: 'Chọn Danh mục nghề, Nghề hoặc Vị trí chuyên môn',
  })
  await expect(picker).toBeVisible()

  for (const selection of selections) {
    const backToGroups = picker.getByRole('button', { name: /Danh mục nghề/ })
    if (await backToGroups.isVisible()) await backToGroups.click()
    await picker.getByText(selection.group, { exact: true }).click()
    const position = picker.getByRole('button', {
      name: `Chọn vị trí chuyên môn ${selection.position}`,
    })
    await position.click()
    await expect(position).toHaveAttribute('aria-pressed', 'true')
  }

  await picker.getByRole('button', { name: 'Chọn ngành nghề' }).click()
  await expect(picker).toHaveCount(0)
}

test('candidate job alerts: route remains protected for guests', async ({ page }) => {
  await mockCandidateJobAlertsApi(page, { authenticated: false })

  await page.goto('/tai-khoan/cai-dat-thong-bao-viec-lam')

  await expect(page).toHaveURL(
    /\/login\?returnUrl=%2Ftai-khoan%2Fcai-dat-thong-bao-viec-lam$/,
  )
})

test('candidate job alerts: job-list CTA asks a guest to sign in without losing search context', async ({ page }) => {
  await mockCandidateJobAlertsApi(page, { authenticated: false })
  await page.goto('/viec-lam?search=Backend%20Developer&search_by=title')

  await page.getByRole('button', { name: 'Tạo thông báo việc làm' }).click()

  await expect(page.getByRole('heading', { name: 'Chào mừng quay trở lại' })).toBeVisible()
  await expect(page.getByTestId('login-submit')).toBeVisible()
  await expect(page).toHaveURL(/\/viec-lam\?search=Backend%20Developer&search_by=title$/)
})

test('candidate job alerts: creates an email alert and keeps global and per-alert switches independent', async ({ page }) => {
  const api = await mockCandidateJobAlertsApi(page)
  await page.goto('/tai-khoan/cai-dat-thong-bao-viec-lam')

  await expect(page.getByRole('heading', { name: 'Quản lý thông báo việc làm' })).toBeVisible()
  await expect(page.getByText(/chưa có thông báo việc làm/i)).toBeVisible()
  await page.getByRole('button', { name: 'Tạo thông báo việc làm mới' }).first().click()

  const dialog = page.getByRole('dialog', { name: 'Tạo thông báo việc làm mới' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Email nhận thông báo', { exact: true })).toHaveValue('candidate@example.com')
  expect(await dialog.getByLabel('Email nhận thông báo', { exact: true }).evaluate(
    (element) => element.readOnly || element.disabled,
  )).toBe(true)

  await dialog.getByRole('textbox', { name: 'Từ khóa tìm kiếm', exact: true }).fill('Backend Developer')
  await chooseSelectOption(page, dialog, 'Phạm vi từ khóa', 'Tên vị trí tuyển dụng')
  await chooseCategoryPositions(page, dialog, [
    { group: 'Công nghệ thông tin', position: 'Lập trình viên' },
    { group: 'Kinh doanh/Bán hàng', position: 'Nhân viên kinh doanh' },
  ])
  await chooseSelectOption(page, dialog, 'Tỉnh/Thành phố', 'Hà Nội')
  await chooseSelectOption(page, dialog, 'Phường/Xã', 'Phường Hoàn Kiếm')
  await chooseSelectOption(page, dialog, 'Mức lương', '15 - 20 triệu')
  await chooseSelectOption(page, dialog, 'Kinh nghiệm', '2 năm')
  await chooseSelectOption(page, dialog, 'Hình thức làm việc', 'Làm việc linh hoạt / Hybrid')
  await chooseSelectOption(page, dialog, 'Loại hình công việc', 'Toàn thời gian')
  await dialog.getByRole('radio', { name: 'Hàng ngày' }).check()

  const createRequest = page.waitForRequest((request) => (
    new URL(request.url()).pathname === ALERTS_PATH && request.method() === 'POST'
  ))
  await dialog.getByRole('button', { name: 'Tạo thông báo' }).click()
  const request = await createRequest
  const createPayload = request.postDataJSON()

  expect(createPayload).toEqual(expect.objectContaining({
    keyword: 'Backend Developer',
    keyword_scope: 'title',
    salary_bucket: '15-20',
    experience_years: '2',
    work_type: 'hybrid',
    employment_type: 'full_time',
    frequency: 'daily',
  }))
  expect([...createPayload.category_ids].sort((left, right) => left - right)).toEqual([3, 6])
  await expect(dialog).toHaveCount(0)
  const createdCard = page.getByRole('article', { name: 'Backend Developer' })
  await expect(createdCard).toBeVisible()
  await expect(createdCard.getByText('Lập trình viên', { exact: true })).toBeVisible()
  await expect(createdCard.getByText('Nhân viên kinh doanh', { exact: true })).toBeVisible()
  await expect(createdCard.getByRole('link', { name: 'Xem danh sách việc làm Backend Developer' }))
    .toHaveAttribute('href', /[?&]cat=(?:3%2C6|6%2C3)(?:&|$)/)
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )).toBe(false)

  const suitableSwitch = page.getByRole('switch', {
    name: 'Nhận thông báo việc làm phù hợp',
  })
  await expect(suitableSwitch).not.toBeChecked()
  const suitableRequest = page.waitForRequest((candidate) => {
    if (new URL(candidate.url()).pathname !== '/api/candidate/email-notification-settings/') return false
    return candidate.method() === 'PATCH'
      && candidate.postDataJSON()?.suitable_job_recommendations === true
  })
  await suitableSwitch.click()
  await suitableRequest
  await expect(suitableSwitch).toBeChecked()

  const configuredSwitch = page.getByRole('switch', {
    name: 'Nhận thông báo việc làm theo thiết lập',
  })
  const globalRequest = page.waitForRequest((candidate) => {
    if (new URL(candidate.url()).pathname !== '/api/candidate/email-notification-settings/') return false
    return candidate.method() === 'PATCH'
      && candidate.postDataJSON()?.configured_job_alerts === false
  })
  await configuredSwitch.click()
  await globalRequest
  await expect(configuredSwitch).not.toBeChecked()

  const perAlertSwitch = page.getByRole('switch', { name: /Backend Developer/ })
  const alertRequest = page.waitForRequest((candidate) => (
    new URL(candidate.url()).pathname === '/api/jobs/alerts/alert_1/'
      && candidate.method() === 'PATCH'
      && candidate.postDataJSON()?.is_active === false
  ))
  await perAlertSwitch.click()
  await alertRequest
  await expect(perAlertSwitch).not.toBeChecked()
  expect(api.getEmailNotifications().configured_job_alerts).toBe(false)
  expect(api.getEmailNotifications().suitable_job_recommendations).toBe(true)
  expect(api.getAlerts()[0].is_active).toBe(false)

  await page.getByRole('button', { name: 'Chỉnh sửa Backend Developer' }).click()
  const editDialog = page.getByRole('dialog', { name: 'Chỉnh sửa thông báo việc làm' })
  await editDialog.getByRole('textbox', { name: 'Từ khóa tìm kiếm', exact: true }).fill('Senior Backend Developer')
  const editRequest = page.waitForRequest((candidate) => (
    new URL(candidate.url()).pathname === '/api/jobs/alerts/alert_1/'
      && candidate.method() === 'PATCH'
      && candidate.postDataJSON()?.keyword === 'Senior Backend Developer'
  ))
  await editDialog.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await editRequest
  await expect(editDialog).toHaveCount(0)
  await expect(page.getByText('Senior Backend Developer', { exact: true })).toBeVisible()

  const deleteRequest = page.waitForRequest((candidate) => (
    new URL(candidate.url()).pathname === '/api/jobs/alerts/alert_1/'
      && candidate.method() === 'DELETE'
  ))
  await page.getByRole('button', { name: 'Xóa Senior Backend Developer' }).click()
  const confirmation = page.getByRole('dialog', { name: 'Xóa thông báo' })
  await expect(confirmation.getByText(/Bạn có chắc muốn xóa thông báo việc làm/)).toBeVisible()
  await expect(confirmation.getByText('Bạn sẽ ngừng nhận thông báo việc làm này.')).toBeVisible()
  await confirmation.getByRole('button', { name: 'Xóa', exact: true }).click()
  await deleteRequest
  await expect(page.getByText('Senior Backend Developer', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/chưa có thông báo việc làm/i)).toBeVisible()
  expect(api.getAlerts()).toHaveLength(0)
})

test('candidate job alerts: an unverified email blocks alert creation without hiding the saved settings', async ({ page }) => {
  await mockCandidateJobAlertsApi(page, { emailVerified: false })
  await page.goto('/tai-khoan/cai-dat-thong-bao-viec-lam')

  await expect(page.getByText('Xác thực email để nhận thông báo việc làm')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Xác thực email' })).toHaveAttribute(
    'href',
    '/tai-khoan/xac-thuc-email',
  )
  const createButtons = page.getByRole('button', { name: 'Tạo thông báo việc làm mới' })
  await expect(createButtons).toHaveCount(2)
  for (const button of await createButtons.all()) await expect(button).toBeDisabled()
  await expect(page.getByRole('switch', { name: 'Nhận thông báo việc làm theo thiết lập' })).toBeVisible()
})

test('candidate job alerts: five saved alerts enforce the creation limit', async ({ page }) => {
  const alerts = Array.from({ length: 5 }, (_, index) => alertFixture({
    public_id: `alert_${index + 1}`,
    keyword: `Backend Developer ${index + 1}`,
  }))
  await mockCandidateJobAlertsApi(page, { alerts })
  await page.goto('/tai-khoan/cai-dat-thong-bao-viec-lam')

  await expect(page.getByText('Đã dùng 5/5 thông báo')).toBeVisible()
  await expect(page.getByText('Bạn đã dùng hết giới hạn.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tạo thông báo việc làm mới' })).toBeDisabled()
})

test('candidate job alerts: a failed list can be retried without reloading the page', async ({ page }) => {
  await mockCandidateJobAlertsApi(page, { alertListFailures: 1 })
  await page.goto('/tai-khoan/cai-dat-thong-bao-viec-lam')

  await expect(page.getByText('Không thể tải danh sách thông báo việc làm')).toBeVisible()
  await page.getByRole('button', { name: 'Thử lại' }).click()
  await expect(page.getByText(/chưa có thông báo việc làm/i)).toBeVisible()
  await expect(page.getByText('Không thể tải danh sách thông báo việc làm')).toHaveCount(0)
})

test('candidate job alerts: job-list CTA prefills exact filters and every selected category', async ({ page }) => {
  await mockCandidateJobAlertsApi(page)
  await page.goto(
    '/viec-lam?search=Backend%20Developer&search_by=title&cat=3,6&locations=1&salary=15-20&exp=2&wt=hybrid&et=full_time',
  )

  await page.getByRole('button', { name: 'Tạo thông báo việc làm' }).click()
  const dialog = page.getByRole('dialog', { name: 'Tạo thông báo việc làm mới' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Từ khóa tìm kiếm', exact: true })).toHaveValue('Backend Developer')
  await expect(dialog).toContainText('Lập trình viên')
  await expect(dialog).toContainText('Nhân viên kinh doanh')
  await expect(dialog).toContainText('Hà Nội')
  await expect(dialog).toContainText('15 - 20 triệu')
  await expect(dialog).toContainText('2 năm')
  await expect(dialog).toContainText('Làm việc linh hoạt / Hybrid')
  await expect(dialog).toContainText('Toàn thời gian')
})
