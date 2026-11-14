import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getAdminCompanyReports,
  resolveAdminCompanyReport,
  reverseAdminCompanyReport,
  submitCompanyReport,
} from './company-report.api'
import { companyReportKeys } from './company-report.keys'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { get, post } }))

describe('company report API', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
  })

  it('uses the candidate and paginated admin report contracts', async () => {
    const signal = new AbortController().signal
    post
      .mockResolvedValueOnce({ data: { public_id: 'crp_1', status: 'pending' } })
      .mockResolvedValueOnce({ data: { public_id: 'crp_1', status: 'upheld' } })
      .mockResolvedValueOnce({ data: { public_id: 'crp_1', status: 'dismissed' } })
    get.mockResolvedValue({
      data: { count: 1, next: null, previous: null, results: [{ public_id: 'crp_1' }] },
    })

    await expect(submitCompanyReport('co_ab12', {
      reason: 'impersonation',
      section_key: 'about',
      detail: '',
    })).resolves.toEqual({ public_id: 'crp_1', status: 'pending' })
    await expect(getAdminCompanyReports({ status: 'pending', page: 2 }, { signal }))
      .resolves.toMatchObject({ count: 1 })
    await expect(resolveAdminCompanyReport('crp_1', {
      status: 'upheld',
      note: 'Đã xác minh.',
      apply_hold: true,
    })).resolves.toMatchObject({ status: 'upheld' })
    await expect(reverseAdminCompanyReport('crp_1', 'Khiếu nại hợp lệ.'))
      .resolves.toMatchObject({ status: 'dismissed' })

    expect(post).toHaveBeenNthCalledWith(1, '/companies/co_ab12/reports/', {
      reason: 'impersonation',
      section_key: 'about',
      detail: '',
    })
    expect(get).toHaveBeenCalledWith('/admin/company-reports/', {
      signal,
      params: { status: 'pending', page: 2 },
    })
    expect(post).toHaveBeenNthCalledWith(2, '/admin/company-reports/crp_1/resolve/', {
      status: 'upheld',
      note: 'Đã xác minh.',
      apply_hold: true,
    })
    expect(post).toHaveBeenNthCalledWith(3, '/admin/company-reports/crp_1/reverse/', {
      note: 'Khiếu nại hợp lệ.',
    })
  })

  it('keeps every admin list under one invalidation root', () => {
    expect(companyReportKeys.adminList({ status: 'pending' }).slice(0, 2))
      .toEqual(companyReportKeys.adminLists)
  })
})
