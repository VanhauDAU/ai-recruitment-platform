import { describe, expect, it } from 'vitest'
import { createAdminAccess } from './use-admin-access'

describe('createAdminAccess', () => {
  it('reads the superuser flag from the admin snapshot', () => {
    expect(createAdminAccess({ admin_access: { is_superuser: true } })).toEqual({ isSuperuser: true })
    expect(createAdminAccess({ admin_access: { is_superuser: false } })).toEqual({ isSuperuser: false })
  })

  it('treats a missing snapshot as a regular admin', () => {
    expect(createAdminAccess({ admin_access: null })).toEqual({ isSuperuser: false })
    expect(createAdminAccess(null)).toEqual({ isSuperuser: false })
  })
})
