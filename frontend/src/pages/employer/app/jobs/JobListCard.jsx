import { EyeOutlined, TeamOutlined } from '@ant-design/icons'
import { Avatar, Tooltip } from 'antd'
import { Link } from 'react-router'
import {
  EMPLOYMENT_TYPE_LABELS,
  formatDeadline,
  formatLocations,
} from '@/entities/job'
import { employerAppPath } from '@/shared/config/portals'
import JobListActions from './JobListActions'
import {
  candidateInitials,
  employerJobApplicationsPath,
  formatJobDate,
  jobStatusMeta,
} from './job-list-presentation'

function CandidatePreviews({ job, candidateDataAccess }) {
  const previews = job.candidate_previews || []
  const candidateCount = job.candidate_count ?? previews.length
  const applicationCount = job.application_count || 0

  if (!applicationCount) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-400">
        <TeamOutlined aria-hidden /> Chưa có hồ sơ
      </span>
    )
  }

  if (!candidateDataAccess) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs text-slate-500">
        <TeamOutlined aria-hidden />
        <strong className="font-semibold text-slate-800">{candidateCount} ứng viên</strong>
        <span className="text-slate-300">·</span>
        {applicationCount} CV
      </span>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <ul
        aria-label={`Ứng viên gần đây của ${job.title}`}
        className="m-0 flex shrink-0 list-none p-0 pl-1.5"
      >
        {previews.slice(0, 3).map((candidate, index) => (
          <li
            key={candidate.application_public_id || candidate.public_id}
            className="-ml-1.5 first:ml-0"
            style={{ zIndex: previews.length - index }}
          >
            <Tooltip
              title={`${candidate.full_name}${candidate.cv_title ? ` · ${candidate.cv_title}` : ''}`}
            >
              <Link
                aria-label={`Mở hồ sơ ${candidate.full_name}`}
                className="block rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                to={employerJobApplicationsPath(job, candidate)}
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
        {previews.length === 0 && (
          <li className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] text-slate-500">
            <TeamOutlined aria-hidden />
          </li>
        )}
      </ul>
      <Link
        className="min-w-0 whitespace-nowrap text-xs !text-slate-500 hover:!text-emerald-700"
        to={employerJobApplicationsPath(job)}
      >
        <strong className="font-semibold text-slate-800">{candidateCount} ứng viên</strong>
        <span className="mx-1 text-slate-300">·</span>
        {applicationCount} CV
      </Link>
    </div>
  )
}

export default function JobListCard({
  job,
  closing,
  deleting,
  duplicating,
  onClose,
  onDelete,
  onDuplicate,
  candidateDataAccess = false,
}) {
  const status = jobStatusMeta(job)
  const deadlineHelper = formatDeadline(job.deadline)
  const location = formatLocations(job)
  const employmentType = EMPLOYMENT_TYPE_LABELS[job.employment_type]

  return (
    <article
      data-testid={`job-list-item-${job.public_id}`}
      className="group relative px-3 py-3 transition-colors duration-150 hover:bg-slate-50/80 focus-within:bg-slate-50/80 sm:px-4"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:grid lg:grid-cols-[minmax(0,1fr)_180px_105px_112px] lg:gap-4">
        <div className="w-full min-w-0 lg:w-auto">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              className="min-w-0 truncate text-sm font-bold !text-slate-900 hover:!text-emerald-700 sm:text-[15px]"
              to={employerAppPath(`/jobs/${job.public_id}`)}
            >
              {job.title || 'Tin nháp chưa đặt tên'}
            </Link>
            <Tooltip title={job.status === 'rejected' ? job.rejected_reason : undefined}>
              <span className={`inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold ${status.className}`}>
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            </Tooltip>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11px] text-slate-500">
            {job.campaign_name && (
              <Link
                className="min-w-0 truncate !text-slate-500 hover:!text-emerald-700"
                to={employerAppPath(`/campaigns/${job.campaign}`)}
              >
                {job.campaign_name}
              </Link>
            )}
            {job.campaign_name && location && <span className="text-slate-300">·</span>}
            {location && <span className="truncate">{location}</span>}
            {employmentType && <span className="hidden text-slate-300 sm:inline">·</span>}
            {employmentType && <span className="hidden shrink-0 sm:inline">{employmentType}</span>}
            <span className="shrink-0 text-slate-300">·</span>
            <span className="shrink-0">Hạn {formatJobDate(job.deadline)}</span>
            {deadlineHelper && <span className="hidden shrink-0 text-slate-400 xl:inline">· {deadlineHelper}</span>}
          </div>
        </div>

        <CandidatePreviews job={job} candidateDataAccess={candidateDataAccess} />

        <Tooltip title="Lượt xem tin tuyển dụng">
          <span className="hidden items-center gap-1.5 whitespace-nowrap text-xs text-slate-500 sm:inline-flex">
            <EyeOutlined aria-hidden />
            <strong className="font-semibold text-slate-700">{job.view_count || 0}</strong> lượt xem
          </span>
        </Tooltip>

        <JobListActions
          job={job}
          candidateDataAccess={candidateDataAccess}
          closing={closing}
          deleting={deleting}
          duplicating={duplicating}
          onClose={onClose}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
        />
      </div>
    </article>
  )
}
