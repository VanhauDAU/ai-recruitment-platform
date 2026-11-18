import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hideJobRecommendation, restoreJobRecommendation } from './hidden-job.api'

const { post, remove } = vi.hoisted(() => ({
  post: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@/shared/api/client', () => ({ default: { delete: remove, post } }))

describe('hidden recommendation API', () => {
  beforeEach(() => {
    post.mockReset()
    remove.mockReset()
  })

  it('hides and restores only the requested public job id', async () => {
    post.mockResolvedValue({ data: { hidden: true, job_public_id: 'job_1' } })
    remove.mockResolvedValue({ data: { hidden: false, job_public_id: 'job_1' } })

    await expect(hideJobRecommendation('job_1', 'homepage')).resolves.toMatchObject({ hidden: true })
    await expect(restoreJobRecommendation('job_1')).resolves.toMatchObject({ hidden: false })

    expect(post).toHaveBeenCalledWith('/jobs/recommendations/hidden/', {
      job_public_id: 'job_1',
      source: 'homepage',
    })
    expect(remove).toHaveBeenCalledWith('/jobs/recommendations/hidden/job_1/')
  })
})
