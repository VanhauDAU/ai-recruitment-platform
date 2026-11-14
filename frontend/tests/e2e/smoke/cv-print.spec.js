import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// Trang in PDF (CVT-2): worker backend nạp `cv-print.html` bằng Chromium rồi in A4,
// nên kiểm tra ở đây chính là kiểm tra PDF. Mỗi layout trong registry phải dựng
// đúng tỉ lệ cột, đặt tên/liên hệ/ảnh vào vùng của template, không tràn ngang và
// ngắt trang không cắt đôi một mục.
const LAYOUTS = JSON.parse(readFileSync(new URL('../../../src/entities/cv/model/cv-layouts.json', import.meta.url), 'utf8'))
const AVATAR = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#94a3b8"/></svg>')}`

const paragraph = (text) => ({ format: 'rich_text_v1', content: [{ type: 'paragraph', text }] })

function experienceItems(count) {
  return Array.from({ length: count }, (_, index) => ({
    item_id: `experience_item_${index + 1}`,
    role: `Kỹ sư phần mềm ${index + 1}`,
    company: 'Công ty TNHH ABC',
    start_date: '2020-01',
    end_date: '2022-12',
    description: paragraph('Thiết kế và vận hành dịch vụ backend, phối hợp với nhóm sản phẩm để giao tính năng đúng hạn và đo lường hiệu quả sau khi phát hành.'),
  }))
}

// Đặt section giống catalogue: danh tính ở vùng đầu trang, nếu không có thì ở cột
// phụ, nếu không thì ở vùng đầu tiên; nội dung chính ở vùng thân rộng nhất.
function buildDocument(layout, experienceCount) {
  const regions = layout.regions.map((region) => ({ id: region.id, row: region.row, width_percent: region.width, section_instance_ids: [] }))
  const byId = Object.fromEntries(regions.map((region) => [region.id, region]))
  const bodyRow = Math.max(...regions.map((region) => region.row))
  const body = regions.filter((region) => region.row === bodyRow)
  const main = body.reduce((widest, region) => (region.width_percent > widest.width_percent ? region : widest))
  const side = body.find((region) => region !== main) || main
  const identity = byId.header || byId.sidebar || regions[0]
  const sections = [
    ...(layout.avatar ? [{ instance_id: 'avatar_1', section_key: 'avatar', title: 'Ảnh', enabled: true, items: [] }] : []),
    { instance_id: 'nameplate_1', section_key: 'nameplate', title: 'Danh thiếp', enabled: true, items: [] },
    { instance_id: 'contact_1', section_key: 'contact', title: 'Liên hệ', enabled: true, items: [] },
    { instance_id: 'summary_1', section_key: 'summary', title: 'Mục tiêu nghề nghiệp', enabled: true, items: [{ item_id: 'summary_item_1', value: 'Kỹ sư backend năm năm kinh nghiệm với Python và PostgreSQL.' }] },
    { instance_id: 'experience_1', section_key: 'experience', title: 'Kinh nghiệm làm việc', enabled: true, items: experienceItems(experienceCount) },
    { instance_id: 'skills_1', section_key: 'skills', title: 'Kỹ năng', enabled: true, items: ['Python', 'Django', 'PostgreSQL'].map((name, index) => ({ item_id: `skills_item_${index + 1}`, name, level: 4 })) },
  ]
  for (const section of sections) {
    const target = ['avatar', 'nameplate', 'contact'].includes(section.section_key) ? identity : section.section_key === 'skills' ? side : main
    target.section_instance_ids.push(section.instance_id)
  }
  return {
    schema_version: 1,
    content_json: {
      schema_version: 1,
      locale: 'vi-VN',
      custom_fields: {},
      personal_info: { full_name: 'Nguyễn Minh Anh', headline: 'Kỹ sư Backend', email: 'minhanh@example.com', phone: '0901 234 567', address: 'TP. Hồ Chí Minh', avatar_asset_id: 'avatar_print', links: [] },
      sections,
    },
    layout_json: { schema_version: 1, page: { size: 'A4', margin_mm: 12 }, regions, hidden_section_instance_ids: [] },
    style_json: { schema_version: 1, theme_color: '#0E7490', font_family: 'Inter', font_scale: 1, line_height: 1.4, background_asset_id: null, section_overrides: {} },
    identityRegion: identity.id,
  }
}

async function renderPrint(page, key, experienceCount) {
  const { identityRegion, ...document } = buildDocument(LAYOUTS[key], experienceCount)
  const pages = await page.evaluate(
    (payload) => window.renderCvPrint(payload),
    { renderer_key: key, document, assets: { avatar_print: { url: AVATAR } } },
  )
  return { pages, identityRegion }
}

test.beforeEach(async ({ page }, testInfo) => {
  // Trang in không phụ thuộc viewport: chỉ chạy một lần.
  test.skip(testInfo.project.name !== 'desktop-chromium', 'print page is viewport independent')
  await page.goto('/cv-print.html')
  await page.waitForFunction(() => typeof window.renderCvPrint === 'function')
})

for (const key of Object.keys(LAYOUTS)) {
  test(`cv print: ${key} places identity and columns as registered`, async ({ page }) => {
    const { pages, identityRegion } = await renderPrint(page, key, 1)
    expect(pages).toBe(1)

    const layout = await page.evaluate((identity) => {
      const pageBox = document.querySelector('[data-cv-page]')
      const regions = Object.fromEntries([...pageBox.querySelectorAll('[data-cv-region]')].map((region) => [region.dataset.cvRegion, region.getBoundingClientRect().width]))
      const nameplate = pageBox.querySelector('[data-section-key="nameplate"]')
      return {
        regions,
        overflow: pageBox.scrollWidth - pageBox.clientWidth,
        nameInIdentity: Boolean(nameplate?.closest(`[data-cv-region="${identity}"]`)),
        nameText: nameplate?.textContent || '',
        avatar: Boolean(pageBox.querySelector('[data-section-key="avatar"] img')),
      }
    }, identityRegion)

    expect(layout.overflow).toBeLessThanOrEqual(0)
    expect(layout.nameInIdentity).toBe(true)
    expect(layout.nameText).toContain('Nguyễn Minh Anh')
    expect(layout.avatar).toBe(LAYOUTS[key].avatar)

    // Cột cùng hàng giữ tỉ lệ độ rộng khai báo (khoảng cách cột và lề dải màu
    // làm lệch vài phần trăm).
    const rows = Object.groupBy(LAYOUTS[key].regions, (region) => region.row)
    for (const row of Object.values(rows).filter((items) => items.length > 1)) {
      const total = row.reduce((sum, region) => sum + layout.regions[region.id], 0)
      for (const region of row) {
        expect(Math.abs((layout.regions[region.id] / total) * 100 - region.width)).toBeLessThan(5)
      }
    }
  })
}

test('cv print: long content breaks between items, never through one', async ({ page }) => {
  for (const key of Object.keys(LAYOUTS)) {
    const { pages } = await renderPrint(page, key, 9)
    expect(pages, key).toBeGreaterThan(1)
    const result = await page.evaluate(() => {
      const pageBoxes = [...document.querySelectorAll('[data-cv-page]')]
      return {
        clipped: pageBoxes.flatMap((pageBox) => {
          const bounds = pageBox.getBoundingClientRect()
          return [...pageBox.querySelectorAll('[data-section-key]')]
            .filter((element) => element.getBoundingClientRect().bottom > bounds.bottom + 1)
            .map((element) => element.dataset.sectionKey)
        }),
        experiencePages: pageBoxes.filter((pageBox) => pageBox.querySelector('[data-section-key="experience"]')).length,
      }
    })
    expect(result.clipped, key).toEqual([])
    // Mục kinh nghiệm dài được chia theo từng mục con sang trang sau.
    expect(result.experiencePages, key).toBeGreaterThan(1)
  }
})
