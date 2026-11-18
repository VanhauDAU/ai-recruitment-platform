import { describe, expect, it } from 'vitest'
import { getJobApplicationStatus } from './use-job-application-status'

// As served by GET /v2/applications/rules/.
const RULES = { max_submissions_per_job: 3, reapply_cooldown_seconds: 300 }
const REAPPLICATION_COOLDOWN_MS = RULES.reapply_cooldown_seconds * 1000

describe('getJobApplicationStatus', () => {
  const now = new Date('2026-07-22T10:00:00Z').getTime()
  const application = (index, overrides = {}) => ({
    public_id: `app_${index}`,
    job_public_id: 'job_1',
    applied_at: new Date(now - index * REAPPLICATION_COOLDOWN_MS * 2).toISOString(),
    is_current: false,
    actions: { reapply: false },
    ...overrides,
  })

  it('offers a first application when the candidate never applied', () => {
    const status = getJobApplicationStatus([], 'job_1', now, RULES)

    expect(status.hasApplied).toBe(false)
    expect(status.applyLabel).toBe('Ứng tuyển ngay')
  })

  it('does not offer a resubmission while the current application is in progress', () => {
    const current = application(1, { is_current: true, actions: { reapply: false } })

    const status = getJobApplicationStatus([current], 'job_1', now, RULES)

    expect(status.isPending).toBe(true)
    expect(status.isResubmission).toBe(false)
    expect(status.applyLabel).toBe('Đã ứng tuyển')
    expect(status.latestApplication).toBe(current)
  })

  it('allows a resubmission after a rejection once the cooldown has passed', () => {
    const rejected = application(1, { is_current: true, actions: { reapply: true } })

    const status = getJobApplicationStatus([rejected], 'job_1', now, RULES)

    expect(status.isResubmission).toBe(true)
    expect(status.applyLabel).toBe('Ứng tuyển lại')
    expect(status.isCoolingDown).toBe(false)
    expect(status.retriesRemaining).toBe(2)
  })

  it('waits five minutes after the latest submission', () => {
    const withdrawn = application(0, {
      is_current: true,
      actions: { reapply: true },
      applied_at: new Date(now - REAPPLICATION_COOLDOWN_MS + 1).toISOString(),
    })

    expect(getJobApplicationStatus([withdrawn], 'job_1', now, RULES).isCoolingDown).toBe(true)
  })

  it('stops resubmissions after the third application for the same job', () => {
    const applications = [
      application(1, { is_current: true, actions: { reapply: true } }),
      application(2),
      application(3),
    ]

    const status = getJobApplicationStatus(applications, 'job_1', now, RULES)

    expect(status.retriesRemaining).toBe(0)
    expect(status.isLimitReached).toBe(true)
  })
})

describe('getJobApplicationStatus before the rules load', () => {
  it('leaves the cap and cooldown to the server', () => {
    const current = { job_public_id: 'job_1', applied_at: new Date().toISOString(), is_current: true, actions: { reapply: true } }

    const status = getJobApplicationStatus([current], 'job_1', Date.now())

    expect(status.retriesRemaining).toBeNull()
    expect(status.isCoolingDown).toBe(false)
    expect(status.isLimitReached).toBe(false)
  })
})
