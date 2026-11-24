import { CalendarOutlined, ClockCircleOutlined, DollarOutlined, EnvironmentOutlined, TagOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Avatar, Tooltip } from 'antd'
import { Link } from 'react-router'
import { formatJobPostedLabel, formatLocations, formatSalary } from '@/entities/job/job'
import { employerAppPath } from '@/shared/config/portals'
import dayjs from '@/shared/lib/dayjs'
import JobListActions from './JobListActions'
import JobStatusPill from './JobStatusPill'
import {
  candidateInitials,
  employerJobApplicationsPath,
  formatApplyRate,
  formatCount,
  jobDeadlineMeta,
  jobDisplayTitle,
} from './job-list-presentation'
import CodeBadge from '@/shared/ui/code-badge/CodeBadge'
import { m } from '@/shared/config/i18n'

// On a narrow list a row is a card and each stat carries its own label; on a
// wide list the table header names the columns.
function Stat({ label, children }) {
  return (
    <div className="wt-cell">
      <span className="wt-label">{label}</span>
      {children}
    </div>
  )
}

function Candidates({ job, candidateDataAccess }) {
  const previews = job.candidate_previews || []
  const candidateCount = job.candidate_count ?? previews.length
  const unviewed = job.unviewed_application_count || 0

  if (!job.application_count) {
    return <span className="ws-muted">{m.employer_job_list_no_applications()}</span>
  }

  const count = (
    <Tooltip title={job.application_count > candidateCount ? m.employer_job_list_submission_count({ count: job.application_count }) : null}>
      <strong className="ws-strong">{m.employer_job_list_candidate_count({ count: formatCount(candidateCount) })}</strong>
    </Tooltip>
  )
  const newBadge = unviewed > 0 && <span className="ws-pill ws-tone-orange">{m.employer_job_list_new_count({ count: unviewed })}</span>

  if (!candidateDataAccess) {
    return <div className="ejl-candidates">{count}{newBadge}</div>
  }

  return (
    <div className="ejl-candidates">
      {previews.length > 0 && (
        <ul aria-label={m.employer_job_list_recent_candidates({ title: jobDisplayTitle(job) })} className="ejl-avatars">
          {previews.slice(0, 3).map((candidate, index) => (
            <li key={candidate.application_public_id || candidate.public_id} style={{ zIndex: 3 - index }}>
              <Tooltip title={`${candidate.full_name}${candidate.cv_title ? ` · ${candidate.cv_title}` : ''}`}>
                <Link
                  aria-label={m.employer_job_list_open_application({ name: candidate.full_name })}
                  className="ejl-avatar-link"
                  to={employerJobApplicationsPath(job, { applicationId: candidate.application_public_id })}
                >
                  <Avatar size={24} src={candidate.avatar_url || undefined} className="ejl-avatar">
                    {candidateInitials(candidate.full_name)}
                  </Avatar>
                </Link>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
      <Link className="ejl-candidates__count" to={employerJobApplicationsPath(job)}>{count}</Link>
      {newBadge && (
        <Link aria-label={m.employer_job_list_unviewed_count({ count: unviewed })} to={employerJobApplicationsPath(job, { scope: 'unread' })}>
          {newBadge}
        </Link>
      )}
    </div>
  )
}

function Deadline({ job }) {
  const deadline = jobDeadlineMeta(job)
  return (
    <>
      <Tooltip title={deadline.windowEnds ? m.employer_job_list_window_ends() : null}>
        <span className="ws-strong ws-strong--sm">{deadline.date || m.employer_job_list_no_deadline()}</span>
      </Tooltip>
      <span className={`ws-caption ${deadline.tone.text}`}>{deadline.hint}</span>
      {deadline.progress !== null && (
        <span aria-hidden className="ws-progress">
          <span className={deadline.tone.bar} style={{ width: `${deadline.progress}%` }} />
        </span>
      )}
    </>
  )
}

// What blocks a hidden job, so the owner knows what to fix without opening it.
function hiddenReason(job) {
  if (job.effective_state !== 'hidden') return null
  return job.visibility_hold?.label || job.visibility_issues?.[0]?.label || null
}

export default function JobListCard({ job, candidateDataAccess = false, ...actionProps }) {
  const location = formatLocations(job)
  const timeline = job.status === 'draft' ? null : formatJobPostedLabel(job)
  const createdAt = job.created_at ? dayjs(job.created_at).format('DD/MM/YYYY HH:mm') : null
  const rate = formatApplyRate(job.candidate_count ?? job.application_count, job.view_count)
  const reason = hiddenReason(job)

  return (
    <article data-testid={`job-list-item-${job.public_id}`} className="wt-row">
      <div className="wt-cell wt-cell--main">
        <Link
          className={`wt-title${job.title ? '' : ' is-untitled'}`}
          title={jobDisplayTitle(job)}
          to={employerAppPath(`/jobs/${job.public_id}`)}
        >
          {jobDisplayTitle(job)}
        </Link>
        <div className="wt-meta">
          <CodeBadge code={job.code} />
          {createdAt && <span><CalendarOutlined aria-hidden />{m.employer_job_list_created_at({ date: createdAt })}</span>}
          {timeline && <span><ClockCircleOutlined aria-hidden />{timeline}</span>}
        </div>
        <div className="wt-meta">
          {job.category_name && <span><TagOutlined aria-hidden />{job.category_name}</span>}
          {location && <span><EnvironmentOutlined aria-hidden /> {location}</span>}
        </div>
        <div className="wt-meta">
          <span><DollarOutlined aria-hidden />{formatSalary(job)}</span>
          {job.campaign_name && (
            <Link className="ejl-row__campaign" to={employerAppPath(`/campaigns/${job.campaign}`)}>
              <ThunderboltOutlined aria-hidden />
              <span>{job.campaign_name}</span>
            </Link>
          )}
        </div>
      </div>
      <div className="wt-cell wt-cell--status">
        <JobStatusPill job={job} />
        {reason && <span className="ejl-row__reason">{reason}</span>}
      </div>
      <Stat label={m.employer_job_list_col_candidates()}>
        <Candidates job={job} candidateDataAccess={candidateDataAccess} />
      </Stat>
      <Stat label={m.employer_job_list_col_views()}>
        <span><strong className="ws-strong">{formatCount(job.view_count)}</strong> <span className="ws-muted">{m.employer_job_list_views_suffix()}</span></span>
        {rate && (
          <Tooltip title={m.employer_job_header_apply_rate_tooltip()}>
            <span className="ws-caption ws-muted">{m.employer_job_list_apply_rate_suffix({ rate })}</span>
          </Tooltip>
        )}
      </Stat>
      <Stat label={m.employer_job_list_col_closes()}>
        <Deadline job={job} />
      </Stat>
      <div className="wt-cell wt-cell--actions">
        <JobListActions job={job} candidateDataAccess={candidateDataAccess} {...actionProps} />
      </div>
    </article>
  )
}
