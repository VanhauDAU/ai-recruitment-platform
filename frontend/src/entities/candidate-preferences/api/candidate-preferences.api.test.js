import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCandidateJobPreferences, getRecruiterVisibility, updateCandidateJobPreferences, updateRecruiterVisibility } from './candidate-preferences.api'
const { get, patch, put } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), put: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { get, patch, put } }))

describe('candidate job preferences API', () => {
  beforeEach(() => {
    get.mockReset()
    put.mockReset()
    patch.mockReset()
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

  it('updates recruiter visibility through the purpose-specific consent endpoint', async () => {
    const payload = { enabled: true, confirmed: true, source: 'cv_save_success' }
    get.mockResolvedValue({ data: { enabled: false, policy_version: 'v1' } })
    patch.mockResolvedValue({ data: { enabled: true, policy_version: 'v1' } })

    await expect(getRecruiterVisibility()).resolves.toMatchObject({ enabled: false })
    await expect(updateRecruiterVisibility(payload)).resolves.toMatchObject({ enabled: true })
    expect(get).toHaveBeenCalledWith('/candidate/recruiter-visibility/')
    expect(patch).toHaveBeenCalledWith('/candidate/recruiter-visibility/', payload)
  })
})
