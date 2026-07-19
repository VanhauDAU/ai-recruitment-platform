import { findActiveAccountItem } from '@/entities/account'
import {
  adminPath,
  employerAppPath,
  employerMarketingPath,
  getCurrentPortal,
} from '@/shared/config/portals'

const EXACT_MAIN_TITLES = new Map([
  ['/', 'Trang chủ'],
  ['/viec-lam', 'Việc làm'],
  ['/viec-lam-da-luu', 'Việc làm đã lưu'],
  ['/jobs', 'Việc làm'],
  ['/chinh-sach-cookie', 'Chính sách cookie'],
  ['/tai-khoan/xac-thuc-email', 'Xác thực email'],
  ['/onboard-user', 'Cá nhân hóa việc làm'],
  ['/onboard-user-setting', 'Thiết lập hồ sơ'],
  ['/login', 'Đăng nhập'],
  ['/sign-up', 'Đăng ký tài khoản'],
  ['/register', 'Đăng ký tài khoản'],
  ['/forgot-password', 'Quên mật khẩu'],
  ['/reset-password', 'Đặt lại mật khẩu'],
  ['/oauth/callback', 'Đang xác thực tài khoản'],
])

const EXACT_EMPLOYER_TITLES = new Map([
  [employerMarketingPath(''), 'Trang chủ nhà tuyển dụng'],
  [employerMarketingPath('/gioi-thieu'), 'Giới thiệu'],
  [employerMarketingPath('/dich-vu'), 'Dịch vụ tuyển dụng'],
  [employerMarketingPath('/bao-gia'), 'Bảng giá'],
  [employerMarketingPath('/lien-he'), 'Liên hệ'],
  [employerMarketingPath('/dieu-khoan-dich-vu'), 'Điều khoản dịch vụ'],
  [employerMarketingPath('/chinh-sach-quyen-rieng'), 'Chính sách quyền riêng tư'],
  [employerAppPath('/login'), 'Đăng nhập nhà tuyển dụng'],
  [employerAppPath('/register'), 'Đăng ký nhà tuyển dụng'],
  [employerAppPath('/forgot-password'), 'Quên mật khẩu'],
  [employerAppPath('/reset-password'), 'Đặt lại mật khẩu'],
  [employerAppPath('/account/verify'), 'Xác thực email'],
  [employerAppPath('/account/complete-profile'), 'Hoàn thiện hồ sơ nhà tuyển dụng'],
  [employerAppPath('/onboarding'), 'Hoàn thiện hồ sơ nhà tuyển dụng'],
  [employerAppPath('/consulting-need'), 'Nhu cầu tuyển dụng'],
  [employerAppPath('/employer-verify'), 'Xác thực tài khoản'],
  [employerAppPath('/account/phone-verify'), 'Xác thực số điện thoại'],
  [employerAppPath('/account/settings/account-info'), 'Thông tin tài khoản'],
  [employerAppPath('/account/settings/password-login'), 'Thay đổi mật khẩu'],
  [employerAppPath('/account/settings/company'), 'Thông tin công ty'],
  [employerAppPath('/account/settings/gpkd'), 'Giấy đăng ký doanh nghiệp'],
  [employerAppPath('/account/settings/personal-data-protection'), 'Văn bản xử lý dữ liệu cá nhân'],
  [employerAppPath('/account/settings/general-setting'), 'Cài đặt'],
  [employerAppPath('/dashboard'), 'Bảng tin'],
])

const EXACT_ADMIN_TITLES = new Map([
  [adminPath('/login'), 'Đăng nhập quản trị'],
  [adminPath('/dashboard'), 'Bảng điều khiển'],
  [adminPath('/settings'), 'Cài đặt hệ thống'],
  [adminPath('/cv-catalogue'), 'Catalogue CV'],
  [adminPath('/services'), 'Dịch vụ nhà tuyển dụng'],
  [adminPath('/consultation-leads'), 'Khách hàng tư vấn'],
])

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '')
}

function mainTitle(pathname) {
  const exact = EXACT_MAIN_TITLES.get(pathname)
  if (exact) return exact

  const accountItem = findActiveAccountItem(pathname)
  if (accountItem) return accountItem.label
  if (pathname === '/tai-khoan') return 'Quản lý tài khoản'
  if (pathname === '/cvs' || pathname.startsWith('/cvs/')) {
    if (pathname.endsWith('/edit')) return 'Chỉnh sửa CV'
    if (pathname.endsWith('/view')) return 'Xem CV'
    return 'CV của tôi'
  }
  if (pathname.startsWith('/save-cv-success/')) return 'Lưu CV thành công'
  if (pathname.startsWith('/viec-lam/tai/') || pathname.startsWith('/jobs/tai/')) return 'Việc làm theo địa điểm'
  if (pathname.startsWith('/viec-lam/') || pathname.startsWith('/jobs/') || pathname.startsWith('/brand/')) return 'Chi tiết việc làm'
  if (pathname === '/blog') return 'Cẩm nang nghề nghiệp'
  if (pathname.startsWith('/blog/danh-muc/')) return 'Danh mục cẩm nang nghề nghiệp'
  if (pathname.startsWith('/blog/')) return 'Bài viết nghề nghiệp'
  if (pathname.startsWith('/mau-cv') || pathname.startsWith('/cv-templates')) {
    if (pathname.includes('/chi-tiet/') || pathname.match(/^\/cv-templates\/[^/]+$/)) return 'Chi tiết mẫu CV'
    return 'Mẫu CV chuyên nghiệp'
  }
  if (pathname.startsWith('/cv/share/')) return 'CV được chia sẻ'
  return 'Trang không tồn tại'
}

function employerTitle(pathname) {
  const exact = EXACT_EMPLOYER_TITLES.get(pathname)
  if (exact) return exact
  if (pathname.startsWith(employerAppPath('/account/settings/'))) return 'Cài đặt tài khoản'
  if (pathname.startsWith(employerMarketingPath('/'))) return 'Cổng nhà tuyển dụng'
  return 'Trang không tồn tại'
}

function adminTitle(pathname) {
  return EXACT_ADMIN_TITLES.get(pathname) || 'Trang không tồn tại'
}

export function resolveRouteTitle(pathname) {
  const normalized = normalizePath(pathname)
  const portal = getCurrentPortal()
  if (portal === 'employer') return employerTitle(normalized)
  if (portal === 'admin') return adminTitle(normalized)
  return mainTitle(normalized)
}
