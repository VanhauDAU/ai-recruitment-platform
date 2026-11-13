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

  it('exposes service management as a real workspace route', () => {
    const services = EMPLOYER_NAV_ITEMS.find(
      (item) => item.key === '/tuyendung/app/services',
    )

    expect(services).toMatchObject({ label: 'Dịch vụ của tôi' })
    expect(services.disabled).not.toBe(true)
    expect(employerRouteTitle('/tuyendung/app/services')).toBe('Dịch vụ của tôi')
    expect(employerSelectedMenuKey('/tuyendung/app/services')).toBe('/tuyendung/app/services')
  })
})
