import { describe, expect, it } from 'vitest'
import { availableSectionKeys } from './document'
import { applyPositionDetails, formatPositionValue } from './position-details'

const field = (field_key, field_type, value, extra = {}) => ({ item_id: `position_details_item_${field_key}`, field_key, label: field_key, field_type, value, ...extra })
const skeleton = (...items) => ({ section_key: 'position_details', title: 'Thông tin chuyên môn', enabled: true, items })

function documentWith(sections = []) {
  return {
    content_json: { locale: 'vi-VN', personal_info: {}, sections },
    layout_json: { regions: [{ id: 'main', width_percent: 70, section_instance_ids: sections.map((section) => section.instance_id) }, { id: 'sidebar', width_percent: 30, section_instance_ids: [] }] },
    style_json: {},
  }
}

describe('position details section', () => {
  it('adds the position skeleton as a new section placed in a region', () => {
    const next = applyPositionDetails(documentWith(), skeleton(field('github_url', 'url', '')))

    const section = next.content_json.sections[0]
    expect(section).toMatchObject({ instance_id: 'position_details_1', section_key: 'position_details', title: 'Thông tin chuyên môn' })
    expect(next.layout_json.regions.flatMap((region) => region.section_instance_ids)).toContain('position_details_1')
  })

  it('keeps values of fields shared with the new position and drops the rest', () => {
    const current = documentWith([{ instance_id: 'position_details_1', section_key: 'position_details', title: 'Cũ', enabled: true, items: [field('github_url', 'url', 'https://github.com/an'), field('stack', 'tags', ['Go'])] }])

    const next = applyPositionDetails(current, skeleton(field('github_url', 'url', ''), field('portfolio_url', 'url', '')))

    expect(next.content_json.sections[0].items.map((item) => [item.field_key, item.value])).toEqual([['github_url', 'https://github.com/an'], ['portfolio_url', '']])
    expect(current.content_json.sections[0].items).toHaveLength(2)
  })

  it('removes the section when the new position has no fields', () => {
    const current = documentWith([{ instance_id: 'position_details_1', section_key: 'position_details', title: 'Cũ', enabled: true, items: [field('stack', 'tags', [])] }])

    expect(applyPositionDetails(current, null).content_json.sections).toEqual([])
  })

  it('formats list values and hides empty ones', () => {
    expect(formatPositionValue(field('stack', 'tags', ['Python', 'Django']))).toBe('Python, Django')
    expect(formatPositionValue(field('years', 'number', 0))).toBe('0')
    expect(formatPositionValue(field('stack', 'tags', []))).toBe('')
    expect(formatPositionValue(field('date', 'date', null))).toBe('')
  })

  it('is never offered in the add-section library', () => {
    expect(availableSectionKeys({ sections: [] })).not.toContain('position_details')
    expect(availableSectionKeys({ sections: [] })).toEqual(expect.arrayContaining(['portfolio', 'publications']))
  })
})
