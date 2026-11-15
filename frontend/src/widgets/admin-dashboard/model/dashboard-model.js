import { adminPath } from '@/shared/config/portals'

// Ordered by impact on users: trust and safety first, then onboarding, then content.
export const QUEUE_CONFIG = {
  job_reports: {
    label: 'Báo cáo tin tuyển dụng',
    hint: 'Ứng viên báo tin sai sự thật hoặc lừa đảo',
    to: adminPath('/job-moderation?tab=reports'),
  },
  company_reports: {
    label: 'Báo cáo công ty',
    hint: 'Phản ánh về thông tin, mạo danh doanh nghiệp',
    to: adminPath('/company-reports'),
  },
  recruiter_verification: {
    label: 'Xác thực nhà tuyển dụng',
    hint: 'Hồ sơ pháp lý chờ duyệt để NTD được đăng tin',
    to: adminPath('/recruiters?tab=verification'),
  },
  job_resubmissions: {
    label: 'Tin đã sửa, chờ duyệt lại',
    hint: 'NTD đã chỉnh sửa tin bị tạm ẩn theo yêu cầu',
    to: adminPath('/job-moderation?job_scope=resubmitted'),
  },
  domain_verification: {
    label: 'Xác minh tên miền thủ công',
    hint: 'Công ty không thể xác minh bằng bản ghi DNS',
    to: adminPath('/recruiters?tab=domain-verification'),
  },
  company_updates: {
    label: 'Yêu cầu cập nhật công ty',
    hint: 'Thay đổi thông tin pháp lý cần thẩm định',
    to: adminPath('/companies?tab=updates'),
  },
  blog_reviews: {
    label: 'Bài viết chờ duyệt',
    hint: 'Bài mới và bản sửa của bài đã xuất bản',
    to: adminPath('/blog'),
  },
  knowledge_reviews: {
    label: 'FAQ & hướng dẫn chờ duyệt',
    hint: 'Phiên bản nội dung trợ giúp đã gửi duyệt',
    to: adminPath('/knowledgebase?revision_status=IN_REVIEW'),
  },
}

const QUEUE_ORDER = Object.keys(QUEUE_CONFIG)

export const DASHBOARD_LINKS = {
  activeJobs: adminPath('/job-moderation?job_scope=active'),
  heldJobs: adminPath('/job-moderation?job_scope=held'),
  restrictedCandidates: adminPath('/accounts?status=inactive,banned'),
  restrictedRecruiters: adminPath('/recruiters?status=inactive,banned'),
  knowledgeOverdue: adminPath('/knowledgebase?review_due=overdue'),
  recruiters: adminPath('/recruiters'),
  companies: adminPath('/companies'),
  candidates: adminPath('/accounts?tab=candidate'),
}

export const ACTIVITY_METRICS = [
  { key: 'applications', label: 'Lượt ứng tuyển', unit: 'lượt ứng tuyển' },
  { key: 'jobs', label: 'Tin đăng mới', unit: 'tin mới' },
  { key: 'candidates', label: 'Ứng viên mới', unit: 'ứng viên mới' },
  { key: 'employers', label: 'NTD mới', unit: 'NTD mới' },
]

const numberFormat = new Intl.NumberFormat('vi-VN')
const compactFormat = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 })
const percentFormat = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 0 })
const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })
const dayFormat = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })

export const formatNumber = (value) => numberFormat.format(Number(value || 0))
export const formatCompact = (value) => compactFormat.format(Number(value || 0))
export const formatPercent = (value) => percentFormat.format(Number.isFinite(value) ? value : 0)
export const formatTime = (value) => timeFormat.format(new Date(value))
export const formatToday = (date = new Date()) => dayFormat.format(date)

export function ratio(part, whole) {
  return whole > 0 ? part / whole : 0
}

/** Relative change; `null` when there is no previous base to compare with. */
export function periodChange({ current = 0, previous = 0 } = {}) {
  if (!previous) return current ? null : 0
  return (current - previous) / previous
}

export function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 11) return 'Chào buổi sáng'
  if (hour < 14) return 'Chào buổi trưa'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

export function formatAge(from, now = Date.now()) {
  const hours = Math.max(0, (now - new Date(from).getTime()) / 36e5)
  if (hours < 1) return 'dưới 1 giờ'
  if (hours < 24) return `${Math.floor(hours)} giờ`
  return `${Math.floor(hours / 24)} ngày`
}

/**
 * Pending queues sorted by urgency: overdue first, then by how much of the
 * SLA the oldest item has used. Empty queues are returned apart so the UI
 * can collapse them into a single "done" line.
 */
export function buildQueues(queues = [], now = Date.now()) {
  const items = queues
    .filter((queue) => QUEUE_CONFIG[queue.key])
    .map((queue) => {
      const ageHours = queue.oldest_at ? (now - new Date(queue.oldest_at).getTime()) / 36e5 : 0
      const slaUsed = queue.sla_hours ? ageHours / queue.sla_hours : 0
      const tone = queue.overdue > 0 ? 'critical' : slaUsed >= 0.6 ? 'warning' : 'normal'
      return { ...queue, ...QUEUE_CONFIG[queue.key], slaUsed, tone }
    })
  const pending = items
    .filter((item) => item.count > 0)
    .sort((left, right) => (
      (right.overdue > 0) - (left.overdue > 0)
      || right.slaUsed - left.slaUsed
      || QUEUE_ORDER.indexOf(left.key) - QUEUE_ORDER.indexOf(right.key)
    ))
  return {
    pending,
    cleared: items.filter((item) => item.count === 0),
    total: pending.reduce((sum, item) => sum + item.count, 0),
    overdue: pending.reduce((sum, item) => sum + item.overdue, 0),
  }
}
