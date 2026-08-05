import { describe, expect, it, vi } from 'vitest'
import { canRecoverAccountIdentity } from './can-recover-account-identity'

const emailPermission = 'account.email.manage'

function allowed(overrides = {}) {
  return canRecoverAccountIdentity({
    hasPermission: vi.fn(() => false),
    isSuperuser: false,
    permission: emailPermission,
    targetRole: 'candidate',
    ...overrides,
  })
}

describe('canRecoverAccountIdentity', () => {
  it('allows a superuser for every target role', () => {
    expect(allowed({ isSuperuser: true, targetRole: 'admin' })).toBe(true)
  })

  it('allows a delegated permission for a non-admin target', () => {
    expect(allowed({ hasPermission: (code) => code === emailPermission })).toBe(true)
  })

  it('denies an actor without the delegated permission', () => {
    expect(allowed()).toBe(false)
  })

  it('denies a delegated actor for an admin target', () => {
    expect(allowed({
      hasPermission: () => true,
      targetRole: 'admin',
    })).toBe(false)
  })
})
