import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getAdminJobReports,
  resolveAdminJobReport,
  reverseAdminJobReport,
  submitJobReport,
} from './job-report.api'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { get, post } }))

describe('job report API', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
  })

  it('uses candidate and paginated admin report contracts', async () => {
    post
      .mockResolvedValueOnce({ data: { public_id: 'jrep_1', status: 'pending' } })
      .mockResolvedValueOnce({ data: { public_id: 'jrep_1', status: 'upheld' } })
      .mockResolvedValueOnce({ data: { public_id: 'jrep_1', status: 'dismissed' } })
    get.mockResolvedValue({
      data: { count: 1, next: null, previous: null, results: [{ public_id: 'jrep_1' }] },
    })

    await expect(submitJobReport('job_1', {
      reason: 'scam',
      detail: 'Yêu cầu đóng phí.',
    })).resolves.toMatchObject({ status: 'pending' })
    await expect(getAdminJobReports({ status: 'pending', page: 2 })).resolves.toMatchObject({
      count: 1,
    })
    await expect(resolveAdminJobReport('jrep_1', {
      status: 'upheld',
      note: 'Đã xác minh.',
    })).resolves.toMatchObject({ status: 'upheld' })
    await expect(reverseAdminJobReport('jrep_1', 'Khiếu nại hợp lệ.')).resolves.toMatchObject({
      status: 'dismissed',
    })

    expect(post).toHaveBeenNthCalledWith(1, '/jobs/job_1/report/', {
      reason: 'scam',
      detail: 'Yêu cầu đóng phí.',
    })
    expect(get).toHaveBeenCalledWith('/jobs/admin/reports/', {
      params: { status: 'pending', page: 2 },
    })
    expect(post).toHaveBeenNthCalledWith(2, '/jobs/admin/reports/jrep_1/resolve/', {
      status: 'upheld',
      note: 'Đã xác minh.',
    })
    expect(post).toHaveBeenNthCalledWith(3, '/jobs/admin/reports/jrep_1/reverse/', {
      note: 'Khiếu nại hợp lệ.',
    })
  })
})
