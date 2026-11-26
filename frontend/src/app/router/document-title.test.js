import { describe, expect, it } from 'vitest'
import { adminPath, employerAppPath, employerMarketingPath } from '@/shared/config/portals'
import { resolveEmployerRouteTitle, resolveRouteTitle } from './document-title'

describe('resolveEmployerRouteTitle', () => {
  it('uses a specific title for each employer job workflow route', () => {
    expect(resolveEmployerRouteTitle(employerAppPath('/tin-tuyen-dung'))).toBe('Tin tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/tin-tuyen-dung/tao-moi'))).toBe('Đăng tin tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/tin-tuyen-dung/job_123/chinh-sua'))).toBe('Chỉnh sửa tin tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/tin-tuyen-dung/job_123'))).toBe('Chi tiết tin tuyển dụng')
  })

  it('does not fall back to the marketing title for unknown workspace routes', () => {
    expect(resolveEmployerRouteTitle(employerAppPath('/unknown'))).toBe('Trang không tồn tại')
  })

  it('titles campaign and application workspace routes consistently', () => {
    expect(resolveEmployerRouteTitle(employerAppPath('/chien-dich'))).toBe('Chiến dịch tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/chien-dich/campaign_123'))).toBe('Chi tiết chiến dịch tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/chien-dich/campaign_123/thiet-lap'))).toBe('Thiết lập chiến dịch tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/chien-dich/tao-moi'))).toBe('Tạo chiến dịch tuyển dụng')
    expect(resolveEmployerRouteTitle(employerAppPath('/ho-so-ung-tuyen'))).toBe('CV ứng tuyển')
  })

  it('titles workspace pages that used to fall through to the missing-page title', () => {
    expect(resolveEmployerRouteTitle(employerAppPath('/thong-bao'))).toBe('Thông báo hệ thống')
    expect(resolveEmployerRouteTitle(employerAppPath('/lich-su-hoat-dong'))).toBe('Lịch sử hoạt động')
    expect(resolveEmployerRouteTitle(employerAppPath('/trang-cong-ty'))).toBe('Trang công ty')
    expect(resolveEmployerRouteTitle(employerMarketingPath('/danh-gia-ho-so/tok_123'))).toBe('Đánh giá hồ sơ ứng viên')
  })

  it('leaves marketing titles to the localized layout and 404s unknown marketing paths', () => {
    expect(resolveEmployerRouteTitle(employerMarketingPath('/dich-vu'))).toBe('')
    expect(resolveEmployerRouteTitle(employerMarketingPath('/bao-gia'))).toBe('Trang không tồn tại')
  })
})

describe('admin route titles', () => {
  it('derives job moderation and access titles from the admin route config', () => {
    window.history.replaceState({}, '', adminPath('/duyet-tin'))
    expect(resolveRouteTitle(adminPath('/duyet-tin'))).toBe('Quản lý tin tuyển dụng')
    expect(resolveRouteTitle(adminPath('/duyet-tin/job_123'))).toBe('Chi tiết tin tuyển dụng')
    expect(resolveRouteTitle(adminPath('/tai-khoan-cua-toi'))).toBe('Tài khoản của tôi')
    expect(resolveRouteTitle(adminPath('/cong-ty'))).toBe('Quản lý công ty')
    expect(resolveRouteTitle(adminPath('/bao-cao-cong-ty'))).toBe('Báo cáo công ty')
  })

  it('titles public admin workflows and account details instead of treating them as missing routes', () => {
    window.history.replaceState({}, '', adminPath('/dat-lai-mat-khau'))
    expect(resolveRouteTitle(adminPath('/loi-moi'))).toBe('Hoàn tất tài khoản quản trị')
    expect(resolveRouteTitle(adminPath('/dat-lai-mat-khau'))).toBe('Đặt lại mật khẩu quản trị')
    expect(resolveRouteTitle(adminPath('/tai-khoan/48261937'))).toBe('Chi tiết tài khoản')
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

describe('ProCV Connect titles', () => {
  it('uses one product title for the inbox and every conversation, never a person name', () => {
    expect(resolveEmployerRouteTitle(employerAppPath('/procv-connect'))).toBe('ProCV Connect')
    expect(resolveEmployerRouteTitle(employerAppPath('/procv-connect/cnv_123'))).toBe('ProCV Connect')
    window.history.replaceState({}, '', '/procv-connect')
    expect(resolveRouteTitle('/procv-connect')).toBe('ProCV Connect')
    expect(resolveRouteTitle('/procv-connect/cnv_123')).toBe('ProCV Connect')
  })
})
