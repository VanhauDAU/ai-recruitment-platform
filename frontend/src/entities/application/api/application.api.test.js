import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getApplicationHistory,
  getCandidateApplications,
  getRecruiterApplicationSnapshot,
  getRecruiterApplications,
  submitJobApplication,
  updateApplicationStatus,
} from './application.api'
import { applicationKeys } from './application.keys'
const { get, patch, post } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { get, patch, post } }))

describe('application V2 API', () => {
  beforeEach(() => {
    get.mockReset()
    patch.mockReset()
    post.mockReset()
  })

  it('submits the explicitly selected CV version to the V2 candidate endpoint', async () => {
    post.mockResolvedValue({ data: { public_id: 'app_1', submitted_cv_version_public_id: 'cvv_2' } })

    await expect(submitJobApplication({
      jobPublicId: 'job_1',
      cvPublicId: 'cv_1',
      versionPublicId: 'cvv_2',
      coverLetter: 'Hello',
      preferredLocationIds: [3, 4],
      allowAiAnalysis: true,
      dataProcessingConsent: true,
      contactName: 'Nguyễn Văn A',
      contactEmail: 'a@example.com',
      contactPhone: '0909000000',
    })).resolves.toMatchObject({ public_id: 'app_1' })

    expect(post).toHaveBeenCalledWith('/v2/applications/', {
      job_public_id: 'job_1',
      cv_public_id: 'cv_1',
      version_public_id: 'cvv_2',
      cover_letter: 'Hello',
      preferred_location_ids: [3, 4],
      allow_ai_analysis: true,
      data_processing_consent: true,
      contact_name: 'Nguyễn Văn A',
      contact_email: 'a@example.com',
      contact_phone: '0909000000',
    })
  })

  it('reads candidate and recruiter application views through the V2 endpoints', async () => {
    get
      .mockResolvedValueOnce({ data: { results: [{ public_id: 'app_1' }] } })
      .mockResolvedValueOnce({ data: { results: [{ public_id: 'app_2' }] } })
      .mockResolvedValueOnce({ data: { application_public_id: 'app_2' } })
      .mockResolvedValueOnce({ data: { results: [{ to_status: 'viewed' }] } })
    patch.mockResolvedValue({ data: { public_id: 'app_2', status: 'considering' } })

    await expect(getCandidateApplications()).resolves.toEqual([{ public_id: 'app_1' }])
    await expect(getRecruiterApplications({ status: 'submitted' })).resolves.toEqual([{ public_id: 'app_2' }])
    await expect(updateApplicationStatus('app_2', { status: 'considering' })).resolves.toMatchObject({ status: 'considering' })
    await expect(getRecruiterApplicationSnapshot('app_2')).resolves.toEqual({ application_public_id: 'app_2' })
    await expect(getApplicationHistory('app_2')).resolves.toEqual([{ to_status: 'viewed' }])

    expect(get).toHaveBeenNthCalledWith(1, '/v2/applications/')
    expect(get).toHaveBeenNthCalledWith(2, '/v2/recruiter/applications/', { params: { status: 'submitted' } })
    expect(patch).toHaveBeenCalledWith('/v2/recruiter/applications/app_2/', { status: 'considering' })
    expect(get).toHaveBeenNthCalledWith(3, '/v2/recruiter/applications/app_2/cv/')
    expect(get).toHaveBeenNthCalledWith(4, '/v2/recruiter/applications/app_2/history/')
  })

  it('builds stable cache keys for recruiter lists, snapshots and histories', () => {
    expect(applicationKeys.recruiterList({ status: 'viewed' })).toEqual([
      'applications',
      'recruiter-list',
      { status: 'viewed' },
    ])
    expect(applicationKeys.recruiterSnapshot('app_1')).toEqual([
      'applications',
      'recruiter-snapshot',
      'app_1',
    ])
    expect(applicationKeys.history('app_1')).toEqual(['applications', 'history', 'app_1'])
  })
})
