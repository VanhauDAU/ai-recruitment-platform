import { afterEach, describe, expect, it } from 'vitest'
import { applyDocumentMetadata } from './document-meta'

afterEach(() => {
  document.head.querySelectorAll('[data-seo-managed]').forEach((element) => element.remove())
  document.title = ''
})

describe('applyDocumentMetadata', () => {
  it('updates the complete share and canonical metadata contract', () => {
    applyDocumentMetadata(
      {
        title: 'Bài viết',
        description: 'Mô tả',
        canonicalPath: '/blog/bai-viet',
        imageUrl: '/cover.jpg',
        robots: 'index, follow',
        pageType: 'article',
        structuredData: {
          '@context': 'https://schema.org',
          headline: '</script><script>alert(1)</script>',
        },
      },
      { siteName: 'ProCV', portal: 'main' },
    )

    expect(document.title).toBe('Bài viết | ProCV')
    expect(document.querySelector('meta[name="description"]').content).toBe('Mô tả')
    expect(document.querySelector('link[rel="canonical"]').href).toBe('http://localhost/blog/bai-viet')
    expect(document.querySelector('meta[property="og:type"]').content).toBe('article')
    expect(document.querySelector('meta[name="twitter:card"]').content).toBe('summary_large_image')
    expect(document.querySelector('script[type="application/ld+json"]').textContent)
      .toContain('\\u003c/script\\u003e')
  })

  it('removes stale optional image and structured data from the previous route', () => {
    applyDocumentMetadata(
      {
        title: 'Có ảnh',
        description: 'Mô tả',
        canonicalPath: '/',
        imageUrl: '/cover.jpg',
        structuredData: { '@type': 'Article' },
      },
      { siteName: 'ProCV' },
    )
    applyDocumentMetadata(
      {
        title: 'Không ảnh',
        description: 'Mô tả mới',
        canonicalPath: '/viec-lam',
        imageUrl: '',
      },
      { siteName: 'ProCV' },
    )

    expect(document.querySelector('meta[property="og:image"]')).toBeNull()
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull()
  })

  it('normalizes and limits descriptions for search and share metadata', () => {
    applyDocumentMetadata(
      {
        title: 'Mô tả dài',
        description: `  ${'nội dung '.repeat(30)}  `,
        canonicalPath: '/',
      },
      { siteName: 'ProCV' },
    )

    const description = document.querySelector('meta[name="description"]').content
    expect(description.length).toBeLessThanOrEqual(160)
    expect(description.endsWith('…')).toBe(true)
    expect(document.querySelector('meta[property="og:description"]').content)
      .toBe(description)
  })
})
