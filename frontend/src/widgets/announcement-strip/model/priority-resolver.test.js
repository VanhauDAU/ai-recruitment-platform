import { describe, expect, it } from 'vitest'
import { resolveAnnouncementQueue } from './priority-resolver'
import { buildSystemAnnouncements } from './system-announcements'

function item(id, priorityTier, priority = 50, source = 'remote') {
  return { id, message: id, priorityTier, priority, source }
}

describe('announcement priority resolver', () => {
  it('allows only critical announcements to outrank email verification', () => {
    const email = buildSystemAnnouncements({
      surface: 'candidate',
      user: { role: 'candidate', email_verified: false },
      verificationPath: '/tai-khoan/xac-thuc-email',
    })[0]

    expect(resolveAnnouncementQueue([
      item('feature', 6, 1000),
      item('maintenance', 4, 1000),
      email,
    ]).map(({ id }) => id)).toEqual(['system-email-verification'])
    expect(resolveAnnouncementQueue([
      email,
      item('critical', 1, 1),
    ]).map(({ id }) => id)).toEqual(['critical'])
  })

  it('keeps email verification above the job-preference reminder', () => {
    const unverified = buildSystemAnnouncements({
      surface: 'candidate',
      user: {
        role: 'candidate',
        email_verified: false,
        job_preferences_configured: false,
      },
      verificationPath: '/verify',
    })
    const verified = buildSystemAnnouncements({
      surface: 'candidate',
      user: {
        role: 'candidate',
        email_verified: true,
        job_preferences_configured: false,
      },
      verificationPath: '/verify',
    })

    expect(unverified.map(({ id }) => id)).toEqual(['system-email-verification'])
    expect(verified.map(({ id }) => id)).toEqual([
      'system-candidate-job-preferences',
    ])
    expect(verified[0].dismiss.mode).toBe('locked')
  })

  it('rotates only equal-tier items in deterministic priority order', () => {
    expect(resolveAnnouncementQueue([
      item('security-low', 2, 10),
      item('info', 6, 1000),
      item('security-high', 2, 20),
    ]).map(({ id }) => id)).toEqual(['security-high', 'security-low'])
  })

  it('places DPA above operations and filters duplicates or invalid input', () => {
    const [dpa] = buildSystemAnnouncements({
      surface: 'employer_workspace',
      user: { role: 'employer', email_verified: true },
      employerProfileReady: true,
      employerProfile: {
        onboarding: {
          candidate_dpa_submitted: false,
          dpa_accepted: true,
        },
      },
    })
    expect(resolveAnnouncementQueue([
      item('maintenance', 4),
      dpa,
      dpa,
      null,
      { id: 'broken', priorityTier: 1 },
    ]).map(({ id }) => id)).toEqual(['system-employer-data-compliance'])
  })

  it('maps the canonical blocker action and safe server message into compliance UI', () => {
    const [compliance] = buildSystemAnnouncements({
      surface: 'employer_workspace',
      user: { role: 'employer', email_verified: true },
      employerReadinessReady: true,
      employerReadiness: {
        candidateDataAccess: false,
        blockers: [{
          code: 'dpa_outdated',
          capabilities: ['candidate_data'],
          message: 'DPA cần được cập nhật theo phiên bản hiện hành.',
          action: 'accept_current_dpa',
        }],
      },
    })

    expect(compliance.message).toBe('DPA cần được cập nhật theo phiên bản hiện hành.')
    expect(compliance.cta.label).toBe('Cập nhật DPA hiện hành')
    expect(compliance.cta.url).toBe('/tuyendung/app/account/settings/personal-data-protection')
  })
})
