import { beforeEach, describe, expect, it, vi } from 'vitest'
import client from '@/shared/api/client'
import {
  decideAdminJob,
  getAdminJob,
  getAdminJobs,
  getAdminJobSummary,
} from './admin-job.api'

vi.mock('@/shared/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('admin job api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    client.get.mockResolvedValue({ data: {} })
    client.post.mockResolvedValue({ data: {} })
  })

  it('keeps pagination metadata for the management workspace', async () => {
    const payload = { count: 21, next: 'next', results: [] }
    client.get.mockResolvedValue({ data: payload })

    await expect(getAdminJobs({ page: 2, ordering: '-title' })).resolves.toBe(payload)
    expect(client.get).toHaveBeenCalledWith('/jobs/admin/moderation/', {
      params: { page: 2, ordering: '-title' },
      signal: undefined,
    })
  })

  it('loads summary and detail contracts', async () => {
    await getAdminJobSummary({ signal: 'summary-signal' })
    await getAdminJob('job_123', { signal: 'detail-signal' })

    expect(client.get).toHaveBeenNthCalledWith(1, '/jobs/admin/moderation/summary/', {
      signal: 'summary-signal',
    })
    expect(client.get).toHaveBeenNthCalledWith(2, '/jobs/admin/moderation/job_123/', {
      signal: 'detail-signal',
    })
  })

  it('posts a revision-bound moderation decision', async () => {
    const payload = { action: 'approve', review_token: 'signed-token' }
    await decideAdminJob('job_123', payload)

    expect(client.post).toHaveBeenCalledWith(
      '/jobs/admin/moderation/job_123/decisions/',
      payload,
    )
  })
})
