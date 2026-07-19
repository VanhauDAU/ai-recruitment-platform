import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

test('candidate smoke: saved jobs remains protected', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/viec-lam-da-luu')

  await expect(page).toHaveURL(/\/login$/)
})

test('candidate smoke: WYSIWYG CV editor uses the V2 draft lifecycle', async ({ page }) => {
  const draft = {
    schema_version: 1,
    lock_version: 0,
    content_json: {
      schema_version: 1, locale: 'vi-VN', custom_fields: {},
      personal_info: { full_name: 'Nguyễn An', headline: 'Developer', email: 'an@example.com', phone: '0909123456', address: 'Hà Nội', avatar_asset_id: null, links: [] },
      sections: [
        { instance_id: 'summary_1', section_key: 'summary', title: 'Mục tiêu nghề nghiệp', enabled: true, items: [{ item_id: 'summary_item_1', value: '' }] },
        { instance_id: 'experience_1', section_key: 'experience', title: 'Kinh nghiệm', enabled: true, items: [{ item_id: 'experience_item_1', role: '', company: '', start_date: null, end_date: null, description: { format: 'rich_text_v1', content: [] } }] },
        { instance_id: 'skills_1', section_key: 'skills', title: 'Kỹ năng', enabled: true, items: [{ item_id: 'skills_item_1', name: '' }] },
        { instance_id: 'avatar_1', section_key: 'avatar', title: 'Ảnh đại diện', enabled: true, items: [] },
      ],
    },
    layout_json: { schema_version: 1, page: { size: 'A4', margin_mm: 12 }, regions: [{ id: 'main', width_percent: 100, section_instance_ids: ['avatar_1', 'summary_1', 'experience_1', 'skills_1'] }] },
    style_json: { schema_version: 1, theme_color: '#00A66A', font_family: 'Roboto', font_scale: 1, line_height: 1.4, background_asset_id: null, section_overrides: {} },
  }
  await page.route('http://localhost:8000/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const body = path === '/api/auth/me/'
      ? { id: 1, role: 'candidate', email_verified: true, job_preferences_configured: true }
      : path === '/api/privacy/consent/'
        ? { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
      : path === '/api/site/settings/'
        ? { cv_builder_wysiwyg_enabled: true }
      : path === '/api/v2/cvs/cv_1/'
        ? { public_id: 'cv_1', title: 'CV V2', latest_version_public_id: 'version_2', thumbnail_url: null, thumbnail_status: 'pending', template_public_id: 'tpl_1', template_renderer_key: 'classic_single_column_v1', template_capabilities: { layout: { section_drag: true, cross_region_drag: true, item_drag: true } } }
        : path === '/api/v2/cvs/cv_1/draft/' && request.method() === 'GET'
          ? draft
      : path === '/api/v2/cvs/cv_1/draft/' && request.method() === 'PUT'
            ? { ...draft, lock_version: 1 }
            : path === '/api/v2/cvs/assets/' && request.method() === 'POST'
              ? {
                  public_id: 'avatar_uploaded',
                  kind: 'avatar',
                  width: 900,
                  height: 700,
                  url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="900" height="700"%3E%3Crect width="900" height="700" fill="%232255AA"/%3E%3C/svg%3E',
                }
            : path === '/api/v2/cvs/cv_1/save-version/'
              ? {
                  public_id: 'version_2', version_number: 2, version_kind: 'manual_save',
                  schema_version: draft.schema_version, content_json: draft.content_json,
                  layout_json: draft.layout_json, style_json: draft.style_json, assets: {},
                  template_renderer_key: 'classic_single_column_v1',
                }
              : path === '/api/jobs/recommendations/by-cv/cv_1/'
                ? { focus_keyword: 'Developer', strategy: 'profile-rule-v1', related_positions: [{ label: 'Frontend Developer', search: 'Frontend Developer' }], results: [] }
                : path === '/api/candidate/recruiter-visibility/'
                  ? { enabled: false, policy_version: 'v1', decided_at: null }
                  : path === '/api/v2/cvs/cv_1/thumbnail/'
                    ? { status: 'pending', thumbnail_url: null }
              : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/cvs/cv_1/edit?mode=create')
  await expect(page.getByRole('banner', { name: 'Header website' })).toBeVisible()
  await expect(page.getByLabel('Thanh hành động CV')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Tên CV' })).toHaveText('CV V2')
  await expect(page.getByRole('navigation', { name: 'Công cụ CV' })).toBeVisible()
  await expect(page.getByLabel('CV A4 có thể chỉnh sửa')).toBeVisible()
  await expect(page.getByLabel('Xem trước CV classic_single_column_v1 trang 1')).toBeVisible()

  await page.getByRole('button', { name: 'Cập nhật ảnh đại diện' }).click()
  await expect(page.getByRole('dialog', { name: 'Cập nhật ảnh đại diện' })).toBeVisible()
  const avatarInput = page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]')
  expect(await avatarInput.count()).toBe(1)
  await avatarInput.setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XTKxWQAAAABJRU5ErkJggg==', 'base64'),
  })
  await expect(page.getByRole('group', { name: 'Vùng căn chỉnh ảnh đại diện' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Xem trước ảnh đại diện' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Đổi ảnh' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Xóa ảnh' })).toBeVisible()
  await page.getByRole('button', { name: 'Đóng lại' }).click()

  await page.getByLabel('Mục CV Kinh nghiệm').focus()
  await page.getByLabel('Mục CV Kinh nghiệm').press('Enter')
  await expect(page.getByRole('heading', { name: 'Chỉnh sửa nội dung' })).toHaveCount(0)
  await expect(page.getByLabel('role experience_item_1')).toBeVisible()

  const initialAutosaveRequest = page.waitForRequest((request) => request.url().endsWith('/api/v2/cvs/cv_1/draft/') && request.method() === 'PUT')
  await page.getByLabel('Họ và tên inline').fill('Nguyễn Bình')
  await page.getByLabel('Họ và tên inline').press('Tab')
  expect((await initialAutosaveRequest).headers()['if-match']).toBe('"lock-version-0"')

  await page.getByRole('button', { name: 'Thêm mục' }).click()
  const sectionAutosaveRequest = page.waitForRequest((request) => {
    if (!request.url().endsWith('/api/v2/cvs/cv_1/draft/') || request.method() !== 'PUT') return false
    return request.postDataJSON()?.layout_json?.item_orders?.education_1?.[0] === 'education_item_2'
  })
  await page.getByRole('button', { name: '+ Học vấn' }).click()
  await expect(page.locator('#cv-section-education_1')).toBeVisible()
  await page.getByRole('button', { name: 'Đóng bảng công cụ' }).click()
  await page.getByLabel('Tiêu đề education_1').fill('Đào tạo')
  await page.getByLabel('Tiêu đề education_1').press('Tab')
  await page.locator('#cv-section-education_1').hover()
  await page.locator('#cv-section-education_1').getByRole('button', { name: 'Thêm nội dung', exact: true }).click()
  const secondEducationItem = page.locator('[data-cv-item-id="education_1:education_item_2"]')
  await secondEducationItem.hover()
  await secondEducationItem.getByRole('button', { name: 'Đưa item education_item_2 lên' }).click()
  const sectionAutosave = await sectionAutosaveRequest
  const autosavePayload = sectionAutosave.postDataJSON()
  expect(sectionAutosave.headers()['if-match']).toBe('"lock-version-1"')
  const education = autosavePayload.content_json.sections.find((section) => section.instance_id === 'education_1')
  expect(education.title).toBe('Đào tạo')
  expect(education.items.map((item) => item.item_id)).toEqual(['education_item_1', 'education_item_2'])
  expect(autosavePayload.layout_json.item_orders.education_1).toEqual(['education_item_2', 'education_item_1'])
  expect(autosavePayload.layout_json.regions[0].section_instance_ids).toContain('education_1')

  let saveVersionRequested = false
  page.on('request', (request) => {
    if (request.url().endsWith('/api/v2/cvs/cv_1/save-version/')) saveVersionRequested = true
  })
  await page.getByRole('button', { name: 'Lưu CV' }).click()
  await expect(page.getByRole('dialog', { name: 'Lưu ý' })).toBeVisible()
  await page.getByRole('button', { name: 'Lưu CV, tôi sẽ hoàn thiện sau' }).click()
  await expect(page).toHaveURL('/save-cv-success/cv_1?type=create')
  await expect(page.getByRole('heading', { name: 'Lưu CV thành công!' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'CV V2' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Ảnh xem trước CV V2' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Việc làm “Developer” phù hợp với CV của bạn' })).toBeVisible()
  expect(saveVersionRequested).toBe(true)
})

test('candidate smoke: owner CV view renders an immutable V2 version, not a draft', async ({ page }) => {
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

test('candidate smoke: CV library permanently deletes a CV through V2', async ({ page }) => {
  let deleted = false
  const cv = {
    public_id: 'cv_1', title: 'CV cần xóa', cv_type: 'builder', source: 'builder',
    is_default: false, template_renderer_key: 'classic_single_column_v1', updated_at: '2026-07-15T00:00:00Z',
  }
  const version = {
    public_id: 'cvv_1', version_number: 1, schema_version: 1,
    template_renderer_key: 'classic_single_column_v1', template_renderer_version: '1',
    content_json: { personal_info: { full_name: 'Candidate', headline: '', email: '', phone: '', address: '' }, sections: [] },
    layout_json: { regions: [{ id: 'main', width_percent: 100, section_instance_ids: [] }] },
    style_json: { theme_color: '#00A66A', font_family: 'Roboto', font_scale: 1, line_height: 1.4 },
  }
  await page.route('http://localhost:8000/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const body = path === '/api/auth/me/'
      ? { id: 1, role: 'candidate', email_verified: true, job_preferences_configured: true }
      : path === '/api/v2/cvs/' && request.method() === 'GET'
        ? { results: deleted ? [] : [cv] }
        : path === '/api/v2/cvs/cv_1/view/'
          ? { cv: { public_id: 'cv_1', title: cv.title, language: 'vi-VN', is_default: false }, version }
          : path === '/api/v2/cvs/cv_1/' && request.method() === 'DELETE'
            ? ((deleted = true), {})
            : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/tai-khoan/cv-cua-toi')
  await expect(page.getByText('CV cần xóa', { exact: true })).toBeVisible()
  await page.locator('.group').first().hover()
  await page.getByRole('button', { name: 'Thao tác CV' }).click()
  await page.getByText('Xoá', { exact: true }).click()
  await expect(page.getByText('Xóa vĩnh viễn', { exact: true })).toBeVisible()
  const deleteRequest = page.waitForRequest((request) => request.url().endsWith('/api/v2/cvs/cv_1/') && request.method() === 'DELETE')
  await page.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true }).click()
  await deleteRequest
  await expect(page.getByText('CV cần xóa', { exact: true })).toHaveCount(0)
})

test('candidate smoke: job application submits the selected immutable CV version through V2', async ({ page }) => {
  let applicationPayload
  const job = {
    public_id: 'job_1', slug: 'apply-job', title: 'Kỹ sư phần mềm', company_name: 'Công ty Mẫu',
    description: '<p>Mô tả công việc</p>', requirements: '', benefits: '', locations_detail: [],
    requirement_tags: [], benefit_tags: [], domain_knowledge: [],
    workplace_groups: [
      { province_id: 3, province_name: 'Bình Dương', addresses: [] },
      { province_id: 4, province_name: 'Đà Nẵng', addresses: [] },
    ],
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
              ? { results: [{
                  public_id: 'cv_1', title: 'CV chính', is_default: true, cv_type: 'builder',
                  latest_version_public_id: 'cvv_2', has_unsaved_changes: false,
                  completion_score: 85, is_complete: true, updated_at: '2026-07-17T10:00:00Z',
                }] }
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
  await page.locator('#job-detail-content').getByRole('button', { name: 'Ứng tuyển ngay', exact: true }).click()
  const applicationDialog = page.getByRole('dialog')
  await expect(applicationDialog).toBeVisible()
  await expect(applicationDialog.getByText('Kỹ sư phần mềm', { exact: true })).toBeVisible()
  await expect(applicationDialog.getByRole('radio', { name: /CV chính/ })).toBeChecked()
  await expect(applicationDialog.getByText(/Tải CV từ máy tính/)).toBeVisible()
  const locationSelect = applicationDialog.getByRole('combobox', { name: 'Địa điểm làm việc mong muốn' })
  await expect(locationSelect).toBeVisible()
  await locationSelect.click()
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content', { hasText: 'Bình Dương' }).click()
  await expect(page.locator('.ant-select-dropdown:visible')).toHaveCount(0)
  await expect(applicationDialog.locator('.ant-select-selection-item-content', { hasText: 'Bình Dương' })).toBeVisible()
  await locationSelect.click()
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content', { hasText: 'Đà Nẵng' }).click()
  await expect(page.locator('.ant-select-dropdown:visible')).toHaveCount(0)
  await expect(applicationDialog.locator('.ant-select-selection-item-content', { hasText: 'Đà Nẵng' })).toBeVisible()

  await applicationDialog.getByRole('checkbox', { name: /Tôi đã đọc và đồng ý/ }).check()
  await applicationDialog.getByRole('button', { name: 'Nộp hồ sơ ứng tuyển' }).click()
  await expect(applicationDialog).toBeHidden()
  expect(applicationPayload).toEqual({
    job_public_id: 'job_1',
    cv_public_id: 'cv_1',
    version_public_id: 'cvv_2',
    cover_letter: '',
    preferred_location_ids: [3, 4],
    allow_ai_analysis: false,
    data_processing_consent: true,
    contact_name: '',
    contact_email: '',
    contact_phone: '',
  })
})
