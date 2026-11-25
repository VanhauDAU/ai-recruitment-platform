import { HeartFilled, HeartOutlined } from '@ant-design/icons'
import { Skeleton, Tooltip } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  formatLocations,
  formatSalary,
  JOB_LOGO_TINTS,
  jobDetailPath,
  JobPreviewPanel,
  JobPresentationLabels,
  resolveJobPresentation,
  SavedJobTooltipContent,
  stripCompanyPrefix,
} from '@/entities/job/job'
import { useLoginPrompt } from '@/features/common/account/auth'
import { useSession } from '@/entities/account/session'
import { useSavedJobs } from '@/features/main/job/saved-jobs'
import { JobImpressionBoundary } from '@/features/main/job/track-job-engagement'
import { m } from '@/shared/config/i18n'
import { bestJobCardClass, isTopEmployerJob } from '../lib/best-job-card-presentation'
import { BEST_JOBS_PAGE_SIZE, BEST_JOBS_PREVIEW_DELAY_MS } from '../lib/best-jobs-config'

function LoadingGrid({ count }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border border-gray-100 bg-white p-4">
          <Skeleton avatar active paragraph={{ rows: 2 }} />
        </div>
      ))}
    </div>
  )
}

export default function BestJobsResults({ animKey, jobs, loading, pageSize = BEST_JOBS_PAGE_SIZE }) {
  const navigate = useNavigate()
  const { isAuthenticated } = useSession()
  const { promptLogin } = useLoginPrompt()
  // Dùng chung kho "việc làm đã lưu" với trang danh sách/nút nổi để trạng thái tim
  // và badge luôn khớp; trước đây trang chủ dùng state cục bộ nên bấm không lưu thật.
  const { savedIds, pendingJobIds, toggle } = useSavedJobs()
  const [preview, setPreview] = useState({ jobId: null, anchor: null })
  const previewTimer = useRef(null)
  const closeTimer = useRef(null)

  useEffect(() => () => {
    clearTimeout(previewTimer.current)
    clearTimeout(closeTimer.current)
  }, [])

  function toggleSave(event, jobId) {
    event.preventDefault()
    event.stopPropagation()
    if (!isAuthenticated) {
      promptLogin()
      return
    }
    toggle(jobId)
  }

  function showPreview(jobId, anchor) {
    clearTimeout(previewTimer.current)
    clearTimeout(closeTimer.current)
    setPreview((current) => ({ ...current, anchor }))
    previewTimer.current = setTimeout(
      () => setPreview({ jobId, anchor }),
      BEST_JOBS_PREVIEW_DELAY_MS,
    )
  }

  function closePreview(delay = 0) {
    clearTimeout(previewTimer.current)
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(
      () => setPreview((current) => ({ ...current, jobId: null })),
      delay,
    )
  }

  if (loading && jobs.length === 0) return <LoadingGrid count={pageSize} />
  if (jobs.length === 0) {
    return <p className="py-10 text-center text-gray-500">Không tìm thấy việc làm phù hợp với bộ lọc.</p>
  }

  return (
    <div key={animKey} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job, index) => {
        const company = stripCompanyPrefix(job.company_name)
        const [logoBackground, logoColor] = JOB_LOGO_TINTS[
          company.length % JOB_LOGO_TINTS.length
        ]
        const locationLabel = formatLocations(job)
        const isSaved = savedIds.has(job.public_id)
        const isTopEmployer = isTopEmployerJob(job)
        const hasLabels = isTopEmployer || Boolean(resolveJobPresentation(job).labels?.length)

        return (
          <JobImpressionBoundary
            key={job.public_id}
            slug={job.slug}
            className="relative h-full"
            onMouseLeave={() => closePreview(160)}
          >
            <a
              href={jobDetailPath(job)}
              target="_blank"
              rel="noreferrer"
              style={{ '--i': index }}
              className={`best-job-card group border ${bestJobCardClass(job)}`}
            >
              <div className="best-job-card__logo">
                {company.charAt(0) || '?'}
                {job.company_logo_url && (
                  <img
                    src={job.company_logo_url}
                    alt={job.company_name}
                    loading="lazy"
                    onError={(event) => { event.currentTarget.hidden = true }}
                  />
                )}
              </div>

              {/* Một cột cạnh logo: không chừa khoảng trống dưới logo, thẻ thấp hơn. */}
              <div className="flex min-w-0 flex-1 flex-col">
                {hasLabels && (
                  <div data-best-job-labels className="mb-0.5 flex flex-wrap items-center gap-1">
                    {isTopEmployer && (
                      <span
                        data-job-label="top-employer"
                        title="Nhà tuyển dụng có trang thương hiệu nổi bật"
                        className="inline-flex items-center rounded-full border border-[var(--brand-primary)]/20 bg-[var(--brand-primary-soft)] px-1.5 py-0.5 text-[10px] font-extrabold leading-none tracking-wide text-[var(--brand-primary-hover)]"
                      >
                        TOP
                      </span>
                    )}
                    <JobPresentationLabels job={job} compact />
                  </div>
                )}
                <h3
                  onMouseEnter={(event) =>
                    showPreview(job.public_id, event.currentTarget.getBoundingClientRect())
                  }
                  onMouseLeave={() => clearTimeout(previewTimer.current)}
                  className="best-job-card__title line-clamp-2"
                >
                  {job.title}
                </h3>
                <p className="best-job-card__company">{job.company_name}</p>

                <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="best-job-card__pill shrink-0">{formatSalary(job)}</span>
                    {locationLabel && <span className="best-job-card__pill min-w-0">{locationLabel}</span>}
                  </div>
                  <Tooltip title={isSaved ? <SavedJobTooltipContent /> : m.candidate_best_jobs_save()} placement="top">
                    <button
                      type="button"
                      onClick={(event) => toggleSave(event, job.public_id)}
                      disabled={pendingJobIds.has(job.public_id)}
                      aria-pressed={isSaved}
                      aria-label={isSaved ? m.candidate_best_jobs_saved() : m.candidate_best_jobs_save()}
                      className="best-job-card__save"
                    >
                      {isSaved ? <HeartFilled /> : <HeartOutlined />}
                    </button>
                  </Tooltip>
                </div>
              </div>
            </a>

            {preview.jobId === job.public_id && (
              <JobPreviewPanel
                job={job}
                company={company}
                logoBg={logoBackground}
                logoFg={logoColor}
                anchorRect={preview.anchor}
                onMouseEnter={() => clearTimeout(closeTimer.current)}
                onMouseLeave={() => closePreview()}
                onViewDetail={() => navigate(jobDetailPath(job))}
                onApply={() => navigate(jobDetailPath(job))}
              />
            )}
          </JobImpressionBoundary>
        )
      })}
    </div>
  )
}
