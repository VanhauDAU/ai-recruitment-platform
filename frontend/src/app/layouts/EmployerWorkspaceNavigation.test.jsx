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
})
