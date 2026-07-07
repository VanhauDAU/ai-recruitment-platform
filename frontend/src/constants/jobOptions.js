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

export function formatSalary(job) {
  if (!job.is_salary_visible || (!job.salary_min && !job.salary_max)) return 'Thoả thuận'
  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n)
  if (job.salary_min && job.salary_max) return `${fmt(job.salary_min)} - ${fmt(job.salary_max)} ${job.currency}`
  if (job.salary_min) return `Từ ${fmt(job.salary_min)} ${job.currency}`
  return `Đến ${fmt(job.salary_max)} ${job.currency}`
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
