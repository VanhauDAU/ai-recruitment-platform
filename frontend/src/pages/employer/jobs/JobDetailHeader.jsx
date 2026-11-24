import {
  ArrowLeftOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  EditOutlined,
  EnvironmentOutlined,
  ExportOutlined,
  MoreOutlined,
  StopOutlined,
  SyncOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Button, Dropdown, Tooltip, Typography } from 'antd'
import dayjs from '@/shared/lib/dayjs'
import { Link, useNavigate } from 'react-router'
import { employerAppPath } from '@/shared/config/portals'
import JobStatusPill from './JobStatusPill'
import { publicJobUrl } from './job-detail-presentation'
import {
  formatApplyRate,
  formatCount,
  formatJobDate,
  isJobEditableUnderHold,
  isJobHeld,
  jobDeadlineMeta,
  jobDisplayTitle,
} from './job-list-presentation'
import { m } from '@/shared/config/i18n'

function Metric({ label, value, hint, tooltip, accent, onClick, testId }) {
  const Element = onClick ? 'button' : 'div'
  return (
    <Tooltip title={tooltip}>
      <Element
        data-testid={testId}
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={`flex min-w-0 flex-col items-start bg-white px-4 py-3 text-left sm:px-5 ${onClick ? 'cursor-pointer border-0 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]' : ''}`}
      >
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className="mt-0.5 flex min-w-0 items-end gap-1.5">
          <strong className={`text-2xl font-bold tabular-nums ${accent || 'text-slate-900'}`}>{value}</strong>
          {hint && <span className="truncate pb-1 text-xs text-slate-400">{hint}</span>}
        </span>
      </Element>
    </Tooltip>
  )
}

export default function JobDetailHeader({ job, publicId, summary, closing, onClose, onDeadlineAction, onSelectFilter }) {
  const navigate = useNavigate()
  // The backend refuses edits, extensions and reopening while a job is held.
  const held = isJobHeld(job)
  const deadline = jobDeadlineMeta(job)
  const publicUrl = publicJobUrl(job)
  const location = [...new Set((job.job_locations || []).map((item) => item.province_name).filter(Boolean))]
  const canExtendDeadline = !job.visibility_ends_at || dayjs(job.visibility_ends_at).isAfter(dayjs())
  const applyRate = formatApplyRate(summary.total, job.view_count)
  const actionClass = 'job-header-action !h-9 !rounded-lg !font-semibold'

  return (
    <header className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="p-4 sm:p-5">
        <Link to={employerAppPath('/jobs')} className="inline-flex items-center gap-1.5 text-xs font-medium !text-slate-500 hover:!text-[var(--brand-primary-hover)]">
          <ArrowLeftOutlined aria-hidden /> {m.employer_job_detail_back_to_jobs()}
        </Link>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="min-w-0 break-words text-xl font-bold leading-tight text-slate-900 sm:text-2xl">{jobDisplayTitle(job)}</h1>
              <JobStatusPill job={job} />
            </div>
            <ul className="mt-2.5 flex list-none flex-wrap items-center gap-x-4 gap-y-1.5 p-0 text-[13px] text-slate-500">
              <li className="min-w-0">
                {job.campaign && job.campaign_name ? (
                  <Link
                    aria-label={m.employer_job_header_open_campaign({ name: job.campaign_name })}
                    className="inline-flex max-w-72 items-center gap-1.5 font-medium !text-[var(--brand-primary-hover)] hover:!text-[var(--brand-primary)]"
                    to={employerAppPath(`/campaigns/${job.campaign}?active_tab=job`)}
                  >
                    <ThunderboltOutlined aria-hidden /> <span className="truncate">{job.campaign_name}</span>
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5"><ThunderboltOutlined aria-hidden /> {m.employer_job_header_no_campaign()}</span>
                )}
              </li>
              {location.length > 0 && (
                <li className="inline-flex items-center gap-1.5"><EnvironmentOutlined aria-hidden /> {location.join(', ')}</li>
              )}
              <li className="inline-flex items-center gap-1.5">
                <CalendarOutlined aria-hidden /> {m.employer_job_header_deadline({ date: deadline.date || m.employer_job_header_deadline_not_set() })}
                {job.status === 'active' && <span className={`font-medium ${deadline.tone.text}`}>· {deadline.hint}</span>}
              </li>
              {job.status !== 'draft' && (job.first_approved_at || job.published_at) && (
                <li className="inline-flex items-center gap-1.5">
                  <ClockCircleOutlined aria-hidden /> {m.employer_job_header_posted({ date: formatJobDate(job.first_approved_at || job.published_at) })}
                </li>
              )}
              <li>
                <Typography.Text
                  copyable={{ text: publicId, tooltips: [m.employer_job_header_copy_id(), m.employer_job_header_copied()] }}
                  className="font-mono !text-xs !text-slate-400"
                >
                  #{publicId}
                </Typography.Text>
              </li>
            </ul>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
            {publicUrl && (
              <Button className={actionClass} href={publicUrl} target="_blank" rel="noopener noreferrer" icon={<ExportOutlined />}>
                {m.employer_job_cv_view_posting()}
              </Button>
            )}
            {(!held || isJobEditableUnderHold(job)) && job.status !== 'closed' && (
              <Button className={actionClass} icon={<EditOutlined />} onClick={() => navigate(employerAppPath(`/jobs/${publicId}/edit`))}>
                {m.employer_job_header_edit()}
              </Button>
            )}
            {!held && job.status === 'active' && job.is_expired && canExtendDeadline && (
              <Button className={actionClass} type="primary" icon={<SyncOutlined />} onClick={() => onDeadlineAction('extend')}>{m.employer_job_list_extend()}</Button>
            )}
            {!held && job.status === 'closed' && (
              <Button className={actionClass} type="primary" icon={<SyncOutlined />} onClick={() => onDeadlineAction('reopen')}>{m.employer_job_header_reopen()}</Button>
            )}
            {job.status === 'active' && (
              <Dropdown
                trigger={['click']}
                placement="bottomRight"
                menu={{ items: [{ key: 'close', danger: true, icon: <StopOutlined />, label: m.employer_job_detail_stop_hiring(), onClick: onClose }] }}
              >
                <Button aria-label={m.employer_job_header_more_actions()} className="!h-9 !w-9 !rounded-lg" icon={<MoreOutlined />} loading={closing} />
              </Dropdown>
            )}
          </div>
        </div>
      </div>

      <div className="job-hairline-grid grid grid-cols-2 border-t border-slate-100 bg-slate-100 sm:grid-cols-4">
        <Metric
          testId="job-metric-views"
          label={m.employer_job_header_views()}
          value={formatCount(job.view_count)}
          hint={job.impression_count ? m.employer_job_header_impressions({ count: formatCount(job.impression_count) }) : null}
          tooltip={m.employer_job_header_views_tooltip()}
        />
        <Metric
          testId="job-metric-total-cvs"
          label={m.employer_job_header_candidates()}
          value={formatCount(summary.total)}
          hint={applyRate ? m.employer_job_header_apply_rate({ rate: applyRate }) : null}
          tooltip={applyRate ? m.employer_job_header_apply_rate_tooltip() : null}
          onClick={() => onSelectFilter('all')}
        />
        <Metric
          testId="job-metric-unviewed-cvs"
          label={m.employer_job_header_unviewed()}
          value={formatCount(summary.unviewed)}
          accent={summary.unviewed ? 'text-orange-600' : null}
          onClick={() => onSelectFilter('submitted')}
        />
        <Metric
          testId="job-metric-unanswered-cvs"
          label={m.employer_job_header_unanswered()}
          value={formatCount(summary.unanswered)}
          accent={summary.unanswered ? 'text-amber-600' : null}
          tooltip={m.employer_job_header_unanswered_tooltip()}
          onClick={() => onSelectFilter('unanswered')}
        />
      </div>
    </header>
  )
}
