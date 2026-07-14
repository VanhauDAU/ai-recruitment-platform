import { describe, expect, it } from 'vitest'
import {
  addItem,
  addSection,
  ensureBasicEditorDocument,
  getRendererContract,
  getOrderedSections,
  projectDocumentForRenderer,
  moveItem,
  moveSection,
  removeItem,
  removeSection,
  renameSection,
  setSectionEnabled,
  updateStyle,
  validateCvDocument,
} from '@/entities/cv'
import { paginateRendererProjection } from './renderer-contracts'

function baseDocument() {
  return {
    schema_version: 1,
    content_json: {
      schema_version: 1,
      locale: 'vi-VN',
      personal_info: { full_name: 'Nguyễn An', headline: 'Developer', email: '', phone: '', address: '', avatar_asset_id: null, links: [] },
      sections: [],
      custom_fields: {},
    },
    layout_json: { schema_version: 1, page: { size: 'A4', margin_mm: 12 }, regions: [{ id: 'main', width_percent: 100, section_instance_ids: [] }] },
    style_json: { schema_version: 1, theme_color: '#00A66A', font_family: 'Roboto', font_scale: 1, line_height: 1.4, background_asset_id: null, section_overrides: {} },
  }
}

describe('canonical CV editor document', () => {
  it('adds the first editable sections and layout references without mutating the source document', () => {
    const document = baseDocument()
    const original = JSON.parse(JSON.stringify(document))

    const normalized = ensureBasicEditorDocument(document)

    expect(document).toEqual(original)
    expect(normalized.content_json.sections.map((section) => section.section_key)).toEqual(['summary', 'experience', 'skills'])
    expect(normalized.layout_json.regions[0].section_instance_ids).toEqual(normalized.content_json.sections.map((section) => section.instance_id))

    const contentBeforeStyleUpdate = JSON.parse(JSON.stringify(normalized.content_json))
    const layoutBeforeStyleUpdate = JSON.parse(JSON.stringify(normalized.layout_json))
    const nextStyle = updateStyle(normalized.style_json, { theme_color: '#2255AA', font_family: 'Inter' })
    expect(normalized.content_json).toEqual(contentBeforeStyleUpdate)
    expect(normalized.layout_json).toEqual(layoutBeforeStyleUpdate)
    expect(nextStyle).toMatchObject({ theme_color: '#2255AA', font_family: 'Inter' })
  })

  it('projects exactly the same canonical content through single and two-column renderer contracts', () => {
    const singleDocument = ensureBasicEditorDocument(baseDocument())
    const twoColumnSource = baseDocument()
    twoColumnSource.layout_json = {
      ...twoColumnSource.layout_json,
      regions: [
        { id: 'main', width_percent: 68, section_instance_ids: [] },
        { id: 'sidebar', width_percent: 32, section_instance_ids: [] },
      ],
    }
    const twoColumnDocument = ensureBasicEditorDocument(twoColumnSource)
    const contentBeforeRendering = JSON.parse(JSON.stringify(twoColumnDocument.content_json))
    const [summary, experience, skills] = twoColumnDocument.content_json.sections

    const single = projectDocumentForRenderer(singleDocument, 'classic_single_column_v1')
    const twoColumn = projectDocumentForRenderer(twoColumnDocument, 'classic_two_column_v1')

    expect(getRendererContract('classic_two_column_v1').columns).toBe(2)
    expect(single.regions[0].sections.map((section) => section.instance_id)).toEqual([summary.instance_id, experience.instance_id, skills.instance_id])
    expect(twoColumn.regions.map((region) => region.sections.map((section) => section.instance_id))).toEqual([[summary.instance_id, experience.instance_id], [skills.instance_id]])
    expect(singleDocument.content_json).toEqual(twoColumnDocument.content_json)
    expect(twoColumnDocument.content_json).toEqual(contentBeforeRendering)
  })

  it('manages sections and repeatable items by their stable IDs without using array positions as identity', () => {
    let document = ensureBasicEditorDocument(baseDocument())
    for (const sectionKey of ['education', 'projects', 'certifications']) document = addSection(document, sectionKey)

    const sections = Object.fromEntries(document.content_json.sections.map((section) => [section.section_key, section]))
    for (const sectionKey of ['experience', 'education', 'skills', 'projects', 'certifications']) {
      document = { ...document, content_json: addItem(document.content_json, sections[sectionKey].instance_id) }
    }

    const allItemIds = document.content_json.sections.flatMap((section) => section.items.map((item) => item.item_id))
    expect(new Set(allItemIds).size).toBe(allItemIds.length)
    expect(document.content_json.sections.filter((section) => ['experience', 'education', 'skills', 'projects', 'certifications'].includes(section.section_key)).every((section) => section.items.length === 2)).toBe(true)

    const experienceId = sections.experience.instance_id
    const [firstExperienceItem, secondExperienceItem] = document.content_json.sections.find((section) => section.instance_id === experienceId).items
    document = { ...document, content_json: moveItem(document.content_json, experienceId, secondExperienceItem.item_id, -1) }
    expect(document.content_json.sections.find((section) => section.instance_id === experienceId).items.map((item) => item.item_id)).toEqual([secondExperienceItem.item_id, firstExperienceItem.item_id])

    const contentBeforeSectionMove = JSON.parse(JSON.stringify(document.content_json))
    const educationId = sections.education.instance_id
    document = moveSection(document, educationId, -1)
    expect(document.content_json).toEqual(contentBeforeSectionMove)
    expect(getOrderedSections(document).map(({ section }) => section.instance_id)).toContain(educationId)

    document = renameSection(document, educationId, 'Đào tạo')
    document = setSectionEnabled(document, educationId, false)
    expect(document.content_json.sections.find((section) => section.instance_id === educationId)).toMatchObject({ title: 'Đào tạo', enabled: false })

    const skillsId = sections.skills.instance_id
    const skills = document.content_json.sections.find((section) => section.instance_id === skillsId)
    document = { ...document, content_json: removeItem(document.content_json, skillsId, skills.items[0].item_id) }
    document = { ...document, content_json: removeItem(document.content_json, skillsId, skills.items[1].item_id) }
    expect(document.content_json.sections.find((section) => section.instance_id === skillsId)).toMatchObject({ enabled: false, items: [] })

    document = removeSection(document, educationId)
    expect(document.content_json.sections.some((section) => section.instance_id === educationId)).toBe(false)
    expect(document.layout_json.regions.flatMap((region) => region.section_instance_ids).includes(educationId)).toBe(false)
  })

  it('validates a canonical document before committing a version and paginates only the renderer projection', () => {
    const valid = ensureBasicEditorDocument(baseDocument())
    expect(validateCvDocument(valid)).toEqual([])

    const invalid = JSON.parse(JSON.stringify(valid))
    invalid.content_json.sections[1].items[0].item_id = invalid.content_json.sections[2].items[0].item_id
    invalid.style_json.theme_color = 'red'
    invalid.content_json.sections[1].items[0].description = { format: 'rich_text_v1', content: [{ type: 'html', text: '<strong>unsafe</strong>' }] }
    expect(validateCvDocument(invalid)).toEqual(expect.arrayContaining([
      'Mỗi item phải có ID duy nhất.',
      'Màu chủ đề, phông chữ hoặc style không hợp lệ.',
      'Kinh nghiệm làm việc có rich text không hợp lệ.',
    ]))

    const projection = {
      regions: [{
        id: 'main', widthPercent: 100,
        sections: Array.from({ length: 5 }, (_, index) => ({
          instance_id: `project_${index + 1}`,
          section_key: 'projects',
          items: Array.from({ length: 3 }, (_, itemIndex) => ({ item_id: `project_item_${index}_${itemIndex}`, description: { format: 'rich_text_v1', content: [{ type: 'paragraph', text: 'Nội dung dự án '.repeat(20) }] } })),
        })),
      }],
    }
    const originalProjection = JSON.parse(JSON.stringify(projection))
    const pages = paginateRendererProjection(projection, 12)

    expect(pages.length).toBeGreaterThan(1)
    expect(pages.map((page) => page.number)).toEqual(pages.map((_, index) => index + 1))
    expect(projection).toEqual(originalProjection)
  })
})
