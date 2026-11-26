import { describe, expect, it } from 'vitest'
import { detailBackFallback } from './detail-back'

describe('detailBackFallback', () => {
  it.each([
    ['/viec-lam/ky-su-backend-abc', '/viec-lam'],
    ['/brand/vng/tuyen-dung/ky-su', '/viec-lam'],
    ['/mau-cv/chi-tiet/hien-dai', '/mau-cv'],
    ['/cv-templates/hien-dai', '/mau-cv'],
    ['/mau-cv-tieng-anh/chi-tiet/modern', '/mau-cv-tieng-anh'],
    ['/cong-ty/rainscales', '/cong-ty'],
  ])('maps %s to its listing', (pathname, listing) => {
    expect(detailBackFallback(pathname)).toBe(listing)
  })

  it.each(['/', '/viec-lam', '/viec-lam/tai/ha-noi', '/mau-cv', '/mau-cv/it', '/cong-ty', '/cong-ty/tim-kiem'])(
    'has no back button on %s',
    (pathname) => expect(detailBackFallback(pathname)).toBeNull(),
  )
})
