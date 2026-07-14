import { expect, test } from '@playwright/test'

test('debug scroll behavior', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('main_access_token', 'candidate-test-token'))
  const draft = {
    schema_version: 1, lock_version: 0,
    content_json: { schema_version: 1, locale: 'vi-VN', custom_fields: {},
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
            : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto('/cvs/cv_1/edit')
  await expect(page.getByRole('heading', { name: 'CV V2' })).toBeVisible()
  await page.getByLabel('Họ và tên').fill('Nguyễn Bình')

  const addSectionSelect = page.locator('.ant-select').filter({ has: page.locator('input[aria-label="Thêm section"]') })
  await addSectionSelect.scrollIntoViewIfNeeded()

  for (let i = 0; i < 10; i++) {
    const info = await page.evaluate(() => ({ y: window.scrollY, docHeight: document.documentElement.scrollHeight, bodyHeight: document.body.scrollHeight }))
    console.log(i, info)
    await page.waitForTimeout(300)
  }
})
