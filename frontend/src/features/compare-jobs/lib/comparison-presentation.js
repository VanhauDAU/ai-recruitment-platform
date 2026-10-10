import {
  EDUCATION_LEVEL_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_YEARS_LABELS,
  formatDeadline,
  formatEducation,
  formatSalary,
  getSalaryDisplayNote,
  POSITION_LEVEL_LABELS,
  WORK_TYPE_LABELS,
} from '@/entities/job'

export const MISSING_VALUE = 'Chưa cập nhật'

const GENDER_LABELS = {
  any: 'Không yêu cầu',
  female: 'Nữ',
  male: 'Nam',
}

const WEEKDAY_LABELS = {
  1: 'Thứ 2', 2: 'Thứ 3', 3: 'Thứ 4', 4: 'Thứ 5', 5: 'Thứ 6', 6: 'Thứ 7', 7: 'Chủ nhật',
}

function cleanText(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function simple(display, compareValue = display) {
  const text = cleanText(display)
  return {
    compare: cleanText(compareValue || text).toLocaleLowerCase('vi-VN') || '__missing__',
    display: text || MISSING_VALUE,
    kind: 'text',
  }
}

function list(items, separator = ' · ') {
  const values = [...new Set((items || []).map(cleanText).filter(Boolean))]
  return {
    compare: values.map((item) => item.toLocaleLowerCase('vi-VN')).sort().join('|') || '__missing__',
    display: values.length ? values.join(separator) : MISSING_VALUE,
    items: values,
    kind: values.length > 1 ? 'list' : 'text',
  }
}

function rich(html) {
  const plain = cleanText(html)
  return {
    compare: plain.toLocaleLowerCase('vi-VN') || '__missing__',
    display: html || '',
    kind: plain ? 'rich' : 'text',
  }
}

function longText(text) {
  const normalized = cleanText(text)
  return {
    compare: normalized.toLocaleLowerCase('vi-VN') || '__missing__',
    display: normalized || MISSING_VALUE,
    kind: normalized ? 'long-text' : 'text',
  }
}

function link(url) {
  const href = cleanText(url)
  return {
    compare: href.toLocaleLowerCase('vi-VN') || '__missing__',
    display: href || MISSING_VALUE,
    href,
    kind: href ? 'link' : 'text',
  }
}

function dateLabel(value) {
  if (!value) return MISSING_VALUE
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return MISSING_VALUE
  return date.toLocaleDateString('vi-VN')
}

function salaryValue(job) {
  const note = getSalaryDisplayNote(job)
  return simple(note ? `${formatSalary(job)} · ${note}` : formatSalary(job))
}

function workplaceValue(job) {
  const addresses = (job.workplace_groups || []).flatMap((group) => (
    (group.addresses || []).map((address) => {
      const detail = [address.address_detail, address.ward_name].filter(Boolean).join(', ')
      return `${group.province_name}${detail ? `: ${detail}` : ''}`
    })
  ))
  if (addresses.length) return list(addresses, '; ')
  return list((job.locations_detail || []).map((item) => item.name), '; ')
}

function workTypesValue(job) {
  const types = job.work_types?.length ? job.work_types : [job.work_type].filter(Boolean)
  return list(types.map((type) => WORK_TYPE_LABELS[type] || type), ', ')
}

function ageValue(job) {
  if (job.age_min && job.age_max) return simple(`${job.age_min}–${job.age_max} tuổi`)
  if (job.age_min) return simple(`Từ ${job.age_min} tuổi`)
  if (job.age_max) return simple(`Đến ${job.age_max} tuổi`)
  return simple(null)
}

function deadlineValue(job) {
  if (!job.deadline) return simple(null)
  const remaining = formatDeadline(job.deadline)
  return simple(`${dateLabel(job.deadline)}${remaining ? ` · ${remaining}` : ''}`, job.deadline)
}

function scheduleLabel(item) {
  if (!item.weekday_from || !item.weekday_to) return item.note
  const days = item.weekday_from === item.weekday_to
    ? WEEKDAY_LABELS[item.weekday_from]
    : `${WEEKDAY_LABELS[item.weekday_from]}–${WEEKDAY_LABELS[item.weekday_to]}`
  const time = item.start_time && item.end_time
    ? `${item.start_time.slice(0, 5)}–${item.end_time.slice(0, 5)}${item.is_overnight ? ' hôm sau' : ''}`
    : ''
  return [days, time, item.note].filter(Boolean).join(', ')
}

function languageLabel(item) {
  const main = [item.language_name, item.proficiency_label, item.certificate].filter(Boolean).join(' — ')
  return `${main}${item.is_required === false ? ' (Ưu tiên)' : ''}${item.note ? ` · ${item.note}` : ''}`
}

function benefitsValue(job) {
  return list((job.benefit_groups || []).flatMap((group) => (
    (group.items || []).map((item) => `${group.category_label}: ${item}`)
  )), '; ')
}

const overviewRows = [
  { key: 'salary', label: 'Mức lương', value: salaryValue },
  { key: 'workplaces', label: 'Địa điểm làm việc', value: workplaceValue },
  { key: 'work-types', label: 'Hình thức làm việc', value: workTypesValue },
  { key: 'employment', label: 'Loại công việc', value: (job) => simple(EMPLOYMENT_TYPE_LABELS[job.employment_type]) },
  { key: 'experience', label: 'Kinh nghiệm', value: (job) => simple(EXPERIENCE_YEARS_LABELS[job.experience_years]) },
  {
    key: 'education',
    label: 'Học vấn',
    value: (job) => simple(
      job.education_level === 'none' || EDUCATION_LEVEL_LABELS[job.education_level]
        ? formatEducation(job.education_level)
        : null,
    ),
  },
  { key: 'position', label: 'Cấp bậc', value: (job) => simple(POSITION_LEVEL_LABELS[job.position_level]) },
  { key: 'age', label: 'Độ tuổi', value: ageValue },
  { key: 'gender', label: 'Giới tính', value: (job) => simple(GENDER_LABELS[job.gender_requirement]) },
  { key: 'vacancies', label: 'Số lượng tuyển', value: (job) => simple(job.number_of_vacancies == null ? 'Không giới hạn' : `${job.number_of_vacancies} người`) },
  { key: 'deadline', label: 'Hạn nộp', value: deadlineValue },
  { key: 'published', label: 'Ngày đăng', value: (job) => simple(dateLabel(job.first_approved_at || job.published_at), job.first_approved_at || job.published_at) },
]

const expertiseRows = [
  { key: 'specialization', label: 'Vị trí chuyên môn', value: (job) => simple(job.primary_specialization?.name) },
  { key: 'domains', label: 'Kiến thức ngành', value: (job) => list((job.domain_knowledge || []).map((item) => item.name), ', ') },
  { key: 'required-skills', label: 'Kỹ năng bắt buộc', value: (job) => list(job.required_skills, ', ') },
  { key: 'preferred-skills', label: 'Kỹ năng ưu tiên', value: (job) => list(job.preferred_skills, ', ') },
  { key: 'languages', label: 'Ngoại ngữ', value: (job) => list((job.language_requirements || []).map(languageLabel), '; ') },
  { key: 'schedules', label: 'Lịch làm việc', value: (job) => list([...(job.work_schedules || []).map(scheduleLabel), job.work_schedule_note], '; ') },
]

const contentRows = [
  { key: 'reasons', label: 'Lý do nên ứng tuyển', value: (job) => list(job.application_reasons, '; ') },
  { key: 'benefit-groups', label: 'Phúc lợi nổi bật', value: benefitsValue },
  { key: 'description', label: 'Mô tả công việc', value: (job) => rich(job.description) },
  { key: 'requirements', label: 'Yêu cầu ứng viên', value: (job) => rich(job.requirements) },
  { key: 'benefits', label: 'Quyền lợi chi tiết', value: (job) => rich(job.benefits) },
]

const companyRows = [
  { key: 'verified', label: 'Xác thực nhà tuyển dụng', value: (job) => simple(job.company_verified ? 'Đã xác thực' : 'Chưa xác thực') },
  { key: 'company-size', label: 'Quy mô công ty', value: (job) => simple(job.company_size) },
  { key: 'industries', label: 'Lĩnh vực', value: (job) => list(job.company_industries, ', ') },
  { key: 'company-address', label: 'Địa chỉ công ty', value: (job) => simple(job.company_address) },
  { key: 'company-website', label: 'Website', value: (job) => link(job.company_website_url) },
  { key: 'company-description', label: 'Giới thiệu công ty', value: (job) => longText(job.company_description) },
]

export const COMPARISON_GROUPS = [
  { key: 'overview', title: 'Tổng quan', rows: overviewRows },
  { key: 'expertise', title: 'Chuyên môn và yêu cầu', rows: expertiseRows },
  { key: 'content', title: 'Phúc lợi và nội dung tuyển dụng', rows: contentRows },
  { key: 'company', title: 'Thông tin công ty', rows: companyRows },
]

export function comparisonRowIsDifferent(row, jobs) {
  if (jobs.length < 2) return false
  return new Set(jobs.map((job) => row.value(job).compare)).size > 1
}
