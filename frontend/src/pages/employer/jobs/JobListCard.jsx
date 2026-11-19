import {
  CalendarOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Avatar, Tooltip } from 'antd'
import { Link } from 'react-router'
import {
  EMPLOYMENT_TYPE_LABELS,
  formatJobPostedLabel,
  formatLocations,
} from '@/entities/job/job'
import { employerAppPath } from '@/shared/config/portals'
import JobListActions from './JobListActions'
import JobStatusPill from './JobStatusPill'
import {
  candidateInitials,
  employerJobApplicationsPath,
  formatApplyRate,
  formatCount,
  formatJobDate,
  jobDeadlineMeta,
  jobDisplayTitle,
} from './job-list-presentation'
import { m } from '@/shared/config/i18n'

function Candidates({ job, candidateDataAccess }) {
  const previews = job.candidate_previews || []
  const candidateCount = job.candidate_count ?? previews.length
  const unviewed = job.unviewed_application_count || 0

  if (!job.application_count) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-400">
        <TeamOutlined aria-hidden /> {m.employer_job_list_no_applications()}
      </span>
    )
  }

  const count = (
    <Tooltip title={job.application_count > candidateCount ? m.employer_job_list_submission_count({ count: job.application_count }) : null}>
      <strong className="whitespace-nowrap text-sm font-semibold text-slate-800">{m.employer_job_list_candidate_count({ count: formatCount(candidateCount) })}</strong>
    </Tooltip>
  )
  const newBadge = unviewed > 0 && <span className="job-pill job-pill--plain job-tone-orange">{m.employer_job_list_new_count({ count: unviewed })}</span>

  if (!candidateDataAccess) {
    return <div className="flex min-w-0 items-center gap-2"><TeamOutlined aria-hidden className="text-slate-400" />{count}{newBadge}</div>
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {previews.length === 0 && <TeamOutlined aria-hidden className="text-slate-400" />}
      {previews.length > 0 && (
        <ul aria-label={m.employer_job_list_recent_candidates({ title: jobDisplayTitle(job) })} className="m-0 flex shrink-0 list-none p-0 pl-1.5">
          {previews.slice(0, 3).map((candidate, index) => (
            <li key={candidate.application_public_id || candidate.public_id} className="-ml-1.5 first:ml-0" style={{ zIndex: 3 - index }}>
              <Tooltip title={`${candidate.full_name}${candidate.cv_title ? ` · ${candidate.cv_title}` : ''}`}>
                <Link
                  aria-label={m.employer_job_list_open_application({ name: candidate.full_name })}
                  className="block rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                  to={employerJobApplicationsPath(job, { applicationId: candidate.application_public_id })}
                >
                  <Avatar
                    size={26}
                    src={candidate.avatar_url || undefined}
                    className="!border-2 !border-white !bg-slate-700 !text-[9px] !font-bold shadow-xs"
                  >
                    {candidateInitials(candidate.full_name)}
                  </Avatar>
                </Link>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
      <Link className="min-w-0 !text-slate-800 hover:!text-emerald-700" to={employerJobApplicationsPath(job)}>{count}</Link>
      {newBadge && (
        <Link aria-label={m.employer_job_list_unviewed_count({ count: unviewed })} to={employerJobApplicationsPath(job, { scope: 'unread' })}>
          {newBadge}
        </Link>
      )}
    </div>
  )
}

function Performance({ job }) {
  const rate = formatApplyRate(job.candidate_count ?? job.application_count, job.view_count)
  return (
    <div className="job-row__stack flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs text-slate-500">
      <span className="inline-flex items-center gap-1.5">
        <EyeOutlined aria-hidden className="text-slate-400" />
        <strong className="text-sm font-semibold text-slate-800">{formatCount(job.view_count)}</strong> {m.employer_job_list_views_suffix()}
      </span>
      {rate && (
        <Tooltip title={m.employer_job_header_apply_rate_tooltip()}>
          <span className="hidden text-slate-400 sm:inline">
            <span className="job-row__inline-only">· </span>{m.employer_job_list_apply_rate_suffix({ rate })}
          </span>
        </Tooltip>
      )}
    </div>
  )
}

function Deadline({ job }) {
  const deadline = jobDeadlineMeta(job)
  return (
    <div className="job-row__stack flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs">
      <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
        <CalendarOutlined aria-hidden className="job-row__inline-only text-slate-400" />
        {deadline.date || m.employer_job_list_no_deadline()}
      </span>
      <span className={`font-medium ${deadline.tone.text}`}>
        <span className="job-row__inline-only text-slate-300">· </span>{deadline.hint}
      </span>
      {deadline.progress !== null && (
        <span aria-hidden className="job-deadline-bar h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <span className={`block h-full rounded-full ${deadline.tone.bar}`} style={{ width: `${deadline.progress}%` }} />
        </span>
      )}
    </div>
  )
}

export default function JobListCard({ job, candidateDataAccess = false, ...actionProps }) {
  const location = formatLocations(job)
  const employmentType = EMPLOYMENT_TYPE_LABELS[job.employment_type]
  const timeline = job.status === 'draft'
    ? m.employer_job_list_created_on({ date: formatJobDate(job.created_at) })
    : formatJobPostedLabel(job)

  return (
    <article
      data-testid={`job-list-item-${job.public_id}`}
      className="job-row group px-3 py-3.5 transition-colors duration-150 hover:bg-slate-50/80 focus-within:bg-slate-50/80 sm:px-4"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-start gap-2 sm:items-center">
          <Link
            className={`job-row__title min-w-0 text-[15px] font-semibold leading-snug !text-slate-900 hover:!text-emerald-700 ${job.title ? '' : 'italic !text-slate-500'}`}
            to={employerAppPath(`/jobs/${job.public_id}`)}
          >
            {jobDisplayTitle(job)}
          </Link>
          <JobStatusPill job={job} />
        </div>
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {job.campaign_name && (
            <Link
              className="inline-flex min-w-0 max-w-full items-center gap-1 !text-slate-500 hover:!text-emerald-700"
              to={employerAppPath(`/campaigns/${job.campaign}`)}
            >
              <ThunderboltOutlined aria-hidden className="text-emerald-600" />
              <span className="truncate">{job.campaign_name}</span>
            </Link>
          )}
          {location && (
            <span className="inline-flex items-center gap-1">
              <EnvironmentOutlined aria-hidden className="text-slate-400" />{location}
            </span>
          )}
          {employmentType && <span className="hidden sm:inline">{employmentType}</span>}
          {timeline && <span className="text-slate-400">{timeline}</span>}
        </div>
      </div>

      <div className="job-row__stats mt-3 border-t border-dashed border-slate-100 pt-3">
        <Candidates job={job} candidateDataAccess={candidateDataAccess} />
        <Performance job={job} />
        <Deadline job={job} />
        <JobListActions job={job} candidateDataAccess={candidateDataAccess} {...actionProps} />
      </div>
    </article>
  )
}
