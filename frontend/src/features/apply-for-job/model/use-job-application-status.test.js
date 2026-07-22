import { describe, expect, it } from 'vitest'
import {
  getJobApplicationStatus,
  REAPPLICATION_COOLDOWN_MS,
} from './use-job-application-status'

describe('getJobApplicationStatus', () => {
  const now = new Date('2026-07-22T10:00:00Z').getTime()

  it('allows two retries and requires five minutes between submissions', () => {
    const application = {
      public_id: 'app_1',
      job_public_id: 'job_1',
      cv_public_id: 'cv_1',
      applied_at: new Date(now - REAPPLICATION_COOLDOWN_MS + 1).toISOString(),
    }

    const status = getJobApplicationStatus([application], 'job_1', now)

    expect(status.hasApplied).toBe(true)
    expect(status.retriesRemaining).toBe(2)
    expect(status.isCoolingDown).toBe(true)
    expect(status.latestApplication).toBe(application)
  })

  it('stops reapplications after the third application for the same job', () => {
    const applications = [1, 2, 3].map((index) => ({
      public_id: `app_${index}`,
      job_public_id: 'job_1',
      applied_at: new Date(now - index * REAPPLICATION_COOLDOWN_MS).toISOString(),
    }))

    const status = getJobApplicationStatus(applications, 'job_1', now)

    expect(status.retriesRemaining).toBe(0)
    expect(status.isLimitReached).toBe(true)
  })
})
