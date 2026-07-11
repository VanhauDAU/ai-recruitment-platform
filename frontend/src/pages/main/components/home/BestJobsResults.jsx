import { HeartFilled, HeartOutlined } from '@ant-design/icons'
import { Skeleton } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  formatLocations,
  formatSalary,
  stripCompanyPrefix,
} from '../../../../constants/jobOptions'
import { jobDetailPath } from '../../../../config/jobPaths'
import { BEST_JOBS_LOGO_TINTS, BEST_JOBS_PAGE_SIZE, BEST_JOBS_PREVIEW_DELAY_MS } from './bestJobsConfig'
import JobPreviewPanel from './JobPreviewPanel'

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: BEST_JOBS_PAGE_SIZE }).map((_, index) => (
        <div key={index} className="rounded-lg border border-gray-200 p-3">
          <Skeleton avatar active paragraph={{ rows: 2 }} />
        </div>
      ))}
    </div>
  )
}

export default function BestJobsResults({ animKey, jobs, loading }) {
  const navigate = useNavigate()
  const [saved, setSaved] = useState(() => new Set())
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
    setSaved((current) => {
      const next = new Set(current)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
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
    <div key={animKey} className="grid animate-fade-slide grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => {
        const company = stripCompanyPrefix(job.company_name)
        const [logoBackground, logoColor] = BEST_JOBS_LOGO_TINTS[
          company.length % BEST_JOBS_LOGO_TINTS.length
        ]
        const locationLabel = formatLocations(job)
        return (
          <div key={job.public_id} className="relative" onMouseLeave={() => closePreview(160)}>
            <a
              href={jobDetailPath(job)}
              target="_blank"
              rel="noreferrer"
              className="group relative flex gap-3 rounded-lg border border-gray-200 p-3 transition hover:border-[var(--brand-primary)] hover:shadow-md"
            >
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-gray-100 text-lg font-bold"
                style={{ background: logoBackground, color: logoColor }}
              >
                {job.company_logo_url ? (
                  <img
                    src={job.company_logo_url}
                    alt={job.company_name}
                    className="h-full w-full rounded-md bg-white object-contain p-1"
                    loading="lazy"
                  />
                ) : company.charAt(0) || '?'}
              </div>
              <div className="min-w-0 flex-1 pr-5">
                <h3
                  onMouseEnter={(event) => showPreview(job.public_id, event.currentTarget.getBoundingClientRect())}
                  onMouseLeave={() => clearTimeout(previewTimer.current)}
                  className="line-clamp-2 cursor-pointer text-sm font-semibold leading-snug text-gray-800 group-hover:text-[var(--brand-primary)]"
                >
                  {job.title}
                </h3>
                <p className="mt-1 truncate text-xs text-gray-500">{job.company_name}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{formatSalary(job)}</span>
                  {locationLabel && (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{locationLabel}</span>
                  )}
                </div>
              </div>
              <button
                onClick={(event) => toggleSave(event, job.public_id)}
                className="absolute right-3 top-3 cursor-pointer text-gray-300 hover:text-[var(--brand-primary)]"
                aria-label="Lưu việc làm"
              >
                {saved.has(job.public_id)
                  ? <HeartFilled className="text-[var(--brand-primary)]" />
                  : <HeartOutlined />}
              </button>
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
