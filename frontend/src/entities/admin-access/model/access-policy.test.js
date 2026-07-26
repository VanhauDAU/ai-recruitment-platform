import { describe, expect, it, vi } from 'vitest'
import { canAccessAdminRoute } from './access-policy'

describe('canAccessAdminRoute', () => {
  it('allows account management when any delegated account permission is present', () => {
    const has = vi.fn((code) => code === 'account.admin.invite')
    expect(canAccessAdminRoute({
      permissionsAny: ['account.view', 'account.admin.view', 'account.admin.invite'],
    }, {
      has,
      isSuperuser: false,
    })).toBe(true)
  })

  it('keeps superuser-only independent from permission-any routing', () => {
    expect(canAccessAdminRoute({
      permissionsAny: ['account.admin.manage'],
      requireSuperuser: true,
    }, {
      has: () => true,
      isSuperuser: false,
    })).toBe(false)
  })
})
