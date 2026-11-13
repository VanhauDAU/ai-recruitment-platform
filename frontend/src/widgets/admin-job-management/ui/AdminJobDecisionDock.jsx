import { Space } from 'antd'
import { Link } from 'react-router'
import { useAdminAccess } from '@/entities/admin-access'
import { adminJobStatusMeta } from '@/entities/admin-job'
import { useSession } from '@/entities/session'
import { JobVisibilityActions } from '@/features/enforce-job-visibility'
import { adminPath } from '@/shared/config/portals'

const EMPLOYER_COMPLIANCE_BLOCKERS = new Set([
  'verification_required',
  'dpa_outdated',
])

export default function AdminJobDecisionDock({ job }) {
  const { user } = useSession()
  const access = useAdminAccess(user)
  const statusMeta = adminJobStatusMeta(job)
  const blockedReasons = job.blocked_reasons || []
  const hint = blockedReasons.length
    ? `Chặn công khai: ${blockedReasons.map((item) => item.label).join(' · ')}`
    : 'Thao tác được khóa theo phiên bản đang hiển thị'
  const canOpenEmployerVerification = access.has('employer_verification.view')
    && Boolean(job.employer_public_id)
    && blockedReasons.some((item) => EMPLOYER_COMPLIANCE_BLOCKERS.has(item.code))

  return (
    <section aria-label="Quyết định kiểm duyệt" className="admin-job-action-dock">
      <div className="admin-job-action-dock__context">
        <span className={`admin-job-action-dock__dot admin-job-action-dock__dot--${statusMeta.color}`} />
        <span>
          <strong>{job.status_label || statusMeta.label}</strong>
          <small>{hint}</small>
        </span>
      </div>
      <Space wrap>
        {canOpenEmployerVerification && (
          <Link
            className="text-sm font-medium"
            to={`${adminPath(`/recruiters/${job.employer_public_id}`)}?tab=verification`}
          >
            Mở hồ sơ xác thực
          </Link>
        )}
        <JobVisibilityActions job={job} />
      </Space>
    </section>
  )
}
