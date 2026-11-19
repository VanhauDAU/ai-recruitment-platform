import { getIntlLocale, getLocale, m } from '@/shared/config/i18n'
export const WORK_TYPE_LABELS = {
  onsite: m.job_work_type_onsite(),
  remote: m.job_work_type_remote(),
  hybrid: m.job_work_type_hybrid(),
}

export const EMPLOYMENT_TYPE_LABELS = {
  full_time: m.job_employment_full_time(),
  part_time: m.job_employment_part_time(),
  contract: m.job_employment_contract(),
  seasonal: m.job_employment_seasonal(),
  work_from_home: m.job_employment_work_from_home(),
  internship: m.job_employment_internship(),
  freelance: 'Freelance',
  other: m.job_employment_other(),
}

// Kinh nghiệm theo năm (bộ lọc "Kinh nghiệm" — chọn nhiều, ?experience_years=).
export const EXPERIENCE_YEARS_LABELS = {
  none: m.job_not_required(),
  under_1: m.job_experience_under_1(),
  1: m.job_experience_years({ count: 1 }),
  2: m.job_experience_years({ count: 2 }),
  3: m.job_experience_years({ count: 3 }),
  4: m.job_experience_years({ count: 4 }),
  5: m.job_experience_years({ count: 5 }),
  over_5: m.job_experience_over_5(),
}

// Cấp bậc tuyển dụng (?position_level=).
export const POSITION_LEVEL_LABELS = {
  employee: m.job_level_employee(),
  team_lead: m.job_level_team_lead(),
  manager: m.job_level_manager(),
  supervisor: m.job_level_supervisor(),
  branch_manager: m.job_level_branch_manager(),
  vice_director: m.job_level_vice_director(),
  director: m.job_level_director(),
  intern: m.job_level_intern(),
}

export const EDUCATION_LEVEL_LABELS = {
  none: m.job_not_required(),
  middle_school: m.job_education_middle_school(),
  high_school: m.job_education_high_school(),
  intermediate: m.job_education_intermediate(),
  college: m.job_education_college(),
  university: m.job_education_university(),
  postgraduate: m.job_education_postgraduate(),
}

// Salary buckets for the homepage filter (VND). gte/lte map to the ?salary_gte / ?salary_lte API params.
export const SALARY_RANGES = [
  { key: 'u10', label: m.job_salary_range_under({ amount: 10 }), lte: 10_000_000 },
  { key: '10-15', label: m.job_salary_range_between({ min: 10, max: 15 }), gte: 10_000_000, lte: 15_000_000 },
  { key: '15-20', label: m.job_salary_range_between({ min: 15, max: 20 }), gte: 15_000_000, lte: 20_000_000 },
  { key: '20-25', label: m.job_salary_range_between({ min: 20, max: 25 }), gte: 20_000_000, lte: 25_000_000 },
  { key: '25-30', label: m.job_salary_range_between({ min: 25, max: 30 }), gte: 25_000_000, lte: 30_000_000 },
  { key: '30-50', label: m.job_salary_range_between({ min: 30, max: 50 }), gte: 30_000_000, lte: 50_000_000 },
  { key: 'o50', label: m.job_salary_range_over({ amount: 50 }), gte: 50_000_000 },
]

export const SALARY_CURRENCY_OPTIONS = [
  { value: 'VND', label: 'VND (₫)' },
  { value: 'USD', label: 'USD ($)' },
]

// Số theo định dạng Việt Nam (dấu chấm ngăn cách hàng nghìn): 3516 -> "3.516".
export const formatNumber = (n) => (n ?? 0).toLocaleString(getIntlLocale())

const COMPANY_PREFIX_RE = /^(Công ty|CP|TNHH|Cổ phần|Tập đoàn|Ngân hàng|Trung tâm)\s*/gi
// Bỏ tiền tố pháp lý khỏi tên công ty ("Công ty TNHH ABC" -> "ABC").
export const stripCompanyPrefix = (name = '') => name.replace(COMPANY_PREFIX_RE, '').trim()
// Chữ cái đầu dùng cho ô logo giả lập.
export const companyInitial = (name = '') => stripCompanyPrefix(name).charAt(0) || '?'

export function formatSalary(job) {
  if (job.salary_type === 'negotiable' || (!job.salary_min && !job.salary_max)) return m.job_salary_negotiable()
  const currency = job.currency || 'VND'
  const fmt = (n) => {
    if (currency !== 'VND') return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n))
    const millions = Number(n) / 1_000_000
    return Number.isInteger(millions) ? `${millions}` : `${getLocale() === 'vi' ? millions.toFixed(1).replace('.', ',') : millions.toFixed(1)}`
  }
  const suffix = currency === 'VND' ? m.job_salary_unit_million() : currency
  if (job.salary_type === 'fixed') return `${fmt(job.salary_min || job.salary_max)} ${suffix}`
  if (job.salary_type === 'from' || (job.salary_min && !job.salary_max)) return m.job_salary_from({ amount: `${fmt(job.salary_min)} ${suffix}` })
  if (job.salary_type === 'up_to' || (!job.salary_min && job.salary_max)) return m.job_salary_up_to({ amount: `${fmt(job.salary_max)} ${suffix}` })
  return `${fmt(job.salary_min)} - ${fmt(job.salary_max)} ${suffix}`
}

export const getSalaryDisplayNote = (job) => (
  job.income_display_type === 'income_at_kpi' ? m.job_salary_at_kpi() : null
)

export function formatEducation(level) {
  if (!level) return null
  if (level === 'none') return m.job_education_not_required()
  return m.job_education_min({ level: EDUCATION_LEVEL_LABELS[level] })
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
  if (diffDays < 0) return m.job_deadline_expired()
  if (diffDays === 0) return m.job_deadline_today()
  return m.job_deadline_days_left({ count: diffDays })
}

// Compact location label for cards: "Hà Nội" or "Hà Nội +2".
export function formatLocations(job) {
  const locs = job.locations_detail || []
  if (locs.length === 0) return null
  if (locs.length === 1) return locs[0].name
  return `${locs[0].name} +${locs.length - 1}`
}
