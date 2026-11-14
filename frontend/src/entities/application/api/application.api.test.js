import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getApplicationHistory,
  getCandidateApplications,
  getRecruiterApplicationPage,
  getRecruiterApplicationSnapshot,
  submitJobApplication,
  decideApplicationStatus,
  downloadApplicationCv,
  getApplicationCvExport,
  requestApplicationCvExport,
  undoApplicationStatusChange,
  updateApplicationAssessment,
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
      .mockResolvedValueOnce({ data: { count: 1, results: [{ public_id: 'app_2' }] } })
      .mockResolvedValueOnce({ data: { application_public_id: 'app_2' } })
      .mockResolvedValueOnce({ data: { results: [{ to_status: 'viewed' }] } })
    patch.mockResolvedValue({ data: { public_id: 'app_2', employer_rating: 4 } })

    await expect(getCandidateApplications()).resolves.toEqual([{ public_id: 'app_1' }])
    await expect(getRecruiterApplicationPage({ status: 'submitted' })).resolves.toEqual({
      count: 1,
      results: [{ public_id: 'app_2' }],
    })
    await expect(updateApplicationAssessment('app_2', { employer_rating: 4 })).resolves.toMatchObject({ employer_rating: 4 })
    await expect(getRecruiterApplicationSnapshot('app_2')).resolves.toEqual({ application_public_id: 'app_2' })
    await expect(getApplicationHistory('app_2')).resolves.toEqual([{ to_status: 'viewed' }])

    expect(get).toHaveBeenNthCalledWith(1, '/v2/applications/')
    expect(get).toHaveBeenNthCalledWith(2, '/v2/recruiter/applications/', { params: { status: 'submitted' } })
    expect(patch).toHaveBeenCalledWith('/v2/recruiter/applications/app_2/', { employer_rating: 4 })
    expect(get).toHaveBeenNthCalledWith(3, '/v2/recruiter/applications/app_2/cv/')
    expect(get).toHaveBeenNthCalledWith(4, '/v2/recruiter/applications/app_2/history/')
  })

  it('posts decisions, undo and CV export requests to the recruiter endpoints', async () => {
    post.mockResolvedValue({ data: { ok: true } })
    get.mockResolvedValueOnce({ data: { status: 'completed' } }).mockResolvedValueOnce({ data: new Blob(['%PDF']) })

    await decideApplicationStatus('app_1', 'rejected')
    await undoApplicationStatusChange('app_1')
    await requestApplicationCvExport('app_1')
    await expect(getApplicationCvExport('app_1', 'cve_1')).resolves.toEqual({ status: 'completed' })
    await expect(downloadApplicationCv('http://api/x.pdf')).resolves.toBeInstanceOf(Blob)

    expect(post).toHaveBeenNthCalledWith(1, '/v2/recruiter/applications/app_1/status/', { status: 'rejected' })
    expect(post).toHaveBeenNthCalledWith(2, '/v2/recruiter/applications/app_1/status/undo/')
    expect(post).toHaveBeenNthCalledWith(3, '/v2/recruiter/applications/app_1/cv/exports/')
    expect(get).toHaveBeenNthCalledWith(1, '/v2/recruiter/applications/app_1/cv/exports/cve_1/')
    expect(get).toHaveBeenNthCalledWith(2, 'http://api/x.pdf', { responseType: 'blob' })
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
