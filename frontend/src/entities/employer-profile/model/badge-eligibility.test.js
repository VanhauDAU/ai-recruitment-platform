import { describe, expect, it } from 'vitest'
import { resolveEmployerBadgeEligibility } from './badge-eligibility'

describe('resolveEmployerBadgeEligibility', () => {
  it('prefers the backend self breakdown', () => {
    expect(resolveEmployerBadgeEligibility({
      badge_eligibility: {
        verified: false,
        minimum_account_months: 6,
        criteria: [{ key: 'account_age_reached', passed: false }],
      },
      onboarding: { account_age_reached: true },
    })).toMatchObject({
      verified: false,
      minimum_account_months: 6,
      criteria: [{
        key: 'account_age_reached',
        label: 'Tài khoản đã đạt tuổi tối thiểu',
        passed: false,
      }],
    })
  })

  it('supports compatibility onboarding fields without inventing missing criteria', () => {
    expect(resolveEmployerBadgeEligibility({
      onboarding: {
        phone_verified: true,
        business_doc_approved: false,
      },
    })).toMatchObject({
      verified: false,
      criteria: [
        { key: 'phone_verified', passed: true },
        { key: 'business_doc_approved', passed: false },
      ],
    })
  })

  it('does not expose a made-up readiness result when the backend has no badge data', () => {
    expect(resolveEmployerBadgeEligibility({ onboarding: { email_verified: true } })).toBeNull()
  })
})
