import { describe, expect, it } from 'vitest'
import {
  CV_MANAGEMENT_MENU_KEY,
  employerNavItems,
  employerOpenMenuKey,
  employerRouteTitle,
  employerSelectedMenuKey,
} from './EmployerWorkspaceNavigation'

const rows = (items) => items.filter((item) => item.type !== 'divider')

describe('EmployerWorkspaceNavigation', () => {
  it('lists only working pages, with the CV tools folded into one dropdown', () => {
    const items = employerNavItems()
    expect(rows(items).map((item) => item.title)).toEqual([
      'Bảng tin', 'Chiến dịch tuyển dụng', 'Tin tuyển dụng', 'Trang công ty', 'Quản lý CV',
      'Lịch sử hoạt động', 'Cài đặt tài khoản', 'Thông báo hệ thống',
    ])
    const cv = items.find((item) => item.key === CV_MANAGEMENT_MENU_KEY)
    expect(cv.children.map((item) => item.title))
      .toEqual(['CV ứng tuyển', 'Tìm CV', 'Kho ứng viên tiềm năng', 'Danh sách đen'])
    expect(items.flatMap((item) => item.children || [item]).some((item) => item.disabled)).toBe(false)
    expect(items.some((item) => item.children && item.key !== CV_MANAGEMENT_MENU_KEY)).toBe(false)
  })

  it('badges unread CVs on the inbox and hints at them on the closed dropdown', () => {
    const cv = employerNavItems({ unreadApplications: 3 }).find((item) => item.key === CV_MANAGEMENT_MENU_KEY)
    expect(cv.children[0].label.props.children[1].props['aria-label']).toBe('3 CV mới chưa xem')
    expect(cv.label.props.children[1].props['aria-label']).toBe('Có CV mới chưa xem')
  })

  it('lights a section on its detail pages and opens the CV dropdown on CV pages', () => {
    expect(employerSelectedMenuKey('/tuyendung/app/tin-tuyen-dung/jb_1/chinh-sua')).toBe('/tuyendung/app/tin-tuyen-dung')
    expect(employerSelectedMenuKey('/tuyendung/app/chien-dich/cp_1')).toBe('/tuyendung/app/chien-dich')
    expect(employerSelectedMenuKey('/tuyendung/app/cai-dat/password'))
      .toBe('/tuyendung/app/cai-dat/thong-tin-tai-khoan')
    expect(employerOpenMenuKey('/tuyendung/app/kho-ung-vien')).toBe(CV_MANAGEMENT_MENU_KEY)
    expect(employerOpenMenuKey('/tuyendung/app/tin-tuyen-dung')).toBeUndefined()
    expect(employerRouteTitle('/tuyendung/app/trang-cong-ty')).toBe('Trang công ty')
  })
})
