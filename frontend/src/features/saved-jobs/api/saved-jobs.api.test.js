import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSavedJobRecommendations,
  getSavedJobs,
  saveJob,
  unsaveJob,
} from './saved-jobs.api'
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

  it('loads rule-based recommendations from saved-job history', async () => {
    const payload = {
      status: 'ready',
      strategy: 'saved-job-similarity-v1',
      source_saved_job_count: 2,
      results: [{ public_id: 'job-2', similarity_score: 74 }],
    }
    mocks.get.mockResolvedValue({ data: payload })

    await expect(getSavedJobRecommendations(8)).resolves.toEqual(payload)
    expect(mocks.get).toHaveBeenCalledWith('/jobs/recommendations/by-saved/', {
      params: { limit: 8 },
    })
  })
})
