import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

test('public smoke: home and jobs routes load', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/')
  await expect(page.locator('body')).not.toBeEmpty()

  await page.goto('/viec-lam')
  await expect(page.getByRole('heading', { name: /Tuyển dụng/ })).toBeVisible()
})

test('public smoke: CV template colors change preview and detail offers the create flow', async ({ page }) => {
  await mockPublicApi(page)
  const card = {
    public_id: 'tpl_modern',
    slug: 'modern',
    display_name: 'Modern',
    description: 'Bố cục hiện đại',
    thumbnail_url: '',
    is_premium: false,
    theme_color: '#00A66A',
    colors: [
      { public_id: 'green', slug: 'green', name: 'Xanh', hex_code: '#00A66A', preview_url: '/green.png', is_default: true },
      { public_id: 'blue', slug: 'blue', name: 'Xanh dương', hex_code: '#2255AA', preview_url: '/blue.png', is_default: false },
    ],
    categories: [{ public_id: 'cat_style', slug: 'modern', name: 'Hiện đại', type: 'style' }],
    tags: [{ public_id: 'cat_ats', slug: 'ats', name: 'Thân thiện ATS', type: 'feature' }],
  }
  await page.route('http://localhost:8000/api/v2/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const body = path === '/api/v2/cv-templates/'
      ? { count: 1, results: [card] }
      : path === '/api/v2/cv-templates/modern/'
        ? { ...card, preview_url: '', renderer: { key: 'classic_single_column_v1', version: '1', schema_version: 1, capabilities: {} }, sections: [] }
        : path === '/api/v2/cv-templates/modern/related/'
          ? []
          : path === '/api/v2/cv-position-options/'
            ? [
                { public_id: 'jobcat_customer_service', name_vi: 'Nhân viên CSKH' },
                { public_id: 'jobcat_frontend', name_vi: 'Frontend Developer' },
              ]
            : path === '/api/v2/cv-position-preview/'
              ? (() => {
                  const locale = url.searchParams.get('locale')
                  const content = {
                    schema_version: 1,
                    locale,
                    personal_info: {
                      full_name: '',
                      headline: locale === 'en-US'
                        ? 'Customer Service Representative'
                        : 'Nhân viên CSKH',
                      email: '', phone: '', address: '', avatar_asset_id: null, links: [],
                    },
                    sections: [],
                    custom_fields: {},
                  }
                  return {
                  position_public_id: url.searchParams.get('position_public_id'),
                  name_vi: 'Nhân viên CSKH',
                  locale,
                  source: 'blueprint',
                  content_json: content,
                  document: {
                    schema_version: 1,
                    content_json: content,
                    layout_json: {
                      schema_version: 1,
                      page: { size: 'A4', margin_mm: 12 },
                      regions: [{ id: 'main', width_percent: 100, section_instance_ids: [] }],
                    },
                    style_json: {
                      schema_version: 1, theme_color: '#00A66A', font_family: 'Roboto',
                      font_scale: 1, line_height: 1.4, background_asset_id: null, section_overrides: {},
                    },
                  },
                  renderer: { key: 'classic_single_column_v1', version: '1', schema_version: 1, capabilities: {} },
                  revision: `revision-${locale}`,
                }
                })()
          : path === '/api/v2/cv-categories/' || path === '/api/v2/cv-sample-contents/'
            ? []
            : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/mau-cv')
  await expect(page.getByRole('heading', { name: /Mẫu CV xin việc/ })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Xem trước Modern' })).toHaveAttribute('src', '/green.png')
  await page.getByRole('radio', { name: 'Xanh dương' }).hover()
  await expect(page.getByRole('img', { name: 'Xem trước Modern' })).toHaveAttribute('src', '/blue.png')
  const cardText = page.getByText('Modern', { exact: true })
  await cardText.hover()
  const useTemplateButton = page.getByRole('button', { name: 'Dùng mẫu' })
  // Nút nằm trong overlay có transition CSS (opacity/translate) khi hover;
  // đợi nó thực sự visible trước khi click để tránh click rơi giữa lúc
  // transition chưa ổn định (nguồn gốc flaky trước đây khi dùng force click).
  await expect(useTemplateButton).toBeVisible()
  await useTemplateButton.click()
  await expect(page.getByText('Mẫu CV Modern')).toBeVisible()
  await expect(page.getByText('Bạn muốn tạo CV từ?')).toBeVisible()
  await page.getByRole('button', { name: /Nội dung CV mẫu/ }).click()
  await expect(page.getByText('Nhân viên CSKH', { exact: true }).first()).toBeVisible()
  await page.getByRole('combobox').click()
  await page.getByRole('combobox').fill('Frontend')
  await expect(page.getByRole('option', { name: 'Frontend Developer' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Tiếng Anh' }).click()
  await expect(page.getByText('Customer Service Representative')).toBeVisible()

  await page.goto('/mau-cv/chi-tiet/modern')
  await expect(page.getByRole('heading', { name: 'Modern' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tạo CV', exact: true })).toBeVisible()
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
