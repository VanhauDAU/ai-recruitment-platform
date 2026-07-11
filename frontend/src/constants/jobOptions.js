export const WORK_TYPE_LABELS = {
  onsite: 'Tại văn phòng',
  remote: 'Từ xa',
  hybrid: 'Kết hợp',
}

export const EMPLOYMENT_TYPE_LABELS = {
  full_time: 'Toàn thời gian',
  part_time: 'Bán thời gian',
  contract: 'Hợp đồng',
  seasonal: 'Thời vụ',
  internship: 'Thực tập',
  freelance: 'Freelance',
}

// Kinh nghiệm theo năm (bộ lọc "Kinh nghiệm" — chọn nhiều, ?experience_years=).
export const EXPERIENCE_YEARS_LABELS = {
  none: 'Không yêu cầu',
  under_1: 'Dưới 1 năm',
  1: '1 năm',
  2: '2 năm',
  3: '3 năm',
  4: '4 năm',
  5: '5 năm',
  over_5: 'Trên 5 năm',
}

// Cấp bậc tuyển dụng (?position_level=).
export const POSITION_LEVEL_LABELS = {
  employee: 'Nhân viên',
  team_lead: 'Trưởng nhóm',
  manager: 'Trưởng/Phó phòng',
  supervisor: 'Quản lý / Giám sát',
  branch_manager: 'Trưởng chi nhánh',
  vice_director: 'Phó giám đốc',
  director: 'Giám đốc',
  intern: 'Thực tập sinh',
}

export const EDUCATION_LEVEL_LABELS = {
  none: 'Không yêu cầu',
  middle_school: 'Trung học cơ sở (Cấp 2)',
  high_school: 'Trung học phổ thông (Cấp 3)',
  intermediate: 'Trung cấp',
  college: 'Cao đẳng',
  university: 'Đại học',
  postgraduate: 'Cao học',
}

export const GENDER_REQUIREMENT_LABELS = {
  any: 'Không yêu cầu giới tính',
  male: 'Nam',
  female: 'Nữ',
}

// Salary buckets for the homepage filter (VND). gte/lte map to the ?salary_gte / ?salary_lte API params.
export const SALARY_RANGES = [
  { key: 'u10', label: 'Dưới 10 triệu', lte: 10_000_000 },
  { key: '10-15', label: '10 - 15 triệu', gte: 10_000_000, lte: 15_000_000 },
  { key: '15-20', label: '15 - 20 triệu', gte: 15_000_000, lte: 20_000_000 },
  { key: '20-25', label: '20 - 25 triệu', gte: 20_000_000, lte: 25_000_000 },
  { key: '25-30', label: '25 - 30 triệu', gte: 25_000_000, lte: 30_000_000 },
  { key: '30-50', label: '30 - 50 triệu', gte: 30_000_000, lte: 50_000_000 },
  { key: 'o50', label: 'Trên 50 triệu', gte: 50_000_000 },
]

// Số theo định dạng Việt Nam (dấu chấm ngăn cách hàng nghìn): 3516 -> "3.516".
export const formatNumber = (n) => (n ?? 0).toLocaleString('vi-VN')

const COMPANY_PREFIX_RE = /^(Công ty|CP|TNHH|Cổ phần|Tập đoàn|Ngân hàng|Trung tâm)\s*/gi
// Bỏ tiền tố pháp lý khỏi tên công ty ("Công ty TNHH ABC" -> "ABC").
export const stripCompanyPrefix = (name = '') => name.replace(COMPANY_PREFIX_RE, '').trim()
// Chữ cái đầu dùng cho ô logo giả lập.
export const companyInitial = (name = '') => stripCompanyPrefix(name).charAt(0) || '?'

export function formatSalary(job) {
  if (job.salary_type === 'negotiable' || (!job.salary_min && !job.salary_max)) return 'Thỏa thuận'
  const fmt = (n) => {
    const millions = Number(n) / 1_000_000
    return Number.isInteger(millions) ? `${millions}` : `${millions.toFixed(1).replace('.', ',')}`
  }
  if (job.salary_type === 'fixed') return `${fmt(job.salary_min || job.salary_max)} triệu`
  if (job.salary_type === 'from' || (job.salary_min && !job.salary_max)) return `Từ ${fmt(job.salary_min)} triệu`
  if (job.salary_type === 'up_to' || (!job.salary_min && job.salary_max)) return `Đến ${fmt(job.salary_max)} triệu`
  return `${fmt(job.salary_min)} - ${fmt(job.salary_max)} triệu`
}

export function formatEducation(level) {
  if (!level) return null
  if (level === 'none') return 'Không yêu cầu bằng cấp'
  return `Từ ${EDUCATION_LEVEL_LABELS[level]} trở lên`
}

// Đếm ngược hạn nộp: "Đã hết hạn" / "Hết hạn hôm nay" / "Còn 5 ngày".
export function formatDeadline(deadline) {
  if (!deadline) return null
  const deadlineDate = new Date(deadline)
  if (Number.isNaN(deadlineDate.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  deadlineDate.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((deadlineDate - today) / 86_400_000)
  if (diffDays < 0) return 'Đã hết hạn'
  if (diffDays === 0) return 'Hết hạn hôm nay'
  return `Còn ${diffDays} ngày`
}

// Compact location label for cards: "Hà Nội" or "Hà Nội +2".
export function formatLocations(job) {
  const locs = job.locations_detail || []
  if (locs.length === 0) return null
  if (locs.length === 1) return locs[0].name
  return `${locs[0].name} +${locs.length - 1}`
}
