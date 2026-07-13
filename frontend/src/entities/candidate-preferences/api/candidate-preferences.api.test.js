import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { get, put } }))

import { getCandidateJobPreferences, updateCandidateJobPreferences } from './candidate-preferences.api'

describe('candidate job preferences API', () => {
  beforeEach(() => {
    get.mockReset()
    put.mockReset()
  })

  it('loads the current candidate preference set', async () => {
    get.mockResolvedValue({ data: { job_preferences_configured: false } })

    await expect(getCandidateJobPreferences()).resolves.toEqual({ job_preferences_configured: false })
    expect(get).toHaveBeenCalledWith('/candidate/job-preferences/')
  })

  it('replaces the complete preference set', async () => {
    const payload = { desired_specialization_ids: [1], preferred_province_ids: [2] }
    put.mockResolvedValue({ data: { ...payload, job_preferences_configured: true } })

    await expect(updateCandidateJobPreferences(payload)).resolves.toMatchObject({ job_preferences_configured: true })
    expect(put).toHaveBeenCalledWith('/candidate/job-preferences/', payload)
  })
})
