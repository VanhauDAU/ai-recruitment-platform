import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { adminAccountKeys } from '@/entities/account/admin-account'
import { dataRequestKeys } from '@/entities/account/data-request'
import { adminCompanyKeys } from '@/entities/company/admin-company'
import {
  adminCompanyDomainClaimKeys,
  adminEmployerVerificationKeys,
} from '@/entities/company/admin-employer-verification'
import { companyReportKeys } from '@/entities/company/company-report'
import { adminDashboardKeys } from '@/entities/dashboard/admin-dashboard'
import { adminJobKeys } from '@/entities/job/admin-job'
import { jobReportKeys } from '@/entities/job/job-report'
import { useRealtimeEvents } from '@/shared/api/use-realtime'

// Một lượt duyệt hàng loạt phát nhiều sự kiện liền nhau: gom lại rồi mới refetch.
const FLUSH_DELAY_MS = 400

/** Hàng chờ (khóa của `/admin/dashboard/queues/`) → tiền tố query của các màn hình hiển thị nó. */
export const ADMIN_QUEUE_QUERY_KEYS = {
  recruiter_verification: [adminEmployerVerificationKeys.all, [...adminAccountKeys.all, 'summary']],
  domain_verification: [adminCompanyDomainClaimKeys.all],
  company_updates: [adminEmployerVerificationKeys.all, adminCompanyKeys.summary],
  company_join_requests: [[...adminCompanyKeys.all, 'join-requests']],
  company_content_changes: [[...adminCompanyKeys.all, 'content-changes']],
  job_reports: [jobReportKeys.adminLists, adminJobKeys.summary],
  job_resubmissions: [adminJobKeys.lists(), adminJobKeys.summary],
  company_reports: [companyReportKeys.adminLists],
  privacy_requests: [dataRequestKeys.adminLists],
  admin_invitations: [[...adminAccountKeys.all, 'invitations'], [...adminAccountKeys.all, 'summary']],
}
const ALL_QUEUES = Object.keys(ADMIN_QUEUE_QUERY_KEYS)

/**
 * Cổng quản trị nghe `admin.queue.changed` để badge, bảng điều khiển và danh
 * sách hàng chờ tự làm mới. Sự kiện chỉ nói hàng chờ nào đổi; dữ liệu vẫn lấy
 * lại qua REST. Mỗi lần (nối lại) socket làm mới hết để bù sự kiện đã lỡ.
 */
export function useAdminQueueRealtime(enabled) {
  const queryClient = useQueryClient()
  const pending = useRef(new Set())
  const timer = useRef(0)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useRealtimeEvents((event) => {
    const queues = event.type === 'connected'
      ? ALL_QUEUES
      : event.type === 'admin.queue.changed' && ADMIN_QUEUE_QUERY_KEYS[event.queue]
        ? [event.queue]
        : []
    if (!queues.length) return
    queues.forEach((queue) => pending.current.add(queue))
    if (timer.current) return
    timer.current = window.setTimeout(() => {
      timer.current = 0
      const keys = [adminDashboardKeys.all]
      pending.current.forEach((queue) => keys.push(...ADMIN_QUEUE_QUERY_KEYS[queue]))
      pending.current.clear()
      keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
    }, FLUSH_DELAY_MS)
  }, { enabled })
}
