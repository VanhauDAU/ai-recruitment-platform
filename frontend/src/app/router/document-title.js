import { findActiveAccountItem } from '@/entities/account/account'
import {
  COMPANY_DIRECTORY_PATH,
  COMPANY_SEARCH_PATH,
  isCompanyDetailPath,
} from '@/entities/company/company'
import { CANDIDATE_CONNECT_PATH } from '@/entities/messaging/conversation'
import { NOT_FOUND_TITLE } from '@/shared/config/document-title'
import { m } from '@/shared/config/i18n'
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
  ['/viec-lam-gan-ban', m.candidate_nearby_title()],
  ['/so-sanh-viec-lam', 'So sánh việc làm'],
  ['/viec-lam-da-luu', m.candidate_title_saved_jobs()],
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
  [CANDIDATE_CONNECT_PATH, m.connect_title()],
])

// Trang marketing tự đặt tiêu đề theo ngôn ngữ đang chọn (EmployerMarketingLayout,
// khóa `meta.*` trong locale employer); route chỉ cần nhận diện để không báo 404.
const EMPLOYER_MARKETING_PATHS = new Set(
  ['', '/gioi-thieu', '/dich-vu', '/lien-he', '/dieu-khoan-dich-vu', '/chinh-sach-quyen-rieng']
    .map((segment) => employerMarketingPath(segment)),
)

const EXACT_EMPLOYER_TITLES = new Map([
  [employerAppPath('/login'), m.employer_workspace_title_login()],
  [employerAppPath('/register'), m.employer_workspace_title_register()],
  [employerAppPath('/forgot-password'), m.employer_workspace_title_forgot_password()],
  [employerAppPath('/reset-password'), m.employer_workspace_title_reset_password()],
  [employerAppPath('/account/verify'), m.employer_workspace_title_verify_email()],
  [employerAppPath('/account/complete-profile'), m.employer_workspace_title_complete_profile()],
  [employerAppPath('/onboarding'), m.employer_workspace_title_complete_profile()],
  [employerAppPath('/consulting-need'), m.employer_workspace_title_recruitment_demand()],
  [employerAppPath('/employer-verify'), m.employer_workspace_title_account_verification()],
  [employerAppPath('/account/phone-verify'), m.employer_workspace_title_phone_verify()],
  [employerAppPath('/account/settings/account-info'), m.employer_workspace_title_account_info()],
  [employerAppPath('/account/settings/password-login'), m.employer_workspace_title_change_password()],
  [employerAppPath('/account/settings/company'), m.employer_workspace_title_company_info()],
  [employerAppPath('/account/settings/gpkd'), m.employer_workspace_title_business_registration()],
  [employerAppPath('/account/settings/personal-data-protection'), m.employer_workspace_title_personal_data_protection()],
  [employerAppPath('/account/settings/recruitment-demand'), m.employer_workspace_title_recruitment_demand()],
  [employerAppPath('/account/settings/general-setting'), m.employer_workspace_title_general_settings()],
  [employerAppPath('/account/settings/integrations'), m.employer_workspace_title_integrations()],
  [employerAppPath('/oauth/callback'), m.employer_workspace_title_oauth_callback()],
  [employerAppPath('/dashboard'), m.employer_workspace_title_dashboard()],
  [employerAppPath('/notifications'), m.employer_workspace_title_notifications()],
  [employerAppPath('/activities'), m.employer_workspace_title_activities()],
  [employerAppPath('/company-page'), m.employer_workspace_title_company_page()],
  [employerAppPath('/campaigns'), m.employer_workspace_title_campaigns()],
  [employerAppPath('/campaigns/new'), m.employer_workspace_title_campaign_new()],
  [employerAppPath('/jobs'), m.employer_workspace_title_jobs()],
  [employerAppPath('/jobs/new'), m.employer_workspace_title_job_new()],
  [employerAppPath('/applications'), m.employer_workspace_title_applications()],
  [employerAppPath('/candidate-blocks'), m.employer_workspace_title_candidate_blocks()],
  [employerAppPath('/talent-pool'), m.employer_workspace_title_talent_pool()],
  [employerAppPath('/candidate-search'), m.employer_workspace_title_candidate_search()],
  [employerAppPath('/connect'), m.connect_title()],
])

// Thứ tự quan trọng: mẫu cụ thể (…/edit, …/setup) đứng trước mẫu chi tiết.
const DYNAMIC_EMPLOYER_TITLES = [
  [new RegExp(`^${employerAppPath('/jobs/')}[^/]+/edit$`), m.employer_workspace_title_job_edit()],
  [new RegExp(`^${employerAppPath('/jobs/')}[^/]+$`), m.employer_workspace_title_job_detail()],
  [new RegExp(`^${employerAppPath('/campaigns/')}[^/]+/setup$`), m.employer_workspace_title_campaign_setup()],
  [new RegExp(`^${employerAppPath('/campaigns/')}[^/]+$`), m.employer_workspace_title_campaign_detail()],
  // Hội thoại: tiêu đề chung, không đưa tên ứng viên/công ty vào tab.
  [new RegExp(`^${employerAppPath('/connect/')}[^/]+$`), m.connect_title()],
  // Link mời đánh giá: không đưa tên ứng viên vào tiêu đề (lịch sử trình duyệt, chia sẻ tab).
  [new RegExp(`^${employerMarketingPath('/danh-gia-ho-so/')}[^/]+$`), m.employer_workspace_title_application_review()],
]

const EXACT_ADMIN_TITLES = new Map([
  [adminPath('/login'), 'Đăng nhập quản trị'],
  [adminPath('/invitation'), 'Hoàn tất tài khoản quản trị'],
  [adminPath('/reset-password'), m.account_reset_title_admin()],
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
  if (pathname.startsWith(`${CANDIDATE_CONNECT_PATH}/`)) return m.connect_title()
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
