export const WORK_TYPE_LABELS = {
  onsite: 'Tại văn phòng',
  remote: 'Từ xa',
  hybrid: 'Kết hợp',
}

export const EMPLOYMENT_TYPE_LABELS = {
  full_time: 'Toàn thời gian',
  part_time: 'Bán thời gian',
  internship: 'Thực tập',
  freelance: 'Freelance',
}

export const EXPERIENCE_LEVEL_LABELS = {
  intern: 'Thực tập sinh',
  fresher: 'Fresher',
  junior: 'Junior',
  middle: 'Middle',
  senior: 'Senior',
}

export const EDUCATION_LEVEL_LABELS = {
  none: 'Không yêu cầu',
  high_school: 'THPT',
  intermediate: 'Trung cấp',
  college: 'Cao đẳng',
  university: 'Đại học',
  postgraduate: 'Sau đại học',
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
  if (!job.is_salary_visible || (!job.salary_min && !job.salary_max)) return 'Thỏa thuận'
  const fmt = (n) => {
    const millions = Number(n) / 1_000_000
    return Number.isInteger(millions) ? `${millions}` : `${millions.toFixed(1).replace('.', ',')}`
  }
  if (job.salary_min && job.salary_max) return `${fmt(job.salary_min)} - ${fmt(job.salary_max)}tr`
  if (job.salary_min) return `Từ ${fmt(job.salary_min)}tr`
  return `Đến ${fmt(job.salary_max)}tr`
}

export function formatEducation(level) {
  if (!level) return null
  if (level === 'none') return 'Không yêu cầu bằng cấp'
  return `Từ ${EDUCATION_LEVEL_LABELS[level]} trở lên`
}

// Compact location label for cards: "Hà Nội" or "Hà Nội +2".
export function formatLocations(job) {
  const locs = job.locations_detail || []
  if (locs.length === 0) return null
  if (locs.length === 1) return locs[0].name
  return `${locs[0].name} +${locs.length - 1}`
}
