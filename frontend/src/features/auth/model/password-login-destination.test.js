import { describe, expect, it } from 'vitest'
import { getPasswordLoginDestination } from './password-login-destination'

describe('password login onboarding destination', () => {
  it('sends an unconfigured candidate to onboarding', () => {
    expect(getPasswordLoginDestination({
      user: { role: 'candidate', job_preferences_configured: false },
      returnUrl: '',
    })).toBe('/onboard-user')
  })

  it('sends an unconfigured candidate to onboarding even with a safe return URL', () => {
    expect(getPasswordLoginDestination({
      user: { role: 'candidate', job_preferences_configured: false },
      returnUrl: '/viec-lam/react',
    })).toBe('/onboard-user')
  })

  it('sends a configured candidate to the main home', () => {
    expect(getPasswordLoginDestination({
      user: { role: 'candidate', job_preferences_configured: true },
      returnUrl: '',
    })).toBe('/')
  })
})
