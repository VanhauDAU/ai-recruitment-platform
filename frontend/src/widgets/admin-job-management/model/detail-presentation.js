const ENUM_LABELS = {
  active: 'Đang hoạt động',
  inactive: 'Tạm khóa',
  banned: 'Đã cấm',
  draft: 'Bản nháp',
  pending: 'Chờ duyệt',
  closed: 'Đã đóng',
  rejected: 'Đã từ chối',
  onsite: 'Tại văn phòng',
  remote: 'Từ xa',
  hybrid: 'Linh hoạt',
  full_time: 'Toàn thời gian',
  part_time: 'Bán thời gian',
  contract: 'Hợp đồng',
  seasonal: 'Thời vụ',
  internship: 'Thực tập',
  freelance: 'Freelance',
  none: 'Không yêu cầu',
  under_1: 'Dưới 1 năm',
  over_5: 'Trên 5 năm',
  1: '1 năm',
  2: '2 năm',
  3: '3 năm',
  4: '4 năm',
  5: '5 năm',
  employee: 'Nhân viên',
  team_lead: 'Trưởng nhóm',
  manager: 'Trưởng/Phó phòng',
  supervisor: 'Quản lý / Giám sát',
  intern: 'Thực tập sinh',
  any: 'Không yêu cầu',
  male: 'Nam',
  female: 'Nữ',
  middle_school: 'Trung học cơ sở',
  high_school: 'Trung học phổ thông',
  intermediate: 'Trung cấp',
  college: 'Cao đẳng',
  university: 'Đại học',
  postgraduate: 'Sau đại học',
  upheld: 'Đã xác nhận vi phạm',
  dismissed: 'Đã bác bỏ',
}

export function adminJobEnumLabel(value) {
  return ENUM_LABELS[value] || value || '—'
}

export function formatAdminJobSalary(job) {
  if (!job.salary_type || job.salary_type === 'negotiable') return 'Thỏa thuận'
  const formatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
  const min = job.salary_min ? formatter.format(Number(job.salary_min)) : ''
  const max = job.salary_max ? formatter.format(Number(job.salary_max)) : ''
  if (min && max) return `${min} – ${max} ${job.currency}`
  if (min) return `Từ ${min} ${job.currency}`
  if (max) return `Đến ${max} ${job.currency}`
  return 'Thỏa thuận'
}

