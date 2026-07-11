import { WORK_TYPE_LABELS } from '../../../../constants/jobOptions'

const WEEKDAY_LABELS = {
  1: 'Thứ 2',
  2: 'Thứ 3',
  3: 'Thứ 4',
  4: 'Thứ 5',
  5: 'Thứ 6',
  6: 'Thứ 7',
  7: 'Chủ nhật',
}

function uniqueLines(lines) {
  return [...new Set(lines.map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean))]
}

// Nội dung tuyển dụng có thể là plain text hoặc HTML từ trình soạn thảo.
// Chuyển về các dòng thuần văn bản để panel hover không hiển thị thẻ HTML thô.
export function jobContentLines(content = '') {
  if (Array.isArray(content)) return uniqueLines(content.flatMap(jobContentLines))
  const value = String(content).trim()
  if (!value) return []
  if (!/<\/?[a-z][\s\S]*>/i.test(value) || typeof DOMParser === 'undefined') {
    return uniqueLines(value.split(/\r?\n/))
  }

  const document = new DOMParser().parseFromString(value, 'text/html')
  const blocks = [...document.body.querySelectorAll('li, p, h1, h2, h3, h4')]
  if (blocks.length > 0) return uniqueLines(blocks.map((node) => node.textContent || ''))
  return uniqueLines([document.body.textContent || ''])
}

export function previewLocationLines(job) {
  const locations = (job.job_locations || []).map((location) => [
    location.address_detail,
    location.location_name,
    location.location_level === 'ward' && location.province_name,
  ].filter(Boolean).join(', '))
  if (locations.length > 0) return uniqueLines(locations)
  return uniqueLines((job.locations_detail || []).map((location) => location.name))
}

function scheduleLine(item) {
  if (!item.weekday_from || !item.weekday_to) return item.note || ''
  const days = item.weekday_from === item.weekday_to
    ? WEEKDAY_LABELS[item.weekday_from]
    : `${WEEKDAY_LABELS[item.weekday_from]} - ${WEEKDAY_LABELS[item.weekday_to]}`
  const time = item.start_time && item.end_time
    ? `${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}${item.is_overnight ? ' hôm sau' : ''}`
    : ''
  const note = item.note?.trim() ? ` (${item.note.trim()})` : ''
  return [days, time].filter(Boolean).join(', ') + note
}

export function previewScheduleLines(job) {
  const schedules = (job.work_schedules || []).map(scheduleLine)
  const note = jobContentLines(job.work_schedule_note)
  const fallback = schedules.length === 0 && note.length === 0 && job.work_type
    ? [`Hình thức: ${WORK_TYPE_LABELS[job.work_type] || job.work_type}`]
    : []
  return uniqueLines([...schedules, ...note, ...fallback])
}

export function previewBenefitLines(job) {
  const content = jobContentLines(job.benefits)
  if (content.length > 0) return content
  return uniqueLines((job.job_benefits || []).map((item) => (
    [item.benefit_name, item.note].filter(Boolean).join(': ')
  )))
}

