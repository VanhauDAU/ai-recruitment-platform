import { describe, expect, it } from 'vitest'
import {
  CV_MANAGEMENT_MENU_KEY,
  employerNavItems,
  employerRouteTitle,
  employerSelectedMenuKey,
} from './EmployerWorkspaceNavigation'

describe('EmployerWorkspaceNavigation', () => {
  it('registers notification and activity as real workspace routes', () => {
    const routableKeys = employerNavItems().filter((item) => item?.key).map((item) => item.key)

    expect(routableKeys).toContain('/tuyendung/app/notifications')
    expect(routableKeys).toContain('/tuyendung/app/activities')
    expect(routableKeys).not.toContain('coming-activity')
    expect(routableKeys).not.toContain('coming-system-notifications')
    expect(employerRouteTitle('/tuyendung/app/notifications')).toBe('Thông báo hệ thống')
    expect(employerSelectedMenuKey('/tuyendung/app/activities')).toBe('/tuyendung/app/activities')
  })

  it('registers the company page workspace with its own menu item and title', () => {
    const item = employerNavItems().find((entry) => entry.key === '/tuyendung/app/company-page')

    expect(item).toMatchObject({ label: 'Trang công ty', title: 'Trang công ty' })
    expect(item.disabled).toBeUndefined()
    expect(employerRouteTitle('/tuyendung/app/company-page')).toBe('Trang công ty')
    expect(employerSelectedMenuKey('/tuyendung/app/company-page')).toBe('/tuyendung/app/company-page')
  })

  it('groups the CV inbox with the upcoming CV tools and selects it on its route', () => {
    const group = employerNavItems({ unreadApplications: 3 }).find((item) => item.key === CV_MANAGEMENT_MENU_KEY)
    const [inbox, talentPool, blocklist, ...upcoming] = group.children

    expect(inbox).toMatchObject({ key: '/tuyendung/app/applications', title: 'CV ứng tuyển' })
    expect(inbox.disabled).toBeUndefined()
    expect(blocklist).toMatchObject({ key: '/tuyendung/app/candidate-blocks', title: 'Danh sách đen' })
    expect(talentPool.disabled).toBe(true)
    expect(upcoming.map((item) => item.title)).toEqual([
      'Quản lý nhãn CV — Sắp mở',
      'Quản lý yêu cầu kết nối CV — Sắp mở',
    ])
    expect(upcoming.every((item) => item.disabled)).toBe(true)
    expect(employerSelectedMenuKey('/tuyendung/app/applications')).toBe('/tuyendung/app/applications')
    expect(employerRouteTitle('/tuyendung/app/applications')).toBe('CV ứng tuyển')
  })
})
