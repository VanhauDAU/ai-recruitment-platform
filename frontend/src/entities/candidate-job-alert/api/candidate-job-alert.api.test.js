import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCandidateJobAlert,
  deleteCandidateJobAlert,
  getCandidateJobAlerts,
  normalizeCandidateJobAlertList,
  updateCandidateJobAlert,
} from './candidate-job-alert.api'

const { deleteRequest, get, patch, post } = vi.hoisted(() => ({
  deleteRequest: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/shared/api/client', () => ({
  default: { delete: deleteRequest, get, patch, post },
}))

describe('candidate job alerts API', () => {
  beforeEach(() => {
    deleteRequest.mockReset()
    get.mockReset()
    patch.mockReset()
    post.mockReset()
  })

  it('loads the candidate-owned list and keeps its server limit metadata', async () => {
    get.mockResolvedValue({
      data: { results: [{ public_id: 'alert_1' }], limit: 5, remaining: 4 },
    })

    await expect(getCandidateJobAlerts()).resolves.toEqual({
      results: [{ public_id: 'alert_1' }],
      limit: 5,
      remaining: 4,
    })
    expect(get).toHaveBeenCalledWith('/jobs/alerts/')
  })

  it('normalizes a legacy bare array without changing alert DTOs', () => {
    expect(normalizeCandidateJobAlertList([{ public_id: 'alert_1' }])).toEqual({
      results: [{ public_id: 'alert_1' }],
      limit: 5,
      remaining: 4,
    })
  })

  it('passes create and partial update payloads through unchanged', async () => {
    const createPayload = { keyword: 'Frontend Developer', frequency: 'daily' }
    const updatePayload = { is_active: false }
    post.mockResolvedValue({ data: { public_id: 'alert_1', ...createPayload } })
    patch.mockResolvedValue({ data: { public_id: 'alert_1', ...updatePayload } })

    await createCandidateJobAlert(createPayload)
    await updateCandidateJobAlert('alert_1', updatePayload)

    expect(post).toHaveBeenCalledWith('/jobs/alerts/', createPayload)
    expect(patch).toHaveBeenCalledWith('/jobs/alerts/alert_1/', updatePayload)
  })

  it('deletes one alert by public ID', async () => {
    deleteRequest.mockResolvedValue({ status: 204 })

    await expect(deleteCandidateJobAlert('alert_1')).resolves.toBe('alert_1')
    expect(deleteRequest).toHaveBeenCalledWith('/jobs/alerts/alert_1/')
  })
})
