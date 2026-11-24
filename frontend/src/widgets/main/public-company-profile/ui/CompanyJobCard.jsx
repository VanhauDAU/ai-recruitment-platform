import { HeartFilled, HeartOutlined } from '@ant-design/icons'
import { Link } from 'react-router'
import { CompanyLogo } from '@/entities/company/company'
import {
  EXPERIENCE_YEARS_LABELS,
  formatJobPostedLabel,
  formatLocations,
  formatSalary,
  jobCardToneClass,
  jobDetailPath,
  JobPresentationLabels,
  VerifiedEmployerBadge,
} from '@/entities/job/job'
import { useSession } from '@/entities/account/session'
import { useLoginPrompt } from '@/features/common/account/auth'
import { useSavedJob } from '@/features/main/job/saved-jobs'
import { JobImpressionBoundary } from '@/features/main/job/track-job-engagement'
import { message } from '@/shared/lib/toast'

function Chip({ children }) {
  return <span className="company-job-card__chip">{children}</span>
}

/**
 * Thẻ tin trong trang công ty, cùng bố cục với thẻ ở danh sách việc làm (logo,
 * tên công ty, nền theo gói hiển thị). `pinned` gắn nhãn "Nổi bật" cho tin ghim.
 */
export default function CompanyJobCard({ job, pinned = false }) {
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
      className={`company-job-card ${jobCardToneClass(job)}`}
    >
      <CompanyLogo
        company={{ trade_name: job.company_name, logo_url: job.company_logo_url }}
        width={96}
        height={96}
        className="company-job-card__logo"
        imageClassName="p-1"
      />
      <div className="company-job-card__body">
        <div className="company-job-card__headline">
          <h3 className="min-w-0 font-semibold leading-snug text-slate-950 line-clamp-2">
            {pinned && <span className="company-job-card__pin">Nổi bật</span>}
            <Link
              to={jobDetailPath(job)}
              className="!text-slate-950 no-underline transition-colors hover:!text-slate-950 hover:underline underline-offset-2"
            >
              {job.title}
            </Link>
            <VerifiedEmployerBadge verified={job.company_verified} className="ml-1.5" />
          </h3>
          <span className="company-job-card__salary">{formatSalary(job)}</span>
        </div>
        <JobPresentationLabels job={job} compact className="mt-1.5" />
        {job.company_name && <p className="company-job-card__company">{job.company_name}</p>}
        <div className="company-job-card__footer">
          <div className="company-job-card__chips">
            {locationLabel && <Chip>{locationLabel}</Chip>}
            {experience && <Chip>{experience}</Chip>}
          </div>
          <div className="company-job-card__actions">
            {posted && <span className="company-job-card__posted">{posted}</span>}
            <button
              type="button"
              onClick={toggleSave}
              disabled={savePending}
              aria-label={saved ? `Bỏ lưu việc làm ${job.title}` : `Lưu việc làm ${job.title}`}
              className="company-job-card__save"
            >
              {saved
                ? <HeartFilled className="!text-[var(--brand-primary)]" />
                : <HeartOutlined className="!text-gray-400" />}
            </button>
          </div>
        </div>
      </div>
    </JobImpressionBoundary>
  )
}
