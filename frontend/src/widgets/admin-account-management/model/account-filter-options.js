export const BOOLEAN_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'true', label: 'Có' },
  { value: 'false', label: 'Không' },
]

export const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'pending', label: 'Chờ kích hoạt' },
  { value: 'inactive,banned', label: 'Bị hạn chế' },
  { value: 'inactive', label: 'Tạm khóa' },
  { value: 'banned', label: 'Đã cấm' },
]

export const ORDERING_OPTIONS = [
  { value: '-date_joined', label: 'Mới tạo gần đây' },
  { value: 'date_joined', label: 'Tạo lâu nhất' },
  { value: '-last_login', label: 'Đăng nhập gần nhất' },
  { value: '-last_session_seen_at', label: 'Hoạt động gần nhất' },
  { value: 'full_name', label: 'Tên A–Z' },
  { value: 'email', label: 'Email A–Z' },
  { value: 'role', label: 'Loại tài khoản' },
  { value: 'status', label: 'Trạng thái tài khoản' },
  { value: 'email_verified', label: 'Xác minh email' },
  { value: 'two_factor_enabled', label: 'Trạng thái MFA' },
  { value: 'recruiter_profile__company__company_name', label: 'Công ty A–Z' },
  { value: 'recruiter_profile__company_role', label: 'Vai trò trong công ty' },
  { value: 'recruiter_profile__onboarding_completed_at', label: 'Onboarding' },
  { value: 'recruiter_profile__verification_case__status', label: 'Xác thực NTD' },
]

// Các trường chỉ xuất hiện trong panel nâng cao: dùng cho badge đếm và nút đặt lại.
export const ADVANCED_KEYS = [
  'email_verified',
  'mfa',
  'has_active_session',
  'department',
  'admin_role',
  'company',
  'company_state',
  'verification_status',
  'created_range',
  'last_login_range',
]

const EMPTY_BY_KEY = { created_range: [], last_login_range: [] }

export const emptyValueOf = (key) => EMPTY_BY_KEY[key] ?? ''

export const clearedAdvanced = () => Object.fromEntries(
  ADVANCED_KEYS.map((key) => [key, emptyValueOf(key)]),
)

export const isFilled = (value) => (
  Array.isArray(value) ? value.length === 2 : Boolean(String(value || '').trim())
)

// Giá trị rỗng vẫn khớp option "Tất cả" nên phải loại trước khi dựng chip.
export const labelOf = (options, value) => (
  value ? options.find((item) => item.value === value)?.label : undefined
)

export const rangeText = (range) => range
  .map((item) => item.format('DD/MM/YYYY'))
  .join(' → ')
