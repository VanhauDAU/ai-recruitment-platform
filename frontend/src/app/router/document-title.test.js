import { describe, expect, it } from 'vitest'
import { adminPath, employerAppPath, employerMarketingPath } from '@/shared/config/portals'
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
    expect(resolveEmployerRouteTitle(employerAppPath('/campaigns'))).toBe('Chiến dịch tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/campaigns/campaign_123'))).toBe('Chi tiết chiến dịch tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/campaigns/campaign_123/setup'))).toBe('Thiết lập chiến dịch tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/campaigns/new'))).toBe('Tạo chiến dịch tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/applications'))).toBe('CV ứng tuyển')
  })

  it('titles workspace pages that used to fall through to the missing-page title', () => {
    expect(resolveEmployerRouteTitle(employerAppPath('/notifications'))).toBe('Thông báo hệ thống')
    expect(resolveEmployerRouteTitle(employerAppPath('/activities'))).toBe('Lịch sử hoạt động')
    expect(resolveEmployerRouteTitle(employerAppPath('/company-page'))).toBe('Trang công ty')
    expect(resolveEmployerRouteTitle(employerMarketingPath('/danh-gia-ho-so/tok_123'))).toBe('Đánh giá hồ sơ ứng viên')
  })

  it('leaves marketing titles to the localized layout and 404s unknown marketing paths', () => {
    expect(resolveEmployerRouteTitle(employerMarketingPath('/dich-vu'))).toBe('')
    expect(resolveEmployerRouteTitle(employerMarketingPath('/bao-gia'))).toBe('Trang không tồn tại')
  })
})

describe('admin route titles', () => {
  it('derives job moderation and access titles from the admin route config', () => {
    window.history.replaceState({}, '', adminPath('/job-moderation'))
    expect(resolveRouteTitle(adminPath('/job-moderation'))).toBe('Quản lý tin tuyển dụng')
    expect(resolveRouteTitle(adminPath('/job-moderation/job_123'))).toBe('Chi tiết tin tuyển dụng')
    expect(resolveRouteTitle(adminPath('/account'))).toBe('Tài khoản của tôi')
    expect(resolveRouteTitle(adminPath('/companies'))).toBe('Quản lý công ty')
    expect(resolveRouteTitle(adminPath('/company-reports'))).toBe('Báo cáo công ty')
  })

  it('titles public admin workflows and account details instead of treating them as missing routes', () => {
    window.history.replaceState({}, '', adminPath('/reset-password'))
    expect(resolveRouteTitle(adminPath('/invitation'))).toBe('Hoàn tất tài khoản quản trị')
    expect(resolveRouteTitle(adminPath('/reset-password'))).toBe('Đặt lại mật khẩu quản trị')
    expect(resolveRouteTitle(adminPath('/accounts/usr_8c63f3dbaac4'))).toBe('Chi tiết tài khoản')
  })
})

describe('candidate route titles', () => {
  it('uses the dedicated title for the public company directory', () => {
    window.history.replaceState({}, '', '/cong-ty')
    expect(resolveRouteTitle('/cong-ty')).toBe('Danh sách công ty đang tuyển dụng')
    expect(resolveRouteTitle('/cong-ty/tim-kiem')).toBe('Tìm kiếm công ty')
  })

  it('titles the company page instead of treating it as a missing route', () => {
    window.history.replaceState({}, '', '/cong-ty/fpt-software')
    expect(resolveRouteTitle('/cong-ty/fpt-software')).toBe('Hồ sơ công ty')
    expect(resolveRouteTitle('/cong-ty/fpt-software/')).toBe('Hồ sơ công ty')
    expect(resolveRouteTitle('/cong-ty/fpt-software/khac')).toBe('Trang không tồn tại')
  })

  it('titles the followed companies account page from the candidate menu', () => {
    window.history.replaceState({}, '', '/tai-khoan/cong-ty-dang-theo-doi')
    expect(resolveRouteTitle('/tai-khoan/cong-ty-dang-theo-doi')).toBe('Công ty đang theo dõi')
  })

  it('uses the dedicated title for the public job comparison route', () => {
    window.history.replaceState({}, '', '/so-sanh-viec-lam')
    expect(resolveRouteTitle('/so-sanh-viec-lam')).toBe('So sánh việc làm')
  })

  it('titles the CV upload and campaign landing routes instead of treating them as missing', () => {
    window.history.replaceState({}, '', '/tai-cv-len')
    expect(resolveRouteTitle('/tai-cv-len')).toBe('Tải CV lên')
    expect(resolveRouteTitle('/tuyen-dung/tuyen-frontend-q4')).toBe('Trang tuyển dụng')
  })
})
