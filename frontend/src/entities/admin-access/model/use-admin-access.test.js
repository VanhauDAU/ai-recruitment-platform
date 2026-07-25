import { describe, expect, it } from 'vitest'
import { createAdminAccess } from './use-admin-access'

describe('createAdminAccess', () => {
  it('normalizes an admin snapshot and checks all/any permissions', () => {
    const access = createAdminAccess({
      admin_access: {
        is_superuser: false,
        permissions: ['job_moderation.view', 'job_moderation.approve'],
        primary_department: null,
        memberships: [],
      },
    })

    expect(access.has('job_moderation.view')).toBe(true)
    expect(access.hasAny(['site_setting.view', 'job_moderation.approve'])).toBe(true)
    expect(access.hasAll(['job_moderation.view', 'job_moderation.approve'])).toBe(true)
    expect(access.hasAll(['job_moderation.view', 'job_moderation.reject'])).toBe(false)
    expect(access.primaryDepartment).toBeNull()
  })

  it('lets a superuser bypass individual permission codes', () => {
    const access = createAdminAccess({
      admin_access: {
        is_superuser: true,
        permissions: [],
        memberships: [],
      },
    })
    expect(access.has('site_setting.manage')).toBe(true)
  })
})
