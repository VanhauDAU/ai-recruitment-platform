import { describe, expect, it } from 'vitest'
import { getAuthDestination } from './password-login-destination'

describe('authentication onboarding destination', () => {
  it('sends an unconfigured candidate to onboarding after registration or login', () => {
    expect(getAuthDestination({
      user: { role: 'candidate', job_preferences_configured: false },
      returnUrl: '',
    })).toBe('/hoan-thien-ho-so')
  })

  it('sends an unconfigured candidate to onboarding even with a safe return URL', () => {
    expect(getAuthDestination({
      user: { role: 'candidate', job_preferences_configured: false },
      returnUrl: '/viec-lam/react',
    })).toBe('/hoan-thien-ho-so')
  })

  it('sends a configured candidate to the main home', () => {
    expect(getAuthDestination({
      user: { role: 'candidate', job_preferences_configured: true },
      returnUrl: '',
    })).toBe('/')
  })

  it.each([
    ['registration', '/tuyendung/app/hoan-thien-ho-so'],
    ['email_verification', '/tuyendung/app/xac-thuc-email'],
    ['consulting_need', '/tuyendung/app/khai-bao-nhu-cau'],
  ])('sends an employer at %s to the matching setup route', (step, destination) => {
    expect(getAuthDestination({
      user: { role: 'employer', employer_onboarding_required: true, employer_onboarding_step: step },
      returnUrl: '/tuyendung/app/tong-quan',
    })).toBe(destination)
  })

  it('sends an account-ready but unverified employer to the verification checklist', () => {
    expect(getAuthDestination({
      user: {
        role: 'employer',
        employer_onboarding_required: false,
        employer_verification_completed: false,
      },
      returnUrl: '',
    })).toBe('/tuyendung/app/xac-thuc-tai-khoan')
  })

  it('does not let a dashboard return URL skip unfinished employer verification', () => {
    expect(getAuthDestination({
      user: {
        role: 'employer',
        employer_onboarding_required: false,
        employer_verification_completed: false,
      },
      returnUrl: '/tuyendung/app/tong-quan',
    })).toBe('/tuyendung/app/xac-thuc-tai-khoan')
  })

  it('sends a fully verified employer directly to the dashboard', () => {
    expect(getAuthDestination({
      user: {
        role: 'employer',
        employer_onboarding_required: false,
        employer_verification_completed: true,
      },
      returnUrl: '',
    })).toBe('/tuyendung/app/tong-quan')
  })

  it('preserves a safe return URL for a fully verified employer', () => {
    expect(getAuthDestination({
      user: {
        role: 'employer',
        employer_onboarding_required: false,
        employer_verification_completed: true,
      },
      returnUrl: '/tuyendung/app/cai-dat/cong-ty?update=true',
    })).toBe('/tuyendung/app/cai-dat/cong-ty?update=true')
  })

  it('uses canonical job-workspace readiness when the session exposes it', () => {
    expect(getAuthDestination({
      user: {
        role: 'employer',
        employer_onboarding_required: false,
        employer_job_workspace_ready: true,
        employer_verification_completed: false,
      },
      returnUrl: '/tuyendung/app/tin-tuyen-dung',
    })).toBe('/tuyendung/app/tin-tuyen-dung')
  })

  it('fails closed when canonical session readiness is present but malformed', () => {
    expect(getAuthDestination({
      user: {
        role: 'employer',
        employer_onboarding_required: false,
        employer_job_workspace_ready: 'true',
        employer_verification_completed: true,
      },
      returnUrl: '/tuyendung/app/tin-tuyen-dung',
    })).toBe('/tuyendung/app/xac-thuc-tai-khoan')
  })
})
