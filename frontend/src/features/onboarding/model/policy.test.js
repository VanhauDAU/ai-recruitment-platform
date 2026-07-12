import { describe, expect, it } from 'vitest'
import { getOnboardingDecision } from './policy'

const paths = { onboardingPath: '/onboard-user', homePath: '/' }

describe('onboarding route policy', () => {
  it('does not affect users until the backend provides onboarding status', () => {
    expect(getOnboardingDecision({ ...paths, status: undefined, pathname: '/tai-khoan' })).toEqual({ type: 'allow' })
  })

  it.each(['not_started', 'in_progress'])('sends pending status %s to onboarding once', (status) => {
    expect(getOnboardingDecision({ ...paths, status, pathname: '/tai-khoan' }))
      .toEqual({ type: 'redirect', to: '/onboard-user' })
    expect(getOnboardingDecision({ ...paths, status, pathname: '/onboard-user/setting' })).toEqual({ type: 'allow' })
  })

  it.each(['completed', 'skipped'])('does not send terminal status %s back to onboarding', (status) => {
    expect(getOnboardingDecision({ ...paths, status, pathname: '/onboard-user' }))
      .toEqual({ type: 'redirect', to: '/' })
    expect(getOnboardingDecision({ ...paths, status, pathname: '/viec-lam' })).toEqual({ type: 'allow' })
  })
})
