import { HeartFilled, HeartOutlined } from '@ant-design/icons'
import { Link } from 'react-router'
import {
  EXPERIENCE_YEARS_LABELS,
  formatJobPostedLabel,
  formatLocations,
  formatSalary,
  jobDetailPath,
  JobPresentationLabels,
} from '@/entities/job'
import { useSession } from '@/entities/session'
import { useLoginPrompt } from '@/features/auth'
import { useSavedJob } from '@/features/saved-jobs'
import { JobImpressionBoundary } from '@/features/track-job-engagement'
import { message } from '@/shared/lib/toast'

function Chip({ children }) {
  return (
    <span className="inline-flex max-w-full items-center truncate rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-600 ring-1 ring-gray-200/70">
      {children}
    </span>
  )
}

/** Thẻ tin trong trang công ty: bỏ logo và tên công ty vì cả trang đã là công ty đó. */
export default function CompanyJobCard({ job }) {
  const { isAuthenticated, user } = useSession()
  const { promptLogin } = useLoginPrompt()
  const [saved, toggleSaved, savePending] = useSavedJob(job.public_id, job)
  const locationLabel = formatLocations(job)
  const experience = EXPERIENCE_YEARS_LABELS[job.experience_years]
  const posted = formatJobPostedLabel(job)

  function toggleSave() {
    if (!isAuthenticated) {
      promptLogin()
      return
    }
    if (user?.role !== 'candidate') {
      message.warning('Chỉ ứng viên mới có thể lưu việc làm.')
      return
    }
    toggleSaved()
  }

  return (
    <JobImpressionBoundary
      as="article"
      slug={job.slug}
      className="flex min-w-0 items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors duration-200 hover:border-[var(--brand-primary)] hover:shadow-md hover:shadow-emerald-600/5"
    >
      <div className="min-w-0 flex-1">
        <div className="company-job-card__headline">
          <h3 className="min-w-0 font-semibold leading-snug text-slate-950 line-clamp-2">
            <Link
              to={jobDetailPath(job)}
              className="!text-slate-950 no-underline transition-colors hover:!text-slate-950 hover:underline underline-offset-2"
            >
              {job.title}
            </Link>
          </h3>
          <span className="shrink-0 text-sm font-semibold text-[var(--brand-primary)]">{formatSalary(job)}</span>
        </div>
        <JobPresentationLabels job={job} compact className="mt-1.5" />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {locationLabel && <Chip>{locationLabel}</Chip>}
          {experience && <Chip>{experience}</Chip>}
          {posted && <span className="text-xs text-gray-400">{posted}</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={toggleSave}
        disabled={savePending}
        aria-label={saved ? `Bỏ lưu việc làm ${job.title}` : `Lưu việc làm ${job.title}`}
        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-200 text-sm transition hover:border-[var(--brand-primary)] hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saved
          ? <HeartFilled className="!text-[var(--brand-primary)]" />
          : <HeartOutlined className="!text-gray-400" />}
      </button>
    </JobImpressionBoundary>
  )
}
