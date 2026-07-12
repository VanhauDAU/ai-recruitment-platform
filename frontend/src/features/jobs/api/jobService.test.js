import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, patch, post } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({
  default: { get, patch, post },
}))

import { createEmployerJob, getEmployerJob, getEmployerJobs, updateEmployerJob } from './jobService'

describe('employer jobs API contract', () => {
  beforeEach(() => {
    get.mockReset()
    patch.mockReset()
    post.mockReset()
  })

  it('uses the existing mine endpoints for listing and detail', async () => {
    get.mockResolvedValueOnce({ data: { results: [] } }).mockResolvedValueOnce({ data: { public_id: 'job-1' } })

    await expect(getEmployerJobs({ page: 2 })).resolves.toEqual({ results: [] })
    await expect(getEmployerJob('job-1')).resolves.toEqual({ public_id: 'job-1' })

    expect(get).toHaveBeenNthCalledWith(1, '/jobs/mine/', { params: { page: 2 } })
    expect(get).toHaveBeenNthCalledWith(2, '/jobs/mine/job-1/')
  })

  it('keeps create and update payloads unchanged', async () => {
    const payload = { title: 'Frontend Engineer' }
    post.mockResolvedValue({ data: { public_id: 'job-1' } })
    patch.mockResolvedValue({ data: { public_id: 'job-1', ...payload } })

    await createEmployerJob(payload)
    await updateEmployerJob('job-1', payload)

    expect(post).toHaveBeenCalledWith('/jobs/mine/', payload)
    expect(patch).toHaveBeenCalledWith('/jobs/mine/job-1/', payload)
  })
})
