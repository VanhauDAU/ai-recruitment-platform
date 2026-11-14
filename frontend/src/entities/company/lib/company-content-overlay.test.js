import { describe, expect, it } from 'vitest'
import { applyPendingCompanyContent } from './company-content-overlay'

const REGISTRY = {
  sections: [
    { key: 'about', title: 'Giới thiệu công ty', zone: 'main' },
    { key: 'jobs', title: 'Việc làm đang tuyển', zone: 'main' },
    { key: 'benefits', title: 'Phúc lợi', zone: 'main' },
    { key: 'culture', title: 'Văn hoá công ty', zone: 'main' },
    { key: 'gallery', title: 'Hình ảnh công ty', zone: 'main' },
    { key: 'video', title: 'Video giới thiệu', zone: 'main' },
    { key: 'general_info', title: 'Thông tin chung', zone: 'sidebar' },
    { key: 'offices', title: 'Địa điểm', zone: 'sidebar' },
    { key: 'social_links', title: 'Mạng xã hội', zone: 'sidebar' },
    { key: 'share', title: 'Chia sẻ công ty', zone: 'sidebar' },
  ],
  social_networks: [
    { key: 'facebook', label: 'Facebook' },
    { key: 'linkedin', label: 'LinkedIn' },
  ],
}
const CONTENT = {
  identity: { display_name: 'ACME', headline: '', logo_url: 'https://cdn.example/logo.png', cover_image_url: '' },
  sections: [
    { key: 'about', type: 'rich_text', title: 'Giới thiệu công ty', body_html: '<p>Cũ</p>' },
    { key: 'jobs', type: 'jobs', title: 'Việc làm đang tuyển' },
    { key: 'benefits', type: 'rich_text', title: 'Phúc lợi', body_html: '<p>Bảo hiểm</p>' },
    { key: 'gallery', type: 'gallery', title: 'Hình ảnh công ty', items: [{ image_url: 'https://cdn.example/1.png', caption: 'A' }, { image_url: 'https://cdn.example/2.png', caption: '' }] },
  ],
  sidebar: [
    { key: 'general_info', type: 'facts', title: 'Thông tin chung', items: [] },
    { key: 'share', type: 'share', title: 'Chia sẻ công ty' },
  ],
}
const PUBLISHED = { gallery: [{ id: 3, image_url: 'https://cdn.example/1.png' }, { id: 4, image_url: 'https://cdn.example/2.png' }] }
const BENEFITS = [{ id: 7, name: 'Bảo hiểm sức khoẻ', icon: 'heart', category: 'welfare' }]
const keys = (items) => items.map((item) => item.key)
const overlay = (pending) => applyPendingCompanyContent(CONTENT, { published: PUBLISHED, pending }, { registry: REGISTRY, benefits: BENEFITS })

describe('applyPendingCompanyContent', () => {
  it('returns the content untouched without a pending request', () => {
    expect(applyPendingCompanyContent(CONTENT, { published: PUBLISHED, pending: null }, { registry: REGISTRY })).toBe(CONTENT)
  })

  it('overlays only the changed keys onto identity and rich text sections', () => {
    const profile = overlay({ headline: 'Xây phần mềm tử tế', description: '<p>Mới</p>', cover_image_url: 'https://cdn.example/cover-new.png' })

    expect(profile.identity).toMatchObject({ headline: 'Xây phần mềm tử tế', logo_url: 'https://cdn.example/logo.png', cover_image_url: 'https://cdn.example/cover-new.png' })
    expect(profile.sections.find((section) => section.key === 'about').body_html).toBe('<p>Mới</p>')
    expect(profile.sections.find((section) => section.key === 'benefits')).toBe(CONTENT.sections[2])
    expect(CONTENT.sections[0].body_html).toBe('<p>Cũ</p>')
  })

  it('inserts sections that have no published content yet in registry order', () => {
    const profile = overlay({
      culture: '<p>Cởi mở</p>',
      video_url: 'https://youtu.be/dQw4w9WgXcQ',
      social_links: { facebook: 'https://facebook.com/acme', linkedin: '' },
      offices: [{ label: 'Trụ sở chính', address_line: '1 Duy Tân', province_id: 1, province_name: 'Hà Nội', is_headquarters: true }],
    })

    expect(keys(profile.sections)).toEqual(['about', 'jobs', 'benefits', 'culture', 'gallery', 'video'])
    expect(profile.sections.at(-1)).toMatchObject({ type: 'video', title: 'Video giới thiệu', provider: 'youtube', embed_url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' })
    expect(keys(profile.sidebar)).toEqual(['general_info', 'offices', 'social_links', 'share'])
    expect(profile.sidebar[1].items).toEqual([{ label: 'Trụ sở chính', address: '1 Duy Tân', province_name: 'Hà Nội', is_headquarters: true }])
    expect(profile.sidebar[2].items).toEqual([{ network: 'facebook', label: 'Facebook', url: 'https://facebook.com/acme' }])
  })

  it('turns pending benefits into cards using the catalogue and keeps the old rich text', () => {
    const profile = overlay({ benefits: [{ benefit_id: 7, note: 'Cho cả gia đình' }, { benefit_id: 99, note: '' }] })

    expect(profile.sections.find((section) => section.key === 'benefits')).toMatchObject({
      type: 'benefits',
      items: [{ name: 'Bảo hiểm sức khoẻ', icon: 'heart', category: 'welfare', note: 'Cho cả gia đình' }],
      body_html: '<p>Bảo hiểm</p>',
    })
  })

  it('removes deleted gallery images by id and appends pending additions', () => {
    const profile = overlay({ gallery_deletions: [3], gallery_additions: [{ image_url: 'https://cdn.example/new.png' }] })

    expect(profile.sections.find((section) => section.key === 'gallery').items).toEqual([
      { image_url: 'https://cdn.example/2.png', caption: '' },
      { image_url: 'https://cdn.example/new.png', caption: '' },
    ])
  })

  it('blanks an invalid pending video so the renderer hides it', () => {
    const profile = overlay({ video_url: 'https://evil.example/video' })

    expect(profile.sections.find((section) => section.key === 'video')).toMatchObject({ provider: '', embed_url: '' })
  })
})
