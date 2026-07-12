import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}))

import api from '@/shared/api/client'
import {
  createApplication,
  getCandidateApplications,
  getEmployerApplications,
  updateEmployerApplication,
} from './applicationService'

describe('applicationService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps candidate list and apply request contracts', async () => {
    api.get.mockResolvedValueOnce({ data: { results: [] } })
    api.post.mockResolvedValueOnce({ data: { public_id: 'app_1' } })

    await expect(getCandidateApplications({ page: 2 })).resolves.toEqual({ results: [] })
    await expect(createApplication({ job: 'job_1', cv: 'cv_1' })).resolves.toEqual({ public_id: 'app_1' })

    expect(api.get).toHaveBeenCalledWith('/applications/', { params: { page: 2 } })
    expect(api.post).toHaveBeenCalledWith('/applications/', { job: 'job_1', cv: 'cv_1' })
  })

  it('keeps employer list and status update request contracts', async () => {
    api.get.mockResolvedValueOnce({ data: [] })
    api.patch.mockResolvedValueOnce({ data: { status: 'shortlisted' } })

    await expect(getEmployerApplications({ job: 'job_1' })).resolves.toEqual([])
    await expect(updateEmployerApplication('app_1', { status: 'shortlisted' })).resolves.toEqual({ status: 'shortlisted' })

    expect(api.get).toHaveBeenCalledWith('/applications/employer/', { params: { job: 'job_1' } })
    expect(api.patch).toHaveBeenCalledWith('/applications/employer/app_1/', { status: 'shortlisted' })
  })
})
