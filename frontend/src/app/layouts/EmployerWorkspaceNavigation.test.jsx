import { describe, expect, it } from 'vitest'
import {
  CV_MANAGEMENT_MENU_KEY,
  employerNavItems,
  employerOpenMenuKey,
  employerRouteTitle,
  employerSelectedMenuKey,
} from './EmployerWorkspaceNavigation'

const group = (key, options) => employerNavItems(options).find((item) => item.key === key)
const titles = (key) => group(key).children.map((item) => item.title)

describe('EmployerWorkspaceNavigation', () => {
  it('folds every page into four groups under the dashboard', () => {
    const items = employerNavItems()
    expect(items.map((item) => item.key)).toEqual([
      '/tuyendung/app/dashboard', 'recruiting', CV_MANAGEMENT_MENU_KEY, 'account', 'upcoming',
    ])
    expect(titles('recruiting')).toEqual(['Chiến dịch tuyển dụng', 'Tin tuyển dụng', 'Trang công ty'])
    expect(titles(CV_MANAGEMENT_MENU_KEY)).toEqual(['CV ứng tuyển', 'Kho ứng viên tiềm năng', 'Danh sách đen'])
    expect(titles('account')).toEqual(['Thông báo hệ thống', 'Lịch sử hoạt động', 'Cài đặt tài khoản'])
  })

  it('keeps roadmap features together in one closed group, all disabled', () => {
    const upcoming = group('upcoming').children
    expect(upcoming.map((item) => item.title)).toContain('Quản lý nhãn CV — Sắp mở')
    expect(upcoming.every((item) => item.disabled)).toBe(true)
    expect(employerNavItems().filter((item) => item.key !== 'upcoming')
      .flatMap((item) => item.children || [item])
      .some((item) => item.disabled)).toBe(false)
  })

  it('badges unread CVs on the inbox and hints at them on the CV group', () => {
    const cv = group(CV_MANAGEMENT_MENU_KEY, { unreadApplications: 3 })
    expect(cv.children[0].label.props.children[1].props['aria-label']).toBe('3 CV mới chưa xem')
    expect(cv.label.props.children[1].props['aria-label']).toBe('Có CV mới chưa xem')
  })

  it('lights a section on its detail pages and opens the group that holds it', () => {
    expect(employerSelectedMenuKey('/tuyendung/app/jobs/jb_1/edit')).toBe('/tuyendung/app/jobs')
    expect(employerSelectedMenuKey('/tuyendung/app/campaigns/cp_1')).toBe('/tuyendung/app/campaigns')
    expect(employerSelectedMenuKey('/tuyendung/app/account/settings/password'))
      .toBe('/tuyendung/app/account/settings/account-info')
    expect(employerOpenMenuKey('/tuyendung/app/talent-pool')).toBe(CV_MANAGEMENT_MENU_KEY)
    expect(employerOpenMenuKey('/tuyendung/app/notifications')).toBe('account')
    expect(employerOpenMenuKey('/tuyendung/app/dashboard')).toBeUndefined()
    expect(employerRouteTitle('/tuyendung/app/company-page')).toBe('Trang công ty')
  })
})
