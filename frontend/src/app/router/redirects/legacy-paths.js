import { generatePath, matchPath } from 'react-router'
import { adminPath, employerAppPath, IS_ADMIN_HOST, IS_EMPLOYER_HOST, IS_MAIN_HOST } from '@/shared/config/portals'

// Path cũ (tiếng Anh) → path hiện hành. Email, thông báo đã lưu và link đã chia sẻ
// vẫn trỏ về path cũ nên các cặp này phải giữ lâu dài, không phải shim tạm.
// Tham số `:name` ở hai vế phải trùng tên; query và hash được giữ nguyên. Path cũ
// không khớp route hiện hành nào nên rơi vào route `*` (LegacyPathFallback).
// Trong một cổng, path tĩnh (`/jobs/new`) phải đứng trước path động (`/jobs/:publicId`).
export const LEGACY_MAIN_PATHS = Object.freeze([
  ['/login', '/dang-nhap'],
  ['/sign-up', '/dang-ky'],
  ['/register', '/dang-ky'],
  ['/forgot-password', '/quen-mat-khau'],
  ['/reset-password', '/dat-lai-mat-khau'],
  ['/onboard-user', '/hoan-thien-ho-so'],
  ['/onboard-user-setting', '/hoan-thien-ho-so'],
  ['/cvs/:publicId/edit', '/cv/:publicId/chinh-sua'],
  ['/cvs/:publicId/view', '/cv/:publicId/xem'],
  ['/save-cv-success/:publicId', '/cv/:publicId/da-luu'],
  ['/cv/share/:token', '/cv/chia-se/:token'],
])

export const LEGACY_EMPLOYER_PATHS = Object.freeze([
  ['/login', '/dang-nhap'],
  ['/register', '/dang-ky'],
  ['/forgot-password', '/quen-mat-khau'],
  ['/reset-password', '/dat-lai-mat-khau'],
  ['/account/verify', '/xac-thuc-email'],
  ['/account/complete-profile', '/hoan-thien-ho-so'],
  ['/onboarding', '/hoan-thien-ho-so'],
  ['/consulting-need', '/khai-bao-nhu-cau'],
  ['/employer-verify', '/xac-thuc-tai-khoan'],
  ['/account/phone-verify', '/xac-thuc-so-dien-thoai'],
  ['/account/settings', '/cai-dat/thong-tin-tai-khoan'],
  ['/account/settings/account-info', '/cai-dat/thong-tin-tai-khoan'],
  ['/account/settings/password-login', '/cai-dat/mat-khau'],
  ['/account/settings/company', '/cai-dat/cong-ty'],
  ['/account/settings/gpkd', '/cai-dat/giay-phep-kinh-doanh'],
  ['/account/settings/personal-data-protection', '/cai-dat/bao-ve-du-lieu-ca-nhan'],
  ['/account/settings/recruitment-demand', '/cai-dat/nhu-cau-tuyen-dung'],
  ['/account/settings/general-setting', '/cai-dat/chung'],
  ['/account/settings/integrations', '/cai-dat/tich-hop'],
  ['/dashboard', '/tong-quan'],
  ['/notifications', '/thong-bao'],
  ['/activities', '/lich-su-hoat-dong'],
  ['/company-page', '/trang-cong-ty'],
  ['/campaigns', '/chien-dich'],
  ['/campaigns/new', '/chien-dich/tao-moi'],
  ['/campaigns/:publicId/setup', '/chien-dich/:publicId/thiet-lap'],
  ['/campaigns/:publicId', '/chien-dich/:publicId'],
  ['/jobs', '/tin-tuyen-dung'],
  ['/jobs/new', '/tin-tuyen-dung/tao-moi'],
  ['/jobs/:publicId/edit', '/tin-tuyen-dung/:publicId/chinh-sua'],
  ['/jobs/:publicId', '/tin-tuyen-dung/:publicId'],
  ['/applications', '/ho-so-ung-tuyen'],
  ['/candidate-search', '/tim-ung-vien'],
  ['/talent-pool', '/kho-ung-vien'],
  ['/candidate-blocks', '/ung-vien-bi-chan'],
  ['/connect', '/procv-connect'],
  ['/connect/:conversationId', '/procv-connect/:conversationId'],
].map(([from, to]) => [employerAppPath(from), employerAppPath(to)]))

export const LEGACY_ADMIN_PATHS = Object.freeze([
  ['/login', '/dang-nhap'],
  ['/invitation', '/loi-moi'],
  ['/reset-password', '/dat-lai-mat-khau'],
  ['/dashboard', '/tong-quan'],
  ['/companies', '/cong-ty'],
  ['/companies/:publicId', '/cong-ty/:publicId'],
  ['/recruiters', '/nha-tuyen-dung'],
  ['/recruiters/:publicId', '/nha-tuyen-dung/:publicId'],
  ['/accounts', '/tai-khoan'],
  ['/accounts/:publicId', '/tai-khoan/:publicId'],
  ['/account', '/tai-khoan-cua-toi'],
  ['/job-moderation', '/duyet-tin'],
  ['/job-moderation/:publicId', '/duyet-tin/:publicId'],
  ['/company-reports', '/bao-cao-cong-ty'],
  ['/privacy-requests', '/yeu-cau-du-lieu-ca-nhan'],
  ['/cv/overview', '/cv/tong-quan'],
  ['/cv/templates', '/cv/mau-cv'],
  ['/cv/templates/:publicId', '/cv/mau-cv/:publicId'],
  ['/cv/positions', '/cv/vi-tri'],
  ['/cv/positions/:publicId', '/cv/vi-tri/:publicId'],
  ['/cv/library', '/cv/thu-vien'],
  ['/cv/user-cvs', '/cv/cv-nguoi-dung'],
  ['/blog/new', '/blog/tao-moi'],
  ['/blog/:publicId/edit', '/blog/:publicId/chinh-sua'],
  ['/knowledgebase', '/tro-giup'],
  ['/knowledgebase/new', '/tro-giup/tao-moi'],
  ['/knowledgebase/:publicId', '/tro-giup/:publicId'],
  ['/announcements', '/thong-bao'],
  ['/catalog', '/danh-muc-du-lieu'],
  ['/banners', '/banner'],
  ['/settings', '/cau-hinh'],
  ['/access-denied', '/khong-co-quyen'],
].map(([from, to]) => [adminPath(from), adminPath(to)]))

// Cùng điều kiện cổng với AppRouter: mỗi host chỉ nhận path cũ của cổng nó phục vụ.
const PORTAL_PAIRS = [
  ...(IS_MAIN_HOST ? LEGACY_MAIN_PATHS : []),
  ...(IS_ADMIN_HOST ? [] : LEGACY_EMPLOYER_PATHS),
  ...(IS_EMPLOYER_HOST ? [] : LEGACY_ADMIN_PATHS),
]

/** Path hiện hành cho một path cũ, hoặc `null` nếu không phải path cũ. */
export function resolveLegacyPath(pathname, pairs = PORTAL_PAIRS) {
  for (const [from, to] of pairs) {
    const match = matchPath(from, pathname)
    if (match) return generatePath(to, match.params)
  }
  return null
}
