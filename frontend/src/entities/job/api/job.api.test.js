import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  closeEmployerJob,
  duplicateEmployerJob,
  getAdminJobModeration,
  extendEmployerJob,
  getCvJobRecommendations,
  getEmployerJob,
  getEmployerJobs,
  getJobBenefits,
  getJobLanguages,
  getJobPostingContext,
  getSkills,
  publishEmployerJob,
  reopenEmployerJob,
  reviewAdminJob,
  saveEmployerJob,
} from './job.api'

const { get, patch, post } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }))
vi.mock('@/shared/api/client', () => ({ default: { get, patch, post } }))

describe('CV job recommendations API', () => {
  beforeEach(() => {
    get.mockReset()
    patch.mockReset()
    post.mockReset()
  })

  it('scopes matching to the saved CV public id', async () => {
    get.mockResolvedValue({ data: { strategy: 'profile-rule-v1', results: [] } })

    await expect(getCvJobRecommendations('cv_1')).resolves.toMatchObject({ strategy: 'profile-rule-v1' })
    expect(get).toHaveBeenCalledWith('/jobs/recommendations/by-cv/cv_1/')
  })

  it('uses owner-scoped job workflow endpoints and persists draft data before publishing it', async () => {
    get
      .mockResolvedValueOnce({ data: { results: [{ public_id: 'job_1' }] } })
      .mockResolvedValueOnce({ data: { public_id: 'job_1' } })
      .mockResolvedValueOnce({ data: { job_postable: true } })
    post
      .mockResolvedValueOnce({ data: { public_id: 'job_draft' } })
      .mockResolvedValueOnce({ data: { public_id: 'job_active' } })
      .mockResolvedValueOnce({ data: { public_id: 'job_published' } })
      .mockResolvedValueOnce({ data: { public_id: 'job_closed' } })
      .mockResolvedValueOnce({ data: { public_id: 'job_reopened' } })
      .mockResolvedValueOnce({ data: { public_id: 'job_extended' } })
      .mockResolvedValueOnce({ data: { public_id: 'job_copy' } })
    patch
      .mockResolvedValueOnce({ data: { public_id: 'job_1' } })
      .mockResolvedValueOnce({ data: { public_id: 'job_active' } })

    await expect(getEmployerJobs({ status: 'draft' })).resolves.toEqual([{ public_id: 'job_1' }])
    await expect(getEmployerJob('job_1')).resolves.toEqual({ public_id: 'job_1' })
    await expect(getJobPostingContext()).resolves.toEqual({ job_postable: true })
    await expect(saveEmployerJob({ title: 'Nháp' })).resolves.toEqual({ public_id: 'job_draft' })
    await expect(saveEmployerJob({ title: 'Sửa' }, 'job_1')).resolves.toEqual({ public_id: 'job_1' })
    await expect(publishEmployerJob({ title: 'Mới' })).resolves.toEqual({ public_id: 'job_active' })
    await expect(publishEmployerJob({ title: 'Đã sửa' }, 'job_1')).resolves.toEqual({ public_id: 'job_published' })
    await expect(closeEmployerJob('job_1')).resolves.toEqual({ public_id: 'job_closed' })
    await expect(reopenEmployerJob('job_1', '2026-08-01')).resolves.toEqual({ public_id: 'job_reopened' })
    await expect(extendEmployerJob('job_1', '2026-08-08')).resolves.toEqual({ public_id: 'job_extended' })
    await expect(duplicateEmployerJob('job_1')).resolves.toEqual({ public_id: 'job_copy' })

    expect(get).toHaveBeenNthCalledWith(1, '/jobs/mine/', { params: { status: 'draft' } })
    expect(get).toHaveBeenNthCalledWith(2, '/jobs/mine/job_1/')
    expect(get).toHaveBeenNthCalledWith(3, '/jobs/mine/posting-context/')
    expect(post).toHaveBeenNthCalledWith(1, '/jobs/mine/?as=draft', { title: 'Nháp' })
    expect(patch).toHaveBeenNthCalledWith(1, '/jobs/mine/job_1/', { title: 'Sửa' })
    expect(post).toHaveBeenNthCalledWith(2, '/jobs/mine/', { title: 'Mới' })
    expect(patch).toHaveBeenNthCalledWith(2, '/jobs/mine/job_1/', { title: 'Đã sửa' })
    expect(post).toHaveBeenNthCalledWith(3, '/jobs/mine/job_1/submit/')
    expect(post).toHaveBeenNthCalledWith(4, '/jobs/mine/job_1/close/')
    expect(post).toHaveBeenNthCalledWith(5, '/jobs/mine/job_1/reopen/', { deadline: '2026-08-01' })
    expect(post).toHaveBeenNthCalledWith(6, '/jobs/mine/job_1/extend/', { deadline: '2026-08-08' })
    expect(post).toHaveBeenNthCalledWith(7, '/jobs/mine/job_1/duplicate/')
  })

  it('loads the normalized catalogues used by the complete manual form', async () => {
    get
      .mockResolvedValueOnce({ data: { results: [{ id: 1, name: 'Bảo hiểm' }] } })
      .mockResolvedValueOnce({ data: [{ id: 2, name: 'Tiếng Anh' }] })
      .mockResolvedValueOnce({ data: { results: [{ id: 3, name: 'React' }] } })

    await expect(getJobBenefits()).resolves.toEqual([{ id: 1, name: 'Bảo hiểm' }])
    await expect(getJobLanguages()).resolves.toEqual([{ id: 2, name: 'Tiếng Anh' }])
    await expect(getSkills()).resolves.toEqual([{ id: 3, name: 'React' }])

    expect(get).toHaveBeenNthCalledWith(1, '/jobs/benefits/')
    expect(get).toHaveBeenNthCalledWith(2, '/jobs/languages/')
    expect(get).toHaveBeenNthCalledWith(3, '/skills/')
  })

  it('uses the administrator-only moderation endpoints', async () => {
    get.mockResolvedValue({ data: { results: [{ public_id: 'job_pending' }] } })
    post.mockResolvedValue({ data: { public_id: 'job_pending', status: 'rejected' } })

    await expect(getAdminJobModeration({ status: 'pending' })).resolves.toEqual([
      { public_id: 'job_pending' },
    ])
    await expect(
      reviewAdminJob('job_pending', { action: 'reject', reason: 'Thiếu mô tả quyền lợi.' }),
    ).resolves.toMatchObject({ status: 'rejected' })

    expect(get).toHaveBeenCalledWith('/jobs/admin/moderation/', { params: { status: 'pending' } })
    expect(post).toHaveBeenCalledWith('/jobs/admin/moderation/job_pending/review/', {
      action: 'reject',
      reason: 'Thiếu mô tả quyền lợi.',
    })
  })
})
