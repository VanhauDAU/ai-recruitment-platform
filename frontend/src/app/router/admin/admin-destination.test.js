import { describe, expect, it } from 'vitest'
import { resolveAdminDestination } from './admin-destination'

function admin(permissions, isSuperuser = false) {
  return {
    role: 'admin',
    admin_access: {
      is_superuser: isSuperuser,
      permissions,
      memberships: [],
      primary_department: null,
    },
  }
}

describe('resolveAdminDestination', () => {
  it('uses the first accessible navigation route', () => {
    expect(resolveAdminDestination(admin(['job_moderation.view']))).toBe(
      '/admin/app/job-moderation',
    )
  })

  it('falls back to the account settings page when no business permission exists', () => {
    expect(resolveAdminDestination(admin([]))).toBe('/admin/app/account')
  })

  it('rejects a settings return URL for a non-superuser with the permission', () => {
    expect(resolveAdminDestination(
      admin(['site_setting.view', 'job_moderation.view']),
      '/admin/app/settings',
    )).toBe('/admin/app/job-moderation')
  })

  it('accepts a settings return URL for a superuser', () => {
    expect(resolveAdminDestination(
      admin([], true),
      '/admin/app/settings?tab=security',
    )).toBe('/admin/app/settings?tab=security')
  })
})
