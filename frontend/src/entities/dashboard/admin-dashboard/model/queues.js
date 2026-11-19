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
  company_join_requests: {
    label: 'Yêu cầu tham gia chờ quản trị viên',
    hint: 'Công ty chưa có owner đã xác thực để duyệt',
    to: adminPath('/companies?tab=join-requests'),
  },
  company_updates: {
    label: 'Yêu cầu cập nhật công ty',
    hint: 'Sửa hồ sơ công ty chờ thẩm định, gồm đổi tên và mã số thuế',
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
