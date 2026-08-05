import { describe, expect, it } from 'vitest'
import { canonicalPathForRoute, isIndexableRoute, resolveRouteMetadata } from './route-metadata'

const settings = {
  seo_default_title: 'ProCV - Việc làm & Tạo CV cùng AI',
  seo_default_description: 'Mô tả mặc định',
  seo_og_image: '',
  seo_robots_index: true,
  seo_google_site_verification: '',
}

describe('route metadata', () => {
  it('collapses legacy and brand job URLs onto one canonical path', () => {
    expect(canonicalPathForRoute('/jobs/backend-jb-1')).toBe('/viec-lam/backend-jb-1')
    expect(canonicalPathForRoute('/brand/acme/tuyen-dung/backend-jb-1'))
      .toBe('/viec-lam/backend-jb-1')
    expect(canonicalPathForRoute('/cv-templates/modern')).toBe('/mau-cv/chi-tiet/modern')
  })

  it('indexes public content and noindexes account/workspace routes', () => {
    expect(isIndexableRoute('/blog/huong-dan', 'main')).toBe(true)
    expect(isIndexableRoute('/tai-khoan/thong-tin', 'main')).toBe(false)
    expect(isIndexableRoute('/admin/app/dashboard', 'admin')).toBe(false)

    expect(resolveRouteMetadata({ pathname: '/blog', portal: 'main', settings }).robots)
      .toBe('index, follow')
    expect(resolveRouteMetadata({ pathname: '/login', portal: 'main', settings }).robots)
      .toBe('noindex, nofollow')
    expect(resolveRouteMetadata({ pathname: '/tro-giup', portal: 'main', settings }).robots)
      .toBe('noindex, nofollow')
  })

  it('honors the global indexing kill switch', () => {
    expect(resolveRouteMetadata({
      pathname: '/viec-lam',
      portal: 'main',
      settings: { ...settings, seo_robots_index: false },
    }).robots).toBe('noindex, nofollow')
  })
})
