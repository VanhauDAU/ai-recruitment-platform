import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

test('public smoke: home and jobs routes load', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/')
  await expect(page.locator('body')).not.toBeEmpty()

  await page.goto('/viec-lam')
  await expect(page.getByRole('heading', { name: /Tuyển dụng/ })).toBeVisible()
})

test('public smoke: CV template catalogue opens a template detail and use modal', async ({ page }) => {
  await mockPublicApi(page)
  const card = {
    public_id: 'tpl_modern',
    slug: 'modern',
    display_name: 'Modern',
    description: 'Bố cục hiện đại',
    thumbnail_url: '',
    is_premium: false,
    theme_color: '#00A66A',
    categories: [{ public_id: 'cat_style', slug: 'modern', name: 'Hiện đại', type: 'style' }],
    tags: [{ public_id: 'cat_ats', slug: 'ats', name: 'Thân thiện ATS', type: 'feature' }],
  }
  await page.route('http://localhost:8000/api/v2/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const body = path === '/api/v2/cv-templates/'
      ? { count: 1, results: [card] }
      : path === '/api/v2/cv-templates/modern/'
        ? { ...card, preview_url: '', renderer: { key: 'classic_single_column_v1', version: '1', schema_version: 1, capabilities: {} }, sections: [] }
        : path === '/api/v2/cv-templates/modern/related/'
          ? []
          : path === '/api/v2/cv-categories/' || path === '/api/v2/cv-sample-contents/'
            ? []
            : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/mau-cv')
  await expect(page.getByRole('heading', { name: /Mẫu CV xin việc/ })).toBeVisible()
  const cardText = page.getByText('Modern', { exact: true })
  await cardText.hover()
  await page.getByRole('button', { name: 'Dùng mẫu' }).click({ force: true })
  await expect(page.getByText('Mẫu CV Modern')).toBeVisible()
  await expect(page.getByText('Bạn muốn tạo CV từ?')).toBeVisible()

  await page.goto('/mau-cv/chi-tiet/modern')
  await expect(page.getByRole('heading', { name: 'Modern' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dùng mẫu này' })).toBeVisible()
})

test('public smoke: a shared CV link renders its immutable version', async ({ page }) => {
  await mockPublicApi(page)
  await page.route('http://localhost:8000/api/v2/cvs/shares/share-token/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        cv: { title: 'CV được chia sẻ', language: 'vi-VN' },
        version: {
          public_id: 'cvv_shared', version_number: 1, schema_version: 1,
          template_renderer_key: 'classic_single_column_v1',
          content_json: {
            personal_info: { full_name: 'Nguyễn Chia sẻ', headline: 'Designer', email: '', phone: '', address: '' },
            sections: [],
          },
          layout_json: { regions: [{ id: 'main', width_percent: 100, section_instance_ids: [] }] },
          style_json: { theme_color: '#00A66A', font_family: 'Roboto', font_scale: 1, line_height: 1.4 },
        },
      }),
    })
  })

  await page.goto('/cv/share/share-token')
  await expect(page.getByRole('heading', { name: 'CV được chia sẻ' })).toBeVisible()
  await expect(page.getByText('Nguyễn Chia sẻ')).toBeVisible()
  await expect(page.getByLabel('Xem trước CV classic_single_column_v1 trang 1')).toBeVisible()
})
