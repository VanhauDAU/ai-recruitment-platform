import { describe, expect, it } from 'vitest'
import {
  ensureBasicEditorDocument,
  getRendererContract,
  projectDocumentForRenderer,
  updateStyle,
} from '@/entities/cv'

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
})
