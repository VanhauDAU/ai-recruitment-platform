import { describe, expect, it } from 'vitest'
import { canAccessAdminRoute, firstAccessibleAdminRoute } from './access-policy'

describe('canAccessAdminRoute', () => {
  it('opens every regular route to any admin', () => {
    expect(canAccessAdminRoute({ segment: '/blog' }, { isSuperuser: false })).toBe(true)
  })

  it('keeps superuser-only routes closed to regular admins', () => {
    const route = { segment: '/settings', requireSuperuser: true }
    expect(canAccessAdminRoute(route, { isSuperuser: false })).toBe(false)
    expect(canAccessAdminRoute(route, { isSuperuser: true })).toBe(true)
  })

  it('lands on the first navigable route the admin can open', () => {
    const routes = [
      { segment: '/settings', requireSuperuser: true, showInNav: true },
      { segment: '/detail', showInNav: false },
      { segment: '/blog', showInNav: true },
    ]
    expect(firstAccessibleAdminRoute(routes, { isSuperuser: false }).segment).toBe('/blog')
    expect(firstAccessibleAdminRoute(routes, { isSuperuser: true }).segment).toBe('/settings')
  })
})
