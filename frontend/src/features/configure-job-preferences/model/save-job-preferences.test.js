import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveJobPreferences } from './save-job-preferences'

const mocks = vi.hoisted(() => ({ updateCandidateJobPreferences: vi.fn() }))

vi.mock('@/entities/candidate-preferences', () => ({
  updateCandidateJobPreferences: mocks.updateCandidateJobPreferences,
}))

describe('saveJobPreferences', () => {
  beforeEach(() => {
    mocks.updateCandidateJobPreferences.mockReset().mockImplementation(async (payload) => payload)
  })

  it('normalizes and dual-writes custom position tags', async () => {
    await saveJobPreferences({
      desired_position_others: ['  Kỹ sư dữ liệu ', 'kỹ SƯ dữ liệu', 'Product Owner;Business Analyst'],
    }, null)

    expect(mocks.updateCandidateJobPreferences).toHaveBeenCalledWith(expect.objectContaining({
      desired_position_other: 'Kỹ sư dữ liệu',
      desired_position_others: ['Kỹ sư dữ liệu', 'Product Owner', 'Business Analyst'],
    }))
  })

  it('preserves returned skill ids when an onboarding surface does not render the skill field', async () => {
    await saveJobPreferences({ desired_specialization_ids: [3] }, {
      preferred_skills: [{ id: 4, name: 'Python' }, { id: 8, name: 'Django' }],
    })

    expect(mocks.updateCandidateJobPreferences).toHaveBeenCalledWith(expect.objectContaining({
      preferred_skill_ids: [4, 8],
    }))
  })
})
