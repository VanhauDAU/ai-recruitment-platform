import { describe, expect, it } from 'vitest'
import { jobDetailPath } from './job-paths'

describe('jobDetailPath', () => {
  it('tin thường → /viec-lam/<slug>', () => {
    expect(jobDetailPath({ slug: 'ke-toan-jb-1', brand_slug: null })).toBe('/viec-lam/ke-toan-jb-1')
  })

  it('tin của công ty có trang thương hiệu → /brand/...', () => {
    expect(jobDetailPath({ slug: 'ke-toan-jb-1', brand_slug: 'fpt-software' }))
      .toBe('/brand/fpt-software/tuyen-dung/ke-toan-jb-1')
  })

  it('dữ liệu thiếu brand_slug (endpoint stats) → URL thường', () => {
    expect(jobDetailPath({ slug: 'ke-toan-jb-1' })).toBe('/viec-lam/ke-toan-jb-1')
  })

  it('job rỗng → về trang danh sách', () => {
    expect(jobDetailPath(null)).toBe('/viec-lam')
    expect(jobDetailPath({})).toBe('/viec-lam')
  })
})
