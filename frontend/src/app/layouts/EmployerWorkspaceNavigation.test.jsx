import { describe, expect, it } from 'vitest'
import {
  EMPLOYER_NAV_ITEMS,
  employerRouteTitle,
  employerSelectedMenuKey,
} from './EmployerWorkspaceNavigation'

describe('EmployerWorkspaceNavigation', () => {
  it('registers notification and activity as real workspace routes', () => {
    const routableKeys = EMPLOYER_NAV_ITEMS.filter((item) => item?.key).map((item) => item.key)

    expect(routableKeys).toContain('/tuyendung/app/notifications')
    expect(routableKeys).toContain('/tuyendung/app/activities')
    expect(routableKeys).not.toContain('coming-activity')
    expect(routableKeys).not.toContain('coming-system-notifications')
    expect(employerRouteTitle('/tuyendung/app/notifications')).toBe('Thông báo hệ thống')
    expect(employerSelectedMenuKey('/tuyendung/app/activities')).toBe('/tuyendung/app/activities')
  })

  it('registers the company page workspace with its own menu item and title', () => {
    const item = EMPLOYER_NAV_ITEMS.find((entry) => entry.key === '/tuyendung/app/company-page')

    expect(item).toMatchObject({ label: 'Trang công ty', title: 'Trang công ty' })
    expect(item.disabled).toBeUndefined()
    expect(employerRouteTitle('/tuyendung/app/company-page')).toBe('Trang công ty')
    expect(employerSelectedMenuKey('/tuyendung/app/company-page')).toBe('/tuyendung/app/company-page')
  })
})
