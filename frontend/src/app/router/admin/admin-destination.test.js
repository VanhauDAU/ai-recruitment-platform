import { describe, expect, it } from 'vitest'
import { resolveAdminDestination } from './admin-destination'

function admin(isSuperuser = false) {
  return { role: 'admin', admin_access: { is_superuser: isSuperuser } }
}

describe('resolveAdminDestination', () => {
  it('uses the first navigation route without a return URL', () => {
    expect(resolveAdminDestination(admin())).toBe('/admin/app/tong-quan')
  })

  it('keeps a return URL any admin may open', () => {
    expect(resolveAdminDestination(admin(), '/admin/app/blog')).toBe('/admin/app/blog')
  })

  it('rejects a settings return URL for a regular admin', () => {
    expect(resolveAdminDestination(admin(), '/admin/app/cau-hinh')).toBe('/admin/app/tong-quan')
  })

  it('accepts a settings return URL for a superuser', () => {
    expect(resolveAdminDestination(
      admin(true),
      '/admin/app/cau-hinh?tab=security',
    )).toBe('/admin/app/cau-hinh?tab=security')
  })
})
