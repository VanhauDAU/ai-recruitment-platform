import { beforeEach, describe, expect, it, vi } from 'vitest'
import { submitJobApplication } from './application.api'
const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { post } }))

describe('application V2 API', () => {
  beforeEach(() => post.mockReset())

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
})
