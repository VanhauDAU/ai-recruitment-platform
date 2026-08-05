import {
  CalendarOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  FlagOutlined,
} from '@ant-design/icons'
import { Alert, Button, Space, Tag } from 'antd'
import {
  adminJobStatusMeta,
  formatAdminJobDate,
  formatAdminJobDateTime,
} from '@/entities/admin-job'
import { JobVisibilityActions } from '@/features/enforce-job-visibility'
import { JobSubmissionReviewActions } from '@/features/review-job-submission'
import { formatAdminJobSalary } from '../model/detail-presentation'

function QuickFact({ icon, label, value, danger = false }) {
  return (
    <div className={`admin-job-quick-fact ${danger ? 'admin-job-quick-fact--danger' : ''}`}>
      <span className="admin-job-quick-fact__icon" aria-hidden="true">{icon}</span>
      <span className="min-w-0">
        <span className="admin-job-quick-fact__label">{label}</span>
        <strong className="admin-job-quick-fact__value">{value}</strong>
      </span>
    </div>
  )
}

export default function AdminJobOverview({ job, openCount, sectionCount, onCollapseAll, onOpenAll }) {
  const statusMeta = adminJobStatusMeta(job)
  const holds = [job.policy_hold_label, job.moderation_hold_label].filter(
    (value) => value && value !== 'Không giữ',
  )
  return (
    <>
      <section className="admin-panel admin-job-overview">
        <div className="admin-job-overview__heading">
          <div className="min-w-0">
            <p className="admin-job-overview__eyebrow">{job.company_name} · {job.public_id}</p>
            <h1 className="admin-job-overview__title">{job.title}</h1>
          </div>
          <Space wrap>
            <Tag color={statusMeta.color}>{job.status_label || statusMeta.label}</Tag>
            {job.is_expired && <Tag color="orange">Quá hạn</Tag>}
            {holds.map((hold) => <Tag color="red" key={hold}>{hold}</Tag>)}
          </Space>
        </div>

        <div className="admin-job-quick-facts">
          <QuickFact icon={<DollarOutlined />} label="Thu nhập" value={formatAdminJobSalary(job)} />
          <QuickFact icon={<CalendarOutlined />} label="Hạn nộp" value={formatAdminJobDate(job.deadline)} />
          <QuickFact icon={<ClockCircleOutlined />} label="Gửi duyệt" value={formatAdminJobDateTime(job.submitted_at)} />
          <QuickFact
            danger={Boolean(job.pending_report_count)}
            icon={<FlagOutlined />}
            label="Báo cáo chờ"
            value={job.pending_report_count || 0}
          />
        </div>

        {job.blocked_reasons?.length > 0 && (
          <Alert
            className="mt-4"
            description={(
              <ul className="list-disc pl-5">
                {job.blocked_reasons.map((reason) => <li key={reason.code}>{reason.label}</li>)}
              </ul>
            )}
            showIcon
            title="Tin đang có điều kiện chặn công khai"
            type="warning"
          />
        )}

        <div className="admin-job-overview__controls">
          <span>{openCount}/{sectionCount} mục đang mở</span>
          <Space wrap size="small">
            <Button disabled={openCount === sectionCount} onClick={onOpenAll} size="small">
              Mở tất cả
            </Button>
            <Button disabled={openCount === 0} onClick={onCollapseAll} size="small">
              Thu gọn tất cả
            </Button>
          </Space>
        </div>
      </section>

      <section className="admin-job-action-dock" aria-label="Quyết định kiểm duyệt">
        <div className="admin-job-action-dock__context">
          <span className={`admin-job-action-dock__dot admin-job-action-dock__dot--${statusMeta.color}`} />
          <span>
            <strong>{job.status_label || statusMeta.label}</strong>
            <small>Quyết định được khóa theo phiên bản đang hiển thị</small>
          </span>
        </div>
        <Space wrap>
          <JobSubmissionReviewActions job={job} />
          <JobVisibilityActions job={job} />
        </Space>
      </section>
    </>
  )
}

