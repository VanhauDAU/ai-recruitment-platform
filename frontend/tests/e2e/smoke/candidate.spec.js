import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

test('candidate smoke: saved jobs remains protected', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/viec-lam-da-luu')

  await expect(page).toHaveURL(/\/login$/)
})

test('candidate smoke: basic CV editor uses the V2 draft lifecycle', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('main_access_token', 'candidate-test-token'))
  const draft = {
    schema_version: 1,
    lock_version: 0,
    content_json: {
      schema_version: 1, locale: 'vi-VN', custom_fields: {},
      personal_info: { full_name: 'Nguyễn An', headline: 'Developer', email: '', phone: '', address: '', avatar_asset_id: null, links: [] },
      sections: [
        { instance_id: 'summary_1', section_key: 'summary', title: 'Mục tiêu nghề nghiệp', enabled: true, items: [{ item_id: 'summary_item_1', value: '' }] },
        { instance_id: 'experience_1', section_key: 'experience', title: 'Kinh nghiệm', enabled: true, items: [{ item_id: 'experience_item_1', role: '', company: '', start_date: null, end_date: null, description: { format: 'rich_text_v1', content: [] } }] },
        { instance_id: 'skills_1', section_key: 'skills', title: 'Kỹ năng', enabled: true, items: [{ item_id: 'skills_item_1', name: '' }] },
      ],
    },
    layout_json: { schema_version: 1, page: { size: 'A4', margin_mm: 12 }, regions: [{ id: 'main', width_percent: 100, section_instance_ids: ['summary_1', 'experience_1', 'skills_1'] }] },
    style_json: { schema_version: 1, theme_color: '#00A66A', font_family: 'Roboto', font_scale: 1, line_height: 1.4, background_asset_id: null, section_overrides: {} },
  }
  await page.route('http://localhost:8000/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const body = path === '/api/auth/me/'
      ? { id: 1, role: 'candidate', email_verified: true, job_preferences_configured: true }
      : path === '/api/v2/cvs/cv_1/'
        ? { public_id: 'cv_1', title: 'CV V2', template_renderer_key: 'classic_single_column_v1' }
        : path === '/api/v2/cvs/cv_1/draft/' && request.method() === 'GET'
          ? draft
          : path === '/api/v2/cvs/cv_1/draft/' && request.method() === 'PUT'
            ? { ...draft, lock_version: 1 }
            : path === '/api/v2/cvs/cv_1/save-version/'
              ? { public_id: 'version_2', version_number: 2, version_kind: 'manual_save' }
              : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/cvs/cv_1/edit')
  await expect(page.getByRole('heading', { name: 'CV V2' })).toBeVisible()
  await expect(page.getByLabel('Xem trước CV classic_single_column_v1 trang 1')).toBeVisible()

  const initialAutosaveRequest = page.waitForRequest((request) => request.url().endsWith('/api/v2/cvs/cv_1/draft/') && request.method() === 'PUT')
  await page.getByLabel('Họ và tên').fill('Nguyễn Bình')
  expect((await initialAutosaveRequest).headers()['if-match']).toBe('"lock-version-0"')

  const sectionAutosaveRequest = page.waitForRequest((request) => request.url().endsWith('/api/v2/cvs/cv_1/draft/') && request.method() === 'PUT')
  await page.getByRole('combobox', { name: 'Thêm section', exact: true }).click()
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option', { hasText: 'Học vấn' }).click()
  await expect(page.getByRole('button', { name: 'Xác nhận thêm section' })).toBeEnabled()
  await page.getByRole('button', { name: 'Xác nhận thêm section' }).click()
  await expect(page.locator('#section-education_1')).toBeVisible()
  await page.getByLabel('Tiêu đề education_1').fill('Đào tạo')
  await page.getByRole('button', { name: 'Thêm item education_1' }).click()
  await page.getByRole('button', { name: 'Di chuyển item education_item_2 lên' }).click()
  const sectionAutosave = await sectionAutosaveRequest
  const autosavePayload = sectionAutosave.postDataJSON()
  expect(sectionAutosave.headers()['if-match']).toBe('"lock-version-1"')
  const education = autosavePayload.content_json.sections.find((section) => section.instance_id === 'education_1')
  expect(education.title).toBe('Đào tạo')
  expect(education.items.map((item) => item.item_id)).toEqual(['education_item_1', 'education_item_2'])
  expect(autosavePayload.layout_json.item_orders.education_1).toEqual(['education_item_2', 'education_item_1'])
  expect(autosavePayload.layout_json.regions[0].section_instance_ids).toContain('education_1')

  const saveVersionRequest = page.waitForRequest((request) => request.url().endsWith('/api/v2/cvs/cv_1/save-version/') && request.method() === 'POST')
  await page.getByRole('button', { name: 'Lưu phiên bản' }).click()
  expect((await saveVersionRequest).headers()['if-match']).toBe('"lock-version-1"')
  await expect(page.getByText('Đã tạo phiên bản 2')).toBeVisible()
})

test('candidate smoke: owner CV view renders an immutable V2 version, not a draft', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('main_access_token', 'candidate-test-token'))
  const version = {
    public_id: 'cvv_2', version_number: 2, schema_version: 1,
    template_renderer_key: 'classic_single_column_v1', template_renderer_version: '1',
    content_json: {
      personal_info: { full_name: 'Phiên bản bất biến', headline: 'Developer', email: '', phone: '', address: '' },
      sections: [{ instance_id: 'summary_1', section_key: 'summary', title: 'Mục tiêu', enabled: true, items: [{ item_id: 'summary_item_1', value: 'Nội dung đã lưu' }] }],
    },
    layout_json: { regions: [{ id: 'main', width_percent: 100, section_instance_ids: ['summary_1'] }] },
    style_json: { theme_color: '#00A66A', font_family: 'Roboto', font_scale: 1, line_height: 1.4 },
  }
  await page.route('http://localhost:8000/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const body = path === '/api/auth/me/'
      ? { id: 1, role: 'candidate', email_verified: true, job_preferences_configured: true }
      : path === '/api/v2/cvs/cv_1/'
        ? { public_id: 'cv_1', published_version_public_id: 'cvv_2', latest_version_public_id: 'cvv_2' }
        : path === '/api/v2/cvs/cv_1/versions/'
          ? { count: 1, results: [{ public_id: 'cvv_2', version_number: 2, version_kind: 'published', template_renderer_key: 'classic_single_column_v1' }] }
      : path === '/api/v2/cvs/cv_1/view/'
        ? { cv: { public_id: 'cv_1', title: 'CV read-only', language: 'vi-VN' }, version }
        : path === '/api/v2/cvs/cv_1/exports/' && route.request().method() === 'POST'
          ? { public_id: 'cve_1', version_public_id: 'cvv_2', status: 'pending', renderer_key: 'classic_single_column_v1', renderer_version: '1', download_url: null }
        : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/cvs/cv_1/view')
  await expect(page.getByRole('heading', { name: 'CV read-only' })).toBeVisible()
  await expect(page.getByText('Phiên bản bất biến')).toBeVisible()
  await expect(page.getByText('Nội dung đã lưu')).toBeVisible()
  await expect(page.getByLabel('Xem trước CV classic_single_column_v1 trang 1')).toBeVisible()
  const exportRequest = page.waitForRequest((request) => request.url().endsWith('/api/v2/cvs/cv_1/exports/') && request.method() === 'POST')
  await page.getByRole('button', { name: 'Xuất PDF' }).click()
  expect((await exportRequest).postDataJSON()).toEqual({ version_public_id: 'cvv_2' })
  await expect(page.getByText('Đang chờ xuất')).toBeVisible()
})

test('candidate smoke: CV library restores archived CVs through V2', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('main_access_token', 'candidate-test-token'))
  let restored = false
  const activeCv = {
    public_id: 'cv_1', title: 'CV library', cv_type: 'builder', source: 'builder',
    is_default: false, template_renderer_key: 'classic_single_column_v1', updated_at: '2026-07-15T00:00:00Z',
  }
  const restoredCv = {
    public_id: 'cv_archived', title: 'CV archived', cv_type: 'builder', source: 'builder',
    is_default: false, lifecycle_status: 'draft', updated_at: '2026-07-15T00:00:00Z',
  }
  const archivedCv = {
    ...restoredCv, lifecycle_status: 'archived', archived_at: '2026-07-15T00:00:00Z',
  }
  const version = {
    public_id: 'cvv_1', version_number: 1, schema_version: 1,
    template_renderer_key: 'classic_single_column_v1', template_renderer_version: '1',
    content_json: {
      personal_info: { full_name: 'Candidate', headline: 'Developer', email: '', phone: '', address: '' },
      sections: [],
    },
    layout_json: { regions: [{ id: 'main', width_percent: 100, section_instance_ids: [] }] },
    style_json: { theme_color: '#00A66A', font_family: 'Roboto', font_scale: 1, line_height: 1.4 },
  }
  await page.route('http://localhost:8000/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const body = path === '/api/auth/me/'
      ? { id: 1, role: 'candidate', email_verified: true, job_preferences_configured: true }
      : path === '/api/v2/cvs/' && request.method() === 'GET'
        ? { results: restored ? [activeCv, restoredCv] : [activeCv] }
        : path === '/api/v2/cvs/archived/'
          ? { results: restored ? [] : [archivedCv] }
          : path === '/api/v2/cvs/cv_1/view/'
            ? { cv: { public_id: 'cv_1', title: activeCv.title, language: 'vi-VN', is_default: false }, version }
            : path === '/api/v2/cvs/cv_archived/restore/'
              ? ((restored = true), restoredCv)
              : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/tai-khoan/cv-cua-toi')
  await expect(page.getByText('CV library', { exact: true })).toBeVisible()
  await expect(page.getByText('CV archived', { exact: true })).toBeVisible()

  const restoreRequest = page.waitForRequest((request) => (
    request.url().endsWith('/api/v2/cvs/cv_archived/restore/') && request.method() === 'POST'
  ))
  await page.getByRole('button', { name: 'Khôi phục' }).click()
  await restoreRequest
  await expect(page.getByText('CV đã lưu trữ')).toHaveCount(0)
})

test('candidate smoke: job application submits the selected immutable CV version through V2', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('main_access_token', 'candidate-test-token'))
  let applicationPayload
  const job = {
    public_id: 'job_1', slug: 'apply-job', title: 'Kỹ sư phần mềm', company_name: 'Công ty Mẫu',
    description: '<p>Mô tả công việc</p>', requirements: '', benefits: '', locations_detail: [],
    requirement_tags: [], benefit_tags: [], domain_knowledge: [], workplace_groups: [],
    work_schedules: [], language_requirements: [], category: null, category_name: '',
    experience_years: 'none', salary_type: 'negotiable', work_type: 'office',
    employment_type: 'full_time', view_count: 0, status: 'active',
  }
  await page.route('http://localhost:8000/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/v2/applications/' && request.method() === 'POST') {
      applicationPayload = request.postDataJSON()
    }
    const body = path === '/api/auth/me/'
      ? { id: 1, role: 'candidate', email_verified: true, job_preferences_configured: true }
      : path === '/api/privacy/consent/'
        ? (request.method() === 'POST'
          ? { necessary: true, preferences: false, analytics: false, marketing: false }
          : { consent: null })
      : path === '/api/jobs/apply-job/'
        ? job
        : path === '/api/jobs/'
          ? { count: 0, results: [] }
          : path === '/api/jobs/categories/' || path === '/api/locations/'
            ? []
            : path === '/api/v2/cvs/'
              ? { results: [{ public_id: 'cv_1', title: 'CV chính', is_default: true, cv_type: 'builder' }] }
              : path === '/api/v2/cvs/cv_1/'
                ? { public_id: 'cv_1', published_version_public_id: 'cvv_2', latest_version_public_id: 'cvv_2' }
                : path === '/api/v2/cvs/cv_1/versions/'
                  ? { results: [{ public_id: 'cvv_2', version_number: 2, version_kind: 'published' }] }
                  : path === '/api/v2/applications/'
                    ? { public_id: 'app_1', submitted_cv_version_public_id: 'cvv_2', status: 'submitted' }
                    : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/viec-lam/apply-job')
  await page.getByRole('button', { name: 'Chỉ cookie thiết yếu' }).click()
  await page.getByRole('button', { name: 'Ứng tuyển ngay' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Ứng tuyển: Kỹ sư phần mềm' })).toBeVisible()
  await expect(page.getByText('Phiên bản 2 (đã publish)')).toBeVisible()

  await page.getByRole('button', { name: 'Xác nhận ứng tuyển' }).click()
  await expect(page.getByRole('dialog', { name: 'Ứng tuyển: Kỹ sư phần mềm' })).toBeHidden()
  expect(applicationPayload).toEqual({
    job_public_id: 'job_1', cv_public_id: 'cv_1', version_public_id: 'cvv_2', cover_letter: '',
  })
})
