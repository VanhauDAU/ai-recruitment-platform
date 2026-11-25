import { FileTextOutlined, IdcardOutlined, MailOutlined, SafetyOutlined } from '@ant-design/icons'
import { m } from '@/shared/config/i18n'

/**
 * Nguồn dữ liệu DUY NHẤT cho menu tài khoản ứng viên — dùng chung bởi:
 * - Dropdown avatar trên header (`CandidateUserMenu`)
 * - Sidebar trái của cụm trang tài khoản 3 cột (`AccountSidebar`)
 * Route con của layout 3 cột cũng sinh từ đây (xem main.routes.jsx) nên thêm/sửa
 * một trang chỉ cần đổi đúng file này.
 */

export const ACCOUNT_ROOT = '/tai-khoan'
const accountPath = (slug) => `${ACCOUNT_ROOT}/${slug}`

export const CANDIDATE_MENU = [
  {
    key: 'search', title: 'Quản lý tìm việc', icon: <IdcardOutlined />, dot: true,
    items: [
      { key: 'saved-jobs', label: 'Việc làm đã lưu', path: '/viec-lam-da-luu' },
      { key: 'applied-jobs', label: 'Việc làm đã ứng tuyển', path: accountPath('viec-lam-da-ung-tuyen') },
      { key: 'matching-jobs', label: 'Việc làm phù hợp với bạn', path: accountPath('viec-lam-phu-hop') },
      { key: 'followed-companies', label: 'Công ty đang theo dõi', path: accountPath('cong-ty-dang-theo-doi') },
      { key: 'talent-pools', label: 'Nhà tuyển dụng lưu hồ sơ', path: accountPath('kho-ung-vien-tiem-nang') },
      { key: 'suggestion-settings', label: 'Cài đặt gợi ý việc làm', path: accountPath('cai-dat-goi-y-viec-lam') },
    ],
  },
  {
    key: 'cv', title: 'Quản lý CV', icon: <FileTextOutlined />, dot: true,
    items: [
      { key: 'my-cv', label: 'CV của tôi', path: accountPath('cv-cua-toi') },
      { key: 'employer-connections', label: m.candidate_connections_menu(), path: accountPath('nha-tuyen-dung-muon-ket-noi') },
    ],
  },
  {
    key: 'email', title: 'Cài đặt email & thông báo', icon: <MailOutlined />,
    items: [
      { key: 'job-notifications', label: 'Cài đặt thông báo việc làm', path: accountPath('cai-dat-thong-bao-viec-lam') },
      { key: 'email-settings', label: 'Cài đặt nhận thông báo', path: accountPath('cai-dat-nhan-email') },
    ],
  },
  {
    key: 'account', title: 'Cá nhân & Bảo mật', icon: <SafetyOutlined />, dot: true,
    items: [
      { key: 'personal-info', label: 'Cài đặt thông tin cá nhân', path: accountPath('thong-tin-ca-nhan') },
      { key: 'security', label: 'Cài đặt bảo mật', path: accountPath('cai-dat-bao-mat') },
      { key: 'change-password', label: 'Đổi mật khẩu', path: accountPath('doi-mat-khau') },
    ],
  },
]

// Mọi trang trong menu đều nằm trong layout 3 cột — nguồn sinh route con.
export const ACCOUNT_LAYOUT_ITEMS = CANDIDATE_MENU.flatMap((group) => group.items)

// Trang mặc định khi vào thẳng /tai-khoan.
export const ACCOUNT_DEFAULT_PATH = accountPath('thong-tin-ca-nhan')

export function findActiveAccountItem(pathname) {
  return ACCOUNT_LAYOUT_ITEMS.find((item) => pathname === item.path) || null
}

export function findGroupKeyByPath(pathname) {
  const group = CANDIDATE_MENU.find(
    (g) => g.items.some((item) => pathname === item.path),
  )
  return group?.key || null
}
