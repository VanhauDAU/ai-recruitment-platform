import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSavedJobs, saveJob, unsaveJob } from './saved-jobs.api'
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/shared/api/client', () => ({ default: { get: mocks.get, post: mocks.post, delete: mocks.delete } }))

describe('saved jobs API', () => {
  beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockClear()))

  it('gets, saves and unsaves through the saved-jobs owner API', async () => {
    mocks.get.mockResolvedValue({ data: [{ job_detail: { public_id: 'job-1' } }] })
    mocks.post.mockResolvedValue({ data: { job_detail: { public_id: 'job-1' } } })
    mocks.delete.mockResolvedValue({})

    await expect(getSavedJobs()).resolves.toEqual([{ job_detail: { public_id: 'job-1' } }])
    await expect(saveJob('job-1')).resolves.toEqual({ job_detail: { public_id: 'job-1' } })
    await unsaveJob('job-1')

    expect(mocks.get).toHaveBeenCalledWith('/jobs/saved/')
    expect(mocks.post).toHaveBeenCalledWith('/jobs/saved/', { job: 'job-1' })
    expect(mocks.delete).toHaveBeenCalledWith('/jobs/saved/job-1/')
  })
})
