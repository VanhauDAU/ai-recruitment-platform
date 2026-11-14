import { describe, expect, it } from 'vitest'
import { companyDetailMetadata } from './company-detail-metadata'

const PROFILE = {
  slug: 'fpt-software',
  canonical_path: '/cong-ty/fpt-software',
  indexable: true,
  identity: {
    display_name: 'FPT Software',
    logo_url: 'https://cdn.example/logo.png',
    cover_image_url: 'https://cdn.example/cover.png',
  },
  stats: { active_public_job_count: 12 },
  sections: [
    { key: 'about', type: 'rich_text', body_html: '<p>Chúng tôi làm <strong>phần mềm</strong>.</p>' },
    { key: 'jobs', type: 'jobs' },
  ],
}

function metadata(overrides = {}) {
  return companyDetailMetadata({
    slug: 'fpt-software',
    profile: PROFILE,
    isNotFound: false,
    hasViewQuery: false,
    allowIndex: true,
    ...overrides,
  })
}

describe('companyDetailMetadata', () => {
  it('describes an indexable company with its canonical URL, cover image and breadcrumbs', () => {
    expect(metadata()).toEqual({
      title: 'FPT Software tuyển dụng',
      description: 'Chúng tôi làm phần mềm.',
      canonicalPath: '/cong-ty/fpt-software',
      imageUrl: 'https://cdn.example/cover.png',
      robots: 'index, follow',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'http://localhost/' },
          { '@type': 'ListItem', position: 2, name: 'Công ty', item: 'http://localhost/cong-ty' },
          { '@type': 'ListItem', position: 3, name: 'FPT Software', item: 'http://localhost/cong-ty/fpt-software' },
        ],
      },
    })
  })

  it('falls back to the logo and a generated description for a sparse company', () => {
    const sparse = metadata({
      profile: {
        ...PROFILE,
        canonical_path: '',
        identity: { ...PROFILE.identity, cover_image_url: '' },
        stats: { active_public_job_count: 0 },
        sections: [{ key: 'jobs', type: 'jobs' }],
      },
    })

    expect(sparse.imageUrl).toBe('https://cdn.example/logo.png')
    expect(sparse.description).toBe('Tìm hiểu FPT Software và các cơ hội việc làm đang tuyển dụng.')
    expect(sparse.canonicalPath).toBe('/cong-ty/fpt-software')
  })

  it('indexes only when the API, the site switch and a clean URL all allow it', () => {
    expect(metadata({ hasViewQuery: true }).robots).toBe('noindex, nofollow')
    expect(metadata({ hasViewQuery: true }).canonicalPath).toBe('/cong-ty/fpt-software')
    expect(metadata({ allowIndex: false }).robots).toBe('noindex, nofollow')
    expect(metadata({ profile: { ...PROFILE, indexable: false } }).robots).toBe('noindex, nofollow')
  })

  it('never indexes the loading or not-found states', () => {
    expect(metadata({ profile: null })).toEqual({
      title: 'Hồ sơ công ty',
      canonicalPath: '/cong-ty/fpt-software',
      robots: 'noindex, nofollow',
    })
    expect(metadata({ profile: null, isNotFound: true }).title).toBe('Không tìm thấy công ty')
    expect(metadata({ profile: null, isNotFound: true }).robots).toBe('noindex, nofollow')
  })
})
