import { findActiveAccountItem } from '@/entities/account/account'
import {
  COMPANY_DIRECTORY_PATH,
  COMPANY_SEARCH_PATH,
  isCompanyDetailPath,
} from '@/entities/company/company'
import { NOT_FOUND_TITLE } from '@/shared/config/document-title'
import {
  adminPath,
  employerAppPath,
  employerMarketingPath,
  getCurrentPortal,
} from '@/shared/config/portals'
import { ADMIN_ROUTES } from './admin/admin-routes.config'

// Quy ước ở mục "Tiêu đề trang" của frontend/ARCHITECTURE.md: "<nội dung trang> | <thương hiệu cổng>".
// Đây là tiêu đề mặc định theo route; trang có dữ liệu động (tin, công ty, bài viết…)
// tự đăng ký tiêu đề cụ thể qua useDocumentMetadata.
const EXACT_MAIN_TITLES = new Map([
  ['/', 'Trang chủ'],
  [COMPANY_DIRECTORY_PATH, 'Danh sách công ty đang tuyển dụng'],
  [COMPANY_SEARCH_PATH, 'Tìm kiếm công ty'],
  ['/viec-lam', 'Tuyển dụng việc làm mới nhất'],
  ['/jobs', 'Tuyển dụng việc làm mới nhất'],
  ['/so-sanh-viec-lam', 'So sánh việc làm'],
  ['/viec-lam-da-luu', 'Việc làm đã lưu'],
  ['/tai-cv-len', 'Tải CV lên'],
  ['/chinh-sach-cookie', 'Chính sách cookie'],
  ['/tai-khoan/xac-thuc-email', 'Xác thực email'],
  ['/onboard-user', 'Cá nhân hóa gợi ý việc làm'],
  ['/login', 'Đăng nhập tài khoản ứng viên'],
  ['/sign-up', 'Đăng ký tài khoản ứng viên'],
  ['/register', 'Đăng ký tài khoản ứng viên'],
  ['/forgot-password', 'Quên mật khẩu'],
  ['/reset-password', 'Đặt lại mật khẩu'],
  ['/blog', 'Cẩm nang nghề nghiệp'],
  ['/tro-giup', 'Câu hỏi thường gặp - Trung tâm trợ giúp'],
  ['/oauth/callback', 'Đang xác thực tài khoản'],
])

// Trang marketing tự đặt tiêu đề theo ngôn ngữ đang chọn (EmployerMarketingLayout,
// khóa `meta.*` trong locale employer); route chỉ cần nhận diện để không báo 404.
const EMPLOYER_MARKETING_PATHS = new Set(
  ['', '/gioi-thieu', '/dich-vu', '/lien-he', '/dieu-khoan-dich-vu', '/chinh-sach-quyen-rieng']
    .map((segment) => employerMarketingPath(segment)),
)

const EXACT_EMPLOYER_TITLES = new Map([
  [employerAppPath('/login'), 'Đăng nhập nhà tuyển dụng'],
  [employerAppPath('/register'), 'Đăng ký tài khoản nhà tuyển dụng'],
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
  [employerAppPath('/account/settings/recruitment-demand'), 'Nhu cầu tuyển dụng'],
  [employerAppPath('/account/settings/general-setting'), 'Cài đặt'],
  [employerAppPath('/account/settings/integrations'), 'Kết nối mạng xã hội'],
  [employerAppPath('/oauth/callback'), 'Đang xác thực tài khoản'],
  [employerAppPath('/dashboard'), 'Bảng tin'],
  [employerAppPath('/notifications'), 'Thông báo hệ thống'],
  [employerAppPath('/activities'), 'Lịch sử hoạt động'],
  [employerAppPath('/company-page'), 'Trang công ty'],
  [employerAppPath('/campaigns'), 'Chiến dịch tuyển dụng'],
  [employerAppPath('/campaigns/new'), 'Tạo chiến dịch tuyển dụng'],
  [employerAppPath('/jobs'), 'Tin tuyển dụng'],
  [employerAppPath('/jobs/new'), 'Đăng tin tuyển dụng'],
  [employerAppPath('/applications'), 'CV ứng tuyển'],
  [employerAppPath('/candidate-blocks'), 'Danh sách đen'],
  [employerAppPath('/talent-pool'), 'Kho ứng viên tiềm năng'],
])

// Thứ tự quan trọng: mẫu cụ thể (…/edit, …/setup) đứng trước mẫu chi tiết.
const DYNAMIC_EMPLOYER_TITLES = [
  [new RegExp(`^${employerAppPath('/jobs/')}[^/]+/edit$`), 'Chỉnh sửa tin tuyển dụng'],
  [new RegExp(`^${employerAppPath('/jobs/')}[^/]+$`), 'Chi tiết tin tuyển dụng'],
  [new RegExp(`^${employerAppPath('/campaigns/')}[^/]+/setup$`), 'Thiết lập chiến dịch tuyển dụng'],
  [new RegExp(`^${employerAppPath('/campaigns/')}[^/]+$`), 'Chi tiết chiến dịch tuyển dụng'],
  // Link mời đánh giá: không đưa tên ứng viên vào tiêu đề (lịch sử trình duyệt, chia sẻ tab).
  [new RegExp(`^${employerMarketingPath('/danh-gia-ho-so/')}[^/]+$`), 'Đánh giá hồ sơ ứng viên'],
]

const EXACT_ADMIN_TITLES = new Map([
  [adminPath('/login'), 'Đăng nhập quản trị'],
  [adminPath('/invitation'), 'Hoàn tất tài khoản quản trị'],
  [adminPath('/reset-password'), 'Đặt lại mật khẩu quản trị'],
  ...ADMIN_ROUTES
    .filter((route) => !route.segment.includes(':'))
    .map((route) => [adminPath(route.segment), route.title]),
])

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '')
}

function cvTitle(pathname) {
  if (pathname.endsWith('/edit')) return 'Chỉnh sửa CV'
  if (pathname.endsWith('/view')) return 'Xem CV'
  return NOT_FOUND_TITLE
}

function mainTitle(pathname) {
  const exact = EXACT_MAIN_TITLES.get(pathname)
  if (exact) return exact

  const accountItem = findActiveAccountItem(pathname)
  if (accountItem) return accountItem.label
  if (isCompanyDetailPath(pathname)) return 'Hồ sơ công ty'
  if (pathname.startsWith('/cvs/')) return cvTitle(pathname)
  if (pathname.startsWith('/save-cv-success/')) return 'Lưu CV thành công'
  if (pathname.startsWith('/viec-lam/tai/')) return 'Tuyển dụng việc làm theo địa điểm'
  if (pathname.startsWith('/viec-lam/') || pathname.startsWith('/jobs/') || pathname.startsWith('/brand/')) {
    return 'Chi tiết việc làm'
  }
  if (pathname.startsWith('/tuyen-dung/')) return 'Trang tuyển dụng'
  if (pathname.startsWith('/blog/danh-muc/')) return 'Danh mục cẩm nang nghề nghiệp'
  if (pathname.startsWith('/blog/')) return 'Bài viết cẩm nang nghề nghiệp'
  if (pathname.startsWith('/tro-giup/')) {
    return pathname.split('/').filter(Boolean).length >= 3
      ? 'Nội dung trợ giúp'
      : 'Chuyên mục trợ giúp'
  }
  if (pathname.startsWith('/mau-cv') || pathname.startsWith('/cv-templates')) {
    if (pathname.includes('/chi-tiet/') || pathname.match(/^\/cv-templates\/[^/]+$/)) return 'Chi tiết mẫu CV'
    return 'Mẫu CV xin việc chuyên nghiệp'
  }
  if (pathname.startsWith('/cv/share/')) return 'CV được chia sẻ'
  return NOT_FOUND_TITLE
}

export function resolveEmployerRouteTitle(pathname) {
  if (EMPLOYER_MARKETING_PATHS.has(pathname)) return ''
  const exact = EXACT_EMPLOYER_TITLES.get(pathname)
  if (exact) return exact
  const dynamic = DYNAMIC_EMPLOYER_TITLES.find(([pattern]) => pattern.test(pathname))
  return dynamic ? dynamic[1] : NOT_FOUND_TITLE
}

function adminTitle(pathname) {
  const exact = EXACT_ADMIN_TITLES.get(pathname)
  if (exact) return exact

  const pathSegments = pathname.split('/').filter(Boolean)
  const dynamicRoute = ADMIN_ROUTES.find((route) => {
    if (!route.segment.includes(':')) return false
    const routeSegments = adminPath(route.segment).split('/').filter(Boolean)
    return routeSegments.length === pathSegments.length
      && routeSegments.every((segment, index) => (
        segment.startsWith(':') || segment === pathSegments[index]
      ))
  })
  return dynamicRoute ? dynamicRoute.title : NOT_FOUND_TITLE
}

export function resolveRouteTitle(pathname) {
  const normalized = normalizePath(pathname)
  const portal = getCurrentPortal()
  if (portal === 'employer') return resolveEmployerRouteTitle(normalized)
  if (portal === 'admin') return adminTitle(normalized)
  return mainTitle(normalized)
}
