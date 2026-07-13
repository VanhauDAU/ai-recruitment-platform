import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, patch } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { get, patch } }))

import { getCandidateProfile, updateCandidateProfile } from './candidate-profile.api'

describe('candidate profile API', () => {
  beforeEach(() => {
    get.mockReset()
    patch.mockReset()
  })

  it('reads and updates the current candidate profile', async () => {
    get.mockResolvedValue({ data: { gender: 'female' } })
    patch.mockResolvedValue({ data: { gender: 'male' } })

    await expect(getCandidateProfile()).resolves.toEqual({ gender: 'female' })
    await expect(updateCandidateProfile({ gender: 'male' })).resolves.toEqual({ gender: 'male' })
    expect(get).toHaveBeenCalledWith('/candidate/profile/')
    expect(patch).toHaveBeenCalledWith('/candidate/profile/', { gender: 'male' })
  })
})
