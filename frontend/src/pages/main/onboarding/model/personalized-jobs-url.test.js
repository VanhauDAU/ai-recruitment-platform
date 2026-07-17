import { describe, expect, it } from 'vitest'
import { buildPersonalizedJobsUrl } from './personalized-jobs-url'

describe('buildPersonalizedJobsUrl', () => {
  it('dựng URL /viec-lam với danh mục, từ khoá và tỉnh/thành đầu tiên', () => {
    const url = buildPersonalizedJobsUrl({
      desired_specializations: [{ id: 11 }, { id: 22 }, { id: 33 }],
      desired_position_other: '  nhân viên máy tính  ',
      preferred_provinces: [
        { id: 48, name: 'Thành phố Đà Nẵng' },
        { id: 1, name: 'Thành phố Hà Nội' },
      ],
    })

    const [pathname, query] = url.split('?')
    const params = new URLSearchParams(query)
    expect(pathname).toBe('/viec-lam/tai/da-nang')
    expect(params.get('cat')).toBe('11,22,33')
    expect(params.get('search')).toBe('nhân viên máy tính')
    expect(params.get('locations')).toBe('48')
  })

  it('bỏ qua param không có dữ liệu', () => {
    expect(buildPersonalizedJobsUrl({})).toBe('/viec-lam')
    expect(buildPersonalizedJobsUrl(null)).toBe('/viec-lam')
  })

  it('không thêm search khi vị trí tự nhập để trống', () => {
    const url = buildPersonalizedJobsUrl({
      desired_specializations: [{ id: 5 }],
      desired_position_other: '   ',
      preferred_provinces: [{ id: 2, name: 'Tỉnh Nghệ An' }],
    })
    expect(url).toBe('/viec-lam/tai/nghe-an?cat=5&locations=2')
  })
})
