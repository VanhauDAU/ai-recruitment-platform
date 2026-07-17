import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCvJobRecommendations } from './job.api'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/shared/api/client', () => ({ default: { get } }))

describe('CV job recommendations API', () => {
  beforeEach(() => get.mockReset())

  it('scopes matching to the saved CV public id', async () => {
    get.mockResolvedValue({ data: { strategy: 'profile-rule-v1', results: [] } })

    await expect(getCvJobRecommendations('cv_1')).resolves.toMatchObject({ strategy: 'profile-rule-v1' })
    expect(get).toHaveBeenCalledWith('/jobs/recommendations/by-cv/cv_1/')
  })
})
