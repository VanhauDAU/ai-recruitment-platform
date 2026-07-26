import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { adminPermissionCatalog } from '@/entities/admin-access'
import { ADMIN_PAGE_BY_KEY } from '../lazy/admin.pages'
import { ADMIN_ROUTES } from './admin-routes.config'

describe('ADMIN_ROUTES contract', () => {
  it('references only generated permissions', () => {
    const codes = new Set(adminPermissionCatalog.map((permission) => permission.code))
    ADMIN_ROUTES.forEach((route) => {
      if (route.permission) expect(codes.has(route.permission)).toBe(true)
      route.permissionsAny?.forEach((permission) => {
        expect(codes.has(permission)).toBe(true)
      })
    })
  })

  it('keeps the lazy registry and route config in sync both ways', () => {
    expect(ADMIN_ROUTES.map((route) => route.lazyKey).sort()).toEqual(
      Object.keys(ADMIN_PAGE_BY_KEY).sort(),
    )
  })

  it('keeps site settings explicitly superuser-only', () => {
    expect(ADMIN_ROUTES.filter((route) => route.requireSuperuser)).toEqual([
      expect.objectContaining({
        segment: '/settings',
        permission: 'site_setting.view',
      }),
    ])
  })

  it('stays import-free for direct Playwright consumption', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/app/router/admin/admin-routes.config.js'),
      'utf8',
    )
    expect(source).not.toMatch(/^\s*import\s/m)
  })
})
