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

export function formatSalary(job) {
  if (!job.is_salary_visible || (!job.salary_min && !job.salary_max)) return 'Thoả thuận'
  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n)
  if (job.salary_min && job.salary_max) return `${fmt(job.salary_min)} - ${fmt(job.salary_max)} ${job.currency}`
  if (job.salary_min) return `Từ ${fmt(job.salary_min)} ${job.currency}`
  return `Đến ${fmt(job.salary_max)} ${job.currency}`
}
