export const BOOLEAN_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'true', label: 'Có' },
  { value: 'false', label: 'Không' },
]

export const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'pending', label: 'Chờ kích hoạt' },
  { value: 'inactive', label: 'Tạm khóa' },
  { value: 'banned', label: 'Đã cấm' },
]

export const ORDERING_OPTIONS = [
  { value: '-date_joined', label: 'Mới tạo gần đây' },
  { value: 'date_joined', label: 'Tạo lâu nhất' },
  { value: '-last_login', label: 'Đăng nhập gần nhất' },
  { value: 'full_name', label: 'Tên A–Z' },
  { value: 'email', label: 'Email A–Z' },
]

// Các trường chỉ xuất hiện trong panel nâng cao: dùng cho badge đếm và nút đặt lại.
export const ADVANCED_KEYS = [
  'email_verified',
  'mfa',
  'has_active_session',
  'department',
  'admin_role',
  'company',
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
