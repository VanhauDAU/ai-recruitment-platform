import { CrownOutlined, FileTextOutlined, IdcardOutlined, MailOutlined, SafetyOutlined } from '@ant-design/icons'

/**
 * Nguồn dữ liệu DUY NHẤT cho menu tài khoản ứng viên — dùng chung bởi:
 * - Dropdown avatar trên header (`CandidateUserMenu`)
 * - Sidebar trái của cụm trang tài khoản 3 cột (`AccountSidebar`)
 * Route con của layout 3 cột cũng sinh từ đây (xem main.routes.jsx) nên thêm/sửa
 * một trang chỉ cần đổi đúng file này.
 *
 * Quy ước item:
 * - `path`  : route đích.
 * - `blank` : mở tab mới vì trang KHÔNG dùng layout 3 cột (vd: Việc làm đã lưu).
 * - `todo`  : tính năng chưa xây — UI hiển thị "sắp ra mắt" thay vì điều hướng.
 */

export const ACCOUNT_ROOT = '/tai-khoan'
const accountPath = (slug) => `${ACCOUNT_ROOT}/${slug}`

export const CANDIDATE_MENU = [
  {
    key: 'search', title: 'Quản lý tìm việc', icon: <IdcardOutlined />, dot: true,
    items: [
      { key: 'saved-jobs', label: 'Việc làm đã lưu', path: '/viec-lam-da-luu', blank: true },
      { key: 'applied-jobs', label: 'Việc làm đã ứng tuyển', path: accountPath('viec-lam-da-ung-tuyen') },
      { key: 'matching-jobs', label: 'Việc làm phù hợp với bạn', path: accountPath('viec-lam-phu-hop') },
      { key: 'suggestion-settings', label: 'Cài đặt gợi ý việc làm', path: accountPath('cai-dat-goi-y-viec-lam') },
    ],
  },
  {
    key: 'cv', title: 'Quản lý CV & Cover letter', icon: <FileTextOutlined />, dot: true,
    items: [
      { key: 'my-cv', label: 'CV của tôi', path: accountPath('cv-cua-toi') },
      { key: 'my-cover-letter', label: 'Cover Letter của tôi', path: accountPath('cover-letter-cua-toi') },
      { key: 'recruiter-connect', label: 'Nhà tuyển dụng muốn kết nối với bạn', path: '/ket-noi-nha-tuyen-dung', blank: true, todo: true },
      { key: 'profile-views', label: 'Nhà tuyển dụng xem hồ sơ', path: accountPath('nha-tuyen-dung-xem-ho-so') },
    ],
  },
  {
    key: 'email', title: 'Cài đặt email & thông báo', icon: <MailOutlined />,
    items: [
      { key: 'job-notifications', label: 'Cài đặt thông báo việc làm', path: accountPath('cai-dat-thong-bao-viec-lam') },
      { key: 'email-settings', label: 'Cài đặt nhận email', path: accountPath('cai-dat-nhan-email') },
    ],
  },
  {
    key: 'account', title: 'Cá nhân & Bảo mật', icon: <SafetyOutlined />, dot: true,
    items: [
      { key: 'personal-info', label: 'Cài đặt thông tin cá nhân', path: accountPath('thong-tin-ca-nhan') },
      { key: 'security', label: 'Cài đặt bảo mật', path: accountPath('cai-dat-bao-mat') },
      { key: 'change-password', label: 'Đổi mật khẩu', path: accountPath('doi-mat-khau') },
      { key: 'two-factor', label: 'Xác minh hai bước', path: accountPath('xac-minh-hai-buoc') },
    ],
  },
  {
    key: 'upgrade', title: 'Nâng cấp tài khoản', icon: <CrownOutlined />,
    items: [
      { key: 'vip', label: 'Nâng cấp tài khoản VIP', path: '/nang-cap-tai-khoan', blank: true, todo: true },
      { key: 'gift', label: 'Kích hoạt quà tặng', path: '/kich-hoat-qua-tang', blank: true, todo: true },
    ],
  },
]

// Các trang nằm TRONG layout 3 cột (không blank) — nguồn sinh route con.
export const ACCOUNT_LAYOUT_ITEMS = CANDIDATE_MENU.flatMap(
  (group) => group.items.filter((item) => !item.blank),
)

// Trang mặc định khi vào thẳng /tai-khoan.
export const ACCOUNT_DEFAULT_PATH = accountPath('thong-tin-ca-nhan')

export function candidateMenuItemLabel(item, user) {
  if (item.key === 'two-factor' && !user?.two_factor_enabled) {
    return `${item.label} (Chưa kích hoạt)`
  }else if (item.key === 'two-factor' && user?.two_factor_enabled) {
    return `${item.label} (Đã kích hoạt)`
  }
  return item.label
}

export function findActiveAccountItem(pathname) {
  return ACCOUNT_LAYOUT_ITEMS.find((item) => pathname === item.path) || null
}

export function findGroupKeyByPath(pathname) {
  const group = CANDIDATE_MENU.find(
    (g) => g.items.some((item) => !item.blank && pathname === item.path),
  )
  return group?.key || null
}
