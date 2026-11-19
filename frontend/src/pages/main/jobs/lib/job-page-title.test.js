// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildJobDetailTitle, buildJobListTitle } from './job-page-title'

describe('job list title', () => {
  it('uses the result count and active context without a daily-changing date', () => {
    expect(buildJobListTitle({
      count: '1.234',
      contextLabel: 'tại Hà Nội',
      loading: false,
    })).toBe('Tuyển dụng 1.234 việc làm tại Hà Nội mới nhất')
  })

  it('does not show a stale zero-result count while results are loading', () => {
    expect(buildJobListTitle({
      count: '0',
      contextLabel: 'Frontend Developer',
      loading: true,
    })).toBe('Tuyển dụng việc làm Frontend Developer mới nhất')
  })
})

describe('job detail title', () => {
  it('names the position and the hiring company', () => {
    expect(buildJobDetailTitle({ title: 'Frontend Developer', companyName: 'FPT Software' }))
      .toBe('Tuyển Frontend Developer - FPT Software')
  })

  it('does not repeat the hiring verb when the job title already starts with it', () => {
    expect(buildJobDetailTitle({ title: 'Tuyển kế toán tổng hợp', companyName: 'ABC' }))
      .toBe('Tuyển kế toán tổng hợp - ABC')
  })
})
