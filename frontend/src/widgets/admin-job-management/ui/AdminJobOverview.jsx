import {
  CalendarOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  FlagOutlined,
} from '@ant-design/icons'
import { Alert, Space, Tag } from 'antd'
import {
  adminJobStatusMeta,
  formatAdminJobDate,
  formatAdminJobDateTime,
} from '@/entities/admin-job'
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

export default function AdminJobOverview({ job }) {
  const statusMeta = adminJobStatusMeta(job)
  const holds = [job.policy_hold_label, job.moderation_hold_label].filter(
    (value) => value && value !== 'Không giữ',
  )
  const changeCount = job.pending_changes?.changed_count || 0
  return (
    <section className="admin-panel admin-job-overview">
      <div className="admin-job-overview__heading">
        <div className="min-w-0">
          <p className="admin-job-overview__eyebrow">{job.company_name} · {job.public_id}</p>
          <h1 className="admin-job-overview__title">{job.title}</h1>
        </div>
        <Space wrap>
          <Tag color={statusMeta.color}>{job.status_label || statusMeta.label}</Tag>
          {changeCount > 0 && <Tag color="blue">Bản cập nhật · {changeCount} thay đổi</Tag>}
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
          className="admin-job-overview__blocked"
          showIcon
          title={`Chặn công khai: ${job.blocked_reasons.map((item) => item.label).join(' · ')}`}
          type="warning"
        />
      )}
    </section>
  )
}

