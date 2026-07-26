import { describe, expect, it } from 'vitest'
import { adminPath, employerAppPath } from '@/shared/config/portals'
import { resolveEmployerRouteTitle, resolveRouteTitle } from './document-title'

describe('resolveEmployerRouteTitle', () => {
  it('uses a specific title for each employer job workflow route', () => {
    expect(resolveEmployerRouteTitle(employerAppPath('/jobs'))).toBe('Tin tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/jobs/new'))).toBe('Đăng tin tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/jobs/job_123/edit'))).toBe('Chỉnh sửa tin tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/jobs/job_123'))).toBe('Chi tiết tin tuyển dụng')
  })

  it('does not fall back to the marketing title for unknown workspace routes', () => {
    expect(resolveEmployerRouteTitle(employerAppPath('/unknown'))).toBe('Trang không tồn tại')
  })

  it('titles campaign and application workspace routes consistently', () => {
    expect(resolveEmployerRouteTitle(employerAppPath('/campaigns'))).toBe('Quản lý chiến dịch tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/campaigns/campaign_123'))).toBe('Chi tiết chiến dịch tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/applications'))).toBe('Quản lý CV ứng tuyển')
  })
})

describe('admin route titles', () => {
  it('derives job moderation and access titles from the admin route config', () => {
    window.history.replaceState({}, '', adminPath('/job-moderation'))
    expect(resolveRouteTitle(adminPath('/job-moderation'))).toBe('Duyệt tin tuyển dụng')
    expect(resolveRouteTitle(adminPath('/account'))).toBe('Cài đặt tài khoản')
  })

  it('titles public admin workflows and account details instead of treating them as missing routes', () => {
    window.history.replaceState({}, '', adminPath('/reset-password'))
    expect(resolveRouteTitle(adminPath('/invitation'))).toBe('Hoàn tất tài khoản quản trị')
    expect(resolveRouteTitle(adminPath('/reset-password'))).toBe('Đặt lại mật khẩu quản trị')
    expect(resolveRouteTitle(adminPath('/accounts/usr_8c63f3dbaac4'))).toBe('Chi tiết tài khoản')
  })
})
