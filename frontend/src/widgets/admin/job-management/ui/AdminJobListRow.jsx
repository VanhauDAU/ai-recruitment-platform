import { BankOutlined, CalendarOutlined, ExportOutlined, EyeOutlined, SendOutlined, UserOutlined } from '@ant-design/icons'
import {
  adminJobStatusMeta,
  formatAdminJobDate,
  formatAdminJobDateTime,
} from '@/entities/job/admin-job'
import { getIntlLocale, m } from '@/shared/config/i18n'

// Pill tones map onto `.ws-tone-*` in @/shared/ui/workspace-list/workspace-list.css.
const STATUS_TONES = { active: 'emerald', draft: 'slate', closed: 'slate' }
const count = (value) => (Number(value) || 0).toLocaleString(getIntlLocale())

// On a narrow table each stat carries its own label; a wide one has a header.
function Stat({ label, children }) {
  return (
    <div className="wt-cell">
      <span className="wt-label">{label}</span>
      {children}
    </div>
  )
}

export default function AdminJobListRow({ job, onOpen }) {
  const status = adminJobStatusMeta(job)
  const reports = Number(job.pending_report_count) || 0
  const publicPath = job.is_publicly_visible && job.slug ? `/viec-lam/${job.slug}` : null

  return (
    <article data-testid={`admin-job-row-${job.public_id}`} className="wt-row">
      <div className="wt-cell wt-cell--main">
        <button type="button" className="wt-title ajl-title" onClick={() => onOpen(job)}>{job.title}</button>
        <div className="wt-meta">
          <span className="ajl-code">{job.public_id}</span>
          <span><BankOutlined aria-hidden />{job.company_name}</span>
        </div>
        <div className="wt-meta">
          <span><UserOutlined aria-hidden />{job.employer_name}</span>
          {job.employer_email && <span className="ws-muted">{job.employer_email}</span>}
        </div>
        <div className="wt-meta">
          <span><CalendarOutlined aria-hidden />{m.admin_job_list_created({ date: formatAdminJobDateTime(job.created_at) })}</span>
          {job.submitted_at && <span><SendOutlined aria-hidden />{m.admin_job_list_submitted({ date: formatAdminJobDateTime(job.submitted_at) })}</span>}
        </div>
      </div>
      <div className="wt-cell wt-cell--status">
        <span className={`ws-pill ws-tone-${STATUS_TONES[job.status] || 'slate'}`}>{job.status_label || status.label}</span>
        {job.is_expired && <span className="ws-pill ws-tone-orange">{m.admin_job_list_expired_pill()}</span>}
        {(job.policy_hold || job.moderation_hold) && <span className="ws-pill ws-tone-red">{m.admin_job_list_held_pill()}</span>}
      </div>
      <Stat label={m.admin_job_list_col_signals()}>
        <strong className={`ws-strong ws-strong--sm${reports ? ' ajl-alert' : ''}`}>{m.admin_job_list_pending_reports({ count: count(reports) })}</strong>
        <span className="ws-caption ws-muted">{m.admin_job_list_published_jobs({ count: count(job.published_job_count) })}</span>
      </Stat>
      <Stat label={m.admin_job_list_col_applications()}>
        <strong className="ws-strong">{count(job.application_count)}</strong>
        <span className="ws-caption ws-muted">{m.admin_job_list_views({ count: count(job.view_count) })}</span>
      </Stat>
      <Stat label={m.admin_job_list_col_deadline()}>
        <span className="ws-strong ws-strong--sm">{formatAdminJobDate(job.deadline)}</span>
        {job.is_expired && <span className="ws-caption ajl-alert">{m.admin_job_list_deadline_passed()}</span>}
      </Stat>
      <div className="wt-cell wt-cell--actions">
        <div className="wt-actions">
          <button type="button" aria-label={m.admin_job_list_view_detail()} className="wt-btn wt-btn--primary" onClick={() => onOpen(job)}>
            <EyeOutlined aria-hidden /><span>{m.admin_job_list_view_detail()}</span>
          </button>
          {publicPath && (
            <a aria-label={m.admin_job_list_public_aria()} className="wt-btn" href={publicPath} target="_blank" rel="noreferrer">
              <ExportOutlined aria-hidden /><span>{m.admin_job_list_public()}</span>
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
