import { beforeEach, describe, expect, it, vi } from 'vitest'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { post } }))

import { submitJobApplication } from './application.api'

describe('application V2 API', () => {
  beforeEach(() => post.mockReset())

  it('submits the explicitly selected CV version to the V2 candidate endpoint', async () => {
    post.mockResolvedValue({ data: { public_id: 'app_1', submitted_cv_version_public_id: 'cvv_2' } })

    await expect(submitJobApplication({
      jobPublicId: 'job_1', cvPublicId: 'cv_1', versionPublicId: 'cvv_2', coverLetter: 'Hello',
    })).resolves.toMatchObject({ public_id: 'app_1' })

    expect(post).toHaveBeenCalledWith('/v2/applications/', {
      job_public_id: 'job_1', cv_public_id: 'cv_1', version_public_id: 'cvv_2', cover_letter: 'Hello',
    })
  })
})
