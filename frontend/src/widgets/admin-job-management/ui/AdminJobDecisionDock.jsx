import { Space } from 'antd'
import { adminJobStatusMeta } from '@/entities/admin-job'
import { JobVisibilityActions } from '@/features/enforce-job-visibility'
import { JobSubmissionReviewActions } from '@/features/review-job-submission'

export default function AdminJobDecisionDock({ job }) {
  const statusMeta = adminJobStatusMeta(job)
  const approveBlockers = job.approve_blockers || []
  const approveRequirements = job.approve_requirements || []
  const hint = approveBlockers.length
    ? `Không thể duyệt: ${approveBlockers.map((item) => item.label).join(' · ')}`
    : approveRequirements.map((item) => item.label).join(' · ')
      || 'Quyết định được khóa theo phiên bản đang hiển thị'

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
        <JobSubmissionReviewActions job={job} />
        <JobVisibilityActions job={job} />
      </Space>
    </section>
  )
}
