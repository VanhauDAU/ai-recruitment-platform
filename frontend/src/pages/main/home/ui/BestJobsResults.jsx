import { HeartFilled, HeartOutlined } from '@ant-design/icons'
import { Skeleton, Tooltip } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  formatLocations,
  formatSalary,
  JOB_LOGO_TINTS,
  jobDetailPath,
  JobPreviewPanel,
  SavedJobTooltipContent,
  stripCompanyPrefix,
} from '@/entities/job'
import { useLoginPrompt } from '@/features/auth'
import { useSession } from '@/entities/session'
import { useSavedJobs } from '@/features/saved-jobs'
import { BEST_JOBS_PAGE_SIZE, BEST_JOBS_PREVIEW_DELAY_MS } from '../lib/best-jobs-config'

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: BEST_JOBS_PAGE_SIZE }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <Skeleton avatar active paragraph={{ rows: 2 }} />
        </div>
      ))}
    </div>
  )
}

export default function BestJobsResults({ animKey, jobs, loading }) {
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

  if (loading && jobs.length === 0) return <LoadingGrid />
  if (jobs.length === 0) {
    return <p className="py-10 text-center text-gray-500">Không tìm thấy việc làm phù hợp với bộ lọc.</p>
  }

  return (
    <div
      key={animKey}
      className="grid animate-fade-slide grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      style={{ alignItems: 'stretch' }}
    >
      {jobs.map((job) => {
        const company = stripCompanyPrefix(job.company_name)
        const [logoBackground, logoColor] = JOB_LOGO_TINTS[
          company.length % JOB_LOGO_TINTS.length
        ]
        const locationLabel = formatLocations(job)
        const salaryLabel = formatSalary(job)
        const isSaved = savedIds.has(job.public_id)
        const isPending = pendingJobIds.has(job.public_id)

        return (
          <div
            key={job.public_id}
            className="relative h-full"
            onMouseLeave={() => closePreview(160)}
          >
            <a
              href={jobDetailPath(job)}
              target="_blank"
              rel="noreferrer"
              className="group relative flex h-full flex-col !bg-white rounded-2xl border border-gray-100 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand-primary)] hover:shadow-lg"
            >
              {/* Row 1: Logo + tiêu đề/công ty cùng hàng */}
              <div className="flex min-w-0 items-start gap-3">
                {/* Logo */}
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-100 text-base font-bold shadow-sm"
                  style={{ background: logoBackground, color: logoColor }}
                >
                  {job.company_logo_url ? (
                    <img
                      src={job.company_logo_url}
                      alt={job.company_name}
                      className="h-full w-full rounded-xl bg-white object-contain p-1"
                      loading="lazy"
                    />
                  ) : (
                    company.charAt(0) || '?'
                  )}
                </div>

                {/* Tiêu đề + tên công ty — chiếm hết chỗ trống */}
                <div className="min-w-0 flex-1">
                  <h3
                    onMouseEnter={(event) =>
                      showPreview(job.public_id, event.currentTarget.getBoundingClientRect())
                    }
                    onMouseLeave={() => clearTimeout(previewTimer.current)}
                    className="line-clamp-2 cursor-pointer text-sm font-semibold leading-snug text-gray-800 transition-colors group-hover:text-[var(--brand-primary)]"
                  >
                    {job.title}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{job.company_name}</p>
                </div>
              </div>

              {/* Row 2: Badges + Heart cùng 1 hàng ở dưới */}
              <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  {/* Lương */}
                  <span className="inline-flex shrink-0 items-center rounded-full bg-[#EDEFF0] px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    {salaryLabel}
                  </span>
                  {/* Địa điểm */}
                  {locationLabel && (
                    <span className="inline-flex min-w-0 items-center rounded-full bg-[#EDEFF0] px-2.5 py-0.5 text-xs font-medium text-gray-700">
                      <span className="truncate">{locationLabel}</span>
                    </span>
                  )}
                </div>

                {/* Nút lưu việc */}
                <Tooltip
                  title={isSaved ? <SavedJobTooltipContent /> : 'Lưu việc làm'}
                  placement="top"
                >
                  <button
                    onClick={(event) => toggleSave(event, job.public_id)}
                    disabled={isPending}
                    aria-label={isSaved ? 'Đã lưu việc làm' : 'Lưu việc làm'}
                    className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-400 transition-all duration-150 hover:border-pink-200 hover:bg-pink-50 hover:text-pink-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaved ? (
                      <HeartFilled style={{ fontSize: 13, color: 'var(--brand-primary)' }} />
                    ) : (
                      <HeartOutlined style={{ fontSize: 13 }} />
                    )}
                  </button>
                </Tooltip>
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
          </div>
        )
      })}
    </div>
  )
}
