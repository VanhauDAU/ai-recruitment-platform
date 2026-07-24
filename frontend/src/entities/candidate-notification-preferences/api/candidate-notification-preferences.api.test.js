import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getCandidateNotificationPreferences,
  updateCandidateNotificationPreferences,
} from './candidate-notification-preferences.api'

const { get, patch } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { get, patch } }))

describe('candidate email notification preferences API', () => {
  beforeEach(() => {
    get.mockReset()
    patch.mockReset()
  })

  it('loads notification preferences from the candidate-owned endpoint', async () => {
    const preferences = {
      important_system_updates: true,
      suitable_job_recommendations: false,
    }
    get.mockResolvedValue({ data: preferences })

    await expect(getCandidateNotificationPreferences()).resolves.toEqual(preferences)
    expect(get).toHaveBeenCalledWith('/candidate/email-notification-settings/')
  })

  it('patches only the preference that changed', async () => {
    const changes = { suitable_job_recommendations: true }
    patch.mockResolvedValue({ data: changes })

    await expect(updateCandidateNotificationPreferences(changes)).resolves.toEqual(changes)
    expect(patch).toHaveBeenCalledWith('/candidate/email-notification-settings/', changes)
  })
})
