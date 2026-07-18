import { describe, expect, it } from 'vitest'
import { getAuthDestination } from './password-login-destination'

describe('authentication onboarding destination', () => {
  it('sends an unconfigured candidate to onboarding after registration or login', () => {
    expect(getAuthDestination({
      user: { role: 'candidate', job_preferences_configured: false },
      returnUrl: '',
    })).toBe('/onboard-user')
  })

  it('sends an unconfigured candidate to onboarding even with a safe return URL', () => {
    expect(getAuthDestination({
      user: { role: 'candidate', job_preferences_configured: false },
      returnUrl: '/viec-lam/react',
    })).toBe('/onboard-user')
  })

  it('sends a configured candidate to the main home', () => {
    expect(getAuthDestination({
      user: { role: 'candidate', job_preferences_configured: true },
      returnUrl: '',
    })).toBe('/')
  })

  it.each([
    ['registration', '/tuyendung/app/account/complete-profile'],
    ['email_verification', '/tuyendung/app/account/verify'],
    ['consulting_need', '/tuyendung/app/consulting-need'],
  ])('sends an employer at %s to the matching setup route', (step, destination) => {
    expect(getAuthDestination({
      user: { role: 'employer', employer_onboarding_required: true, employer_onboarding_step: step },
      returnUrl: '/tuyendung/app/dashboard',
    })).toBe(destination)
  })

  it('sends a ready employer to the employer dashboard', () => {
    expect(getAuthDestination({
      user: { role: 'employer', employer_onboarding_required: false },
      returnUrl: '',
    })).toBe('/tuyendung/app/dashboard')
  })
})
