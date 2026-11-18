import { describe, expect, it } from 'vitest'
import { applyCompanyLayout } from './company-layout'

const REGISTRY = {
  sections: [
    { key: 'about', title: 'Giới thiệu công ty', zone: 'main', always_on: false },
    { key: 'jobs', title: 'Việc làm đang tuyển', zone: 'main', always_on: true },
    { key: 'benefits', title: 'Phúc lợi', zone: 'main', always_on: false },
    { key: 'general_info', title: 'Thông tin chung', zone: 'sidebar', always_on: true },
    { key: 'offices', title: 'Địa điểm', zone: 'sidebar', always_on: false },
  ],
  accents: [
    { key: 'brand', label: 'Xanh ProCV', primary: '#00b14f', hover: '#008a3e', soft: '#f0fbf5' },
    { key: 'ocean', label: 'Xanh biển', primary: '#0b6bcb', hover: '#084f96', soft: '#eef6ff' },
  ],
}
const CONTENT = {
  public_id: 'co_1',
  theme: { accent: REGISTRY.accents[0] },
  sections: [
    { key: 'about', type: 'rich_text', title: 'Giới thiệu công ty' },
    { key: 'jobs', type: 'jobs', title: 'Việc làm đang tuyển' },
    { key: 'benefits', type: 'rich_text', title: 'Phúc lợi' },
  ],
  sidebar: [
    { key: 'general_info', type: 'facts', title: 'Thông tin chung' },
    { key: 'offices', type: 'offices', title: 'Địa điểm' },
  ],
}
const LAYOUT = {
  section_order: ['about', 'jobs', 'benefits'],
  hidden_sections: [],
  accent: 'brand',
  pinned_job_public_ids: [],
}
const keys = (items) => items.map((item) => item.key)

describe('applyCompanyLayout', () => {
  it('reorders main sections, drops hidden ones and leaves the sidebar order fixed', () => {
    const profile = applyCompanyLayout(
      CONTENT,
      { ...LAYOUT, section_order: ['benefits', 'culture', 'jobs', 'about'], hidden_sections: ['about', 'offices'] },
      REGISTRY,
    )

    expect(keys(profile.sections)).toEqual(['benefits', 'jobs'])
    expect(keys(profile.sidebar)).toEqual(['general_info'])
    expect(profile.public_id).toBe('co_1')
  })

  it('never hides an always-on section and keeps unordered sections last', () => {
    const profile = applyCompanyLayout(
      CONTENT,
      { ...LAYOUT, section_order: ['benefits'], hidden_sections: ['jobs', 'general_info'] },
      REGISTRY,
    )

    expect(keys(profile.sections)).toEqual(['benefits', 'about', 'jobs'])
    expect(keys(profile.sidebar)).toEqual(['general_info', 'offices'])
  })

  it('takes the accent from the registry and falls back to the content theme for an unknown key', () => {
    expect(applyCompanyLayout(CONTENT, { ...LAYOUT, accent: 'ocean' }, REGISTRY).theme.accent)
      .toEqual({ key: 'ocean', primary: '#0b6bcb', hover: '#084f96', soft: '#eef6ff' })
    expect(applyCompanyLayout(CONTENT, { ...LAYOUT, accent: 'neon' }, REGISTRY).theme).toBe(CONTENT.theme)
  })

  it('attaches pinned jobs to the jobs section without mutating the input', () => {
    const snapshot = structuredClone(CONTENT)
    const profile = applyCompanyLayout(CONTENT, { ...LAYOUT, pinned_job_public_ids: ['jb_2', 'jb_1'] }, REGISTRY)

    expect(profile.sections.find((section) => section.key === 'jobs').pinned_job_public_ids).toEqual(['jb_2', 'jb_1'])
    expect(CONTENT).toEqual(snapshot)
  })
})
