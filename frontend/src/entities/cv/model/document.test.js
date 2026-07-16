import { describe, expect, it } from 'vitest'
import {
  addItem,
  addSection,
  availableSectionKeys,
  canDragItems,
  changeContentLocale,
  createDocumentHistory,
  ensureBasicEditorDocument,
  getRendererContract,
  getEditorCapabilities,
  getCvFontStack,
  getOrderedItems,
  getOrderedSections,
  moveItemInLayout,
  moveItemToIndexInLayout,
  projectDocumentForRenderer,
  moveSection,
  moveSectionToRegion,
  paginateMeasuredProjection,
  recordDocumentCommand,
  removeItem,
  removeSection,
  renameSection,
  resizeRegionPair,
  richTextV2,
  setMarkInRange,
  setSectionEnabled,
  undoDocumentCommand,
  redoDocumentCommand,
  updateStyle,
  toggleBooleanMarkInRange,
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

  it('keeps the optional avatar block available while excluding fixed personal markers', () => {
    const document = ensureBasicEditorDocument(baseDocument())
    const keys = availableSectionKeys(document.content_json)

    expect(keys).toContain('avatar')
    expect(keys).toContain('custom')
    expect(keys).not.toContain('experience')
    expect(keys).not.toContain('skills')
    expect(keys).not.toContain('nameplate')
    expect(keys).not.toContain('contact')
  })

  it('resets all section titles to the selected locale while preserving authored item content', () => {
    const document = ensureBasicEditorDocument(baseDocument())
    const experience = document.content_json.sections.find((section) => section.section_key === 'experience')
    experience.title = 'Dấu ấn nghề nghiệp'
    experience.items[0].role = 'Kỹ sư phần mềm'

    const localized = changeContentLocale(document.content_json, 'en-US')

    expect(localized.locale).toBe('en-US')
    expect(localized.sections.find((section) => section.section_key === 'summary').title).toBe('Career objective')
    expect(localized.sections.find((section) => section.section_key === 'skills').title).toBe('Skills')
    expect(localized.sections.find((section) => section.section_key === 'experience')).toMatchObject({ title: 'Work experience', items: [expect.objectContaining({ role: 'Kỹ sư phần mềm' })] })
    expect(document.content_json.locale).toBe('vi-VN')
  })

  it('uses deterministic browser font stacks so each supported choice has a usable fallback', () => {
    expect(getCvFontStack('Arial')).toContain('Arial')
    expect(getCvFontStack('Inter')).toContain('-apple-system')
    expect(getCvFontStack('Source Sans Pro')).toContain('Trebuchet MS')
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
    const contentBeforeItemMove = JSON.parse(JSON.stringify(document.content_json))
    document = moveItemInLayout(document, experienceId, secondExperienceItem.item_id, -1)
    expect(document.content_json).toEqual(contentBeforeItemMove)
    expect(getOrderedItems(document, document.content_json.sections.find((section) => section.instance_id === experienceId)).map((item) => item.item_id)).toEqual([secondExperienceItem.item_id, firstExperienceItem.item_id])

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

  it('moves sections and repeatable items, then resizes columns only through layout_json', () => {
    let document = ensureBasicEditorDocument(baseDocument())
    document = addSection(document, 'education')
    document = {
      ...document,
      layout_json: {
        ...document.layout_json,
        regions: [
          { ...document.layout_json.regions[0], id: 'main', width_percent: 68 },
          { id: 'sidebar', width_percent: 32, section_instance_ids: [] },
        ],
      },
    }
    const experienceId = document.content_json.sections.find((section) => section.section_key === 'experience').instance_id
    document = { ...document, content_json: addItem(document.content_json, experienceId) }
    const experience = document.content_json.sections.find((section) => section.instance_id === experienceId)
    const contentBeforePresentationChanges = JSON.parse(JSON.stringify(document.content_json))
    const [firstItem, secondItem] = experience.items

    document = moveSectionToRegion(document, experience.instance_id, 'sidebar', 0)
    document = moveItemToIndexInLayout(document, experience.instance_id, secondItem.item_id, 0)
    document = resizeRegionPair(document, 'main', 60, {
      columnResize: true,
      minColumnPercent: 25,
      maxColumnPercent: 75,
    })

    expect(document.content_json).toEqual(contentBeforePresentationChanges)
    expect(document.layout_json.regions.map((region) => [region.id, region.width_percent])).toEqual([['main', 60], ['sidebar', 40]])
    expect(document.layout_json.regions[1].section_instance_ids).toContain(experience.instance_id)
    expect(document.layout_json.item_orders[experience.instance_id]).toEqual([secondItem.item_id, firstItem.item_id])
    expect(validateCvDocument(document)).toEqual([])

    const projection = projectDocumentForRenderer(document, 'classic_two_column_v1')
    const renderedExperience = projection.regions.flatMap((region) => region.sections).find((section) => section.instance_id === experience.instance_id)
    expect(renderedExperience.items.map((item) => item.item_id)).toEqual([secondItem.item_id, firstItem.item_id])
    expect(document.content_json).toEqual(contentBeforePresentationChanges)
  })

  it('undoes and redoes local document commands without creating an autosave command', () => {
    const initial = ensureBasicEditorDocument(baseDocument())
    const changed = updateStyle(initial.style_json, { theme_color: '#2255AA' })
    const after = { ...initial, style_json: changed }
    const history = recordDocumentCommand(createDocumentHistory(), initial, after, 'Đổi màu')

    const undone = undoDocumentCommand(history)
    expect(undone.document).toEqual(initial)
    expect(undone.history.past).toHaveLength(0)
    expect(undone.history.future).toHaveLength(1)

    const redone = redoDocumentCommand(undone.history)
    expect(redone.document).toEqual(after)
    expect(redone.history.past).toHaveLength(1)
    expect(redone.history.future).toHaveLength(0)
  })

  it('enables item drag only for registry-supported sections when the template capability allows it', () => {
    const document = ensureBasicEditorDocument(baseDocument())
    const capabilities = getEditorCapabilities({ layout: { item_drag: true } })
    const experience = document.content_json.sections.find((section) => section.section_key === 'experience')
    expect(canDragItems(experience, capabilities)).toBe(true)
    expect(canDragItems({ section_key: 'languages' }, capabilities)).toBe(false)
  })

  it('validates a canonical document before committing a version and paginates only the renderer projection', () => {
    const valid = ensureBasicEditorDocument(baseDocument())
    expect(validateCvDocument(valid)).toEqual([])

    const invalid = JSON.parse(JSON.stringify(valid))
    invalid.content_json.sections[1].items[0].item_id = invalid.content_json.sections[2].items[0].item_id
    invalid.content_json.personal_info.avatar_size_mm = 81
    invalid.content_json.personal_info.avatar_zoom = 4
    invalid.style_json.theme_color = 'red'
    invalid.content_json.sections[1].items[0].description = { format: 'rich_text_v1', content: [{ type: 'html', text: '<strong>unsafe</strong>' }] }
    expect(validateCvDocument(invalid)).toEqual(expect.arrayContaining([
      'Mỗi item phải có ID duy nhất.',
      'Kích thước ảnh đại diện phải từ 20 đến 80 mm.',
      'Mức phóng ảnh đại diện phải từ 1 đến 3.',
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

  it('rejects invalid contact data and reversed entry dates before creating a version', () => {
    const document = ensureBasicEditorDocument(baseDocument())
    document.content_json.personal_info.email = 'email-sai'
    document.content_json.personal_info.phone = '123'
    document.content_json.personal_info.website = 'example.com'
    const experience = document.content_json.sections.find((section) => section.section_key === 'experience')
    experience.items[0].start_date = '2026-06'
    experience.items[0].end_date = '2026-01'

    expect(validateCvDocument(document)).toEqual(expect.arrayContaining([
      'Email trong thông tin cá nhân chưa đúng định dạng.',
      'Số điện thoại trong thông tin cá nhân chưa hợp lệ.',
      'Website trong thông tin cá nhân phải là URL http:// hoặc https:// hợp lệ.',
      'Kinh nghiệm làm việc: thời gian kết thúc không được trước thời gian bắt đầu.',
    ]))
  })

  it('round-trips rich text v2 marks and coalesces repeated inline edits', () => {
    const source = richTextV2('Xin chào Việt Nam')
    const marked = setMarkInRange(source, 0, 8, 'color', '#0066AA')
    const bold = toggleBooleanMarkInRange(marked, 0, 8, 'bold')
    const unbold = toggleBooleanMarkInRange(bold, 0, 8, 'bold')
    expect(bold.content[0].runs[0]).toMatchObject({ text: 'Xin chào', marks: { bold: true, color: '#0066AA' } })
    expect(unbold.content[0].runs[0].marks).toEqual({ color: '#0066AA' })

    const initial = ensureBasicEditorDocument(baseDocument())
    const first = { ...initial, style_json: { ...initial.style_json, font_scale: 1.05 } }
    const second = { ...initial, style_json: { ...initial.style_json, font_scale: 1.1 } }
    let history = recordDocumentCommand(createDocumentHistory(), initial, first, 'Cỡ chữ', undefined, { coalesceKey: 'font-scale', timestamp: 100 })
    history = recordDocumentCommand(history, first, second, 'Cỡ chữ', undefined, { coalesceKey: 'font-scale', timestamp: 500 })
    expect(history.past).toHaveLength(1)
    expect(undoDocumentCommand(history).document).toEqual(initial)
  })

  it('paginates a measured long section only at stable item boundaries', () => {
    const section = {
      instance_id: 'experience_1', section_key: 'experience',
      items: [1, 2, 3].map((number) => ({ item_id: `item_${number}`, role: `Vai trò ${number}` })),
    }
    const projection = { regions: [{ id: 'main', widthPercent: 100, sections: [section] }] }
    const pages = paginateMeasuredProjection(projection, {
      sections: { experience_1: 280 },
      items: { 'experience_1:item_1': 80, 'experience_1:item_2': 80, 'experience_1:item_3': 80 },
    }, 180)

    expect(pages).toHaveLength(3)
    expect(pages.flatMap((page) => page.regions[0].sections.flatMap((item) => item.items.map((entry) => entry.item_id)))).toEqual(['item_1', 'item_2', 'item_3'])
    expect(section.items).toHaveLength(3)
  })
})
