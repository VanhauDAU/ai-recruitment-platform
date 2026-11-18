import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getJobFit, listJobFits, requestJobFit } from './job-fit.api'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/shared/api/client', () => ({ default: mocks }))

describe('job fit API', () => {
  beforeEach(() => {
    mocks.get.mockReset()
    mocks.post.mockReset()
  })

  it('requests an analysis with the job slug and CV public id', async () => {
    mocks.post.mockResolvedValue({ data: { public_id: 'ma_1', status: 'queued' } })
    await expect(requestJobFit({ jobSlug: 'dev-jb_1', cvPublicId: 'cv_1' })).resolves.toEqual({ public_id: 'ma_1', status: 'queued' })
    expect(mocks.post).toHaveBeenCalledWith('/matching/analyses/', { job: 'dev-jb_1', cv: 'cv_1' })
  })

  it('reads one analysis and the recent ones for a job', async () => {
    mocks.get.mockResolvedValueOnce({ data: { public_id: 'ma_1' } }).mockResolvedValueOnce({ data: [{ public_id: 'ma_1' }] })
    await expect(getJobFit('ma_1')).resolves.toEqual({ public_id: 'ma_1' })
    await expect(listJobFits('dev-jb_1')).resolves.toEqual([{ public_id: 'ma_1' }])
    expect(mocks.get).toHaveBeenNthCalledWith(1, '/matching/analyses/ma_1/')
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/matching/analyses/', { params: { job: 'dev-jb_1' } })
  })
})
