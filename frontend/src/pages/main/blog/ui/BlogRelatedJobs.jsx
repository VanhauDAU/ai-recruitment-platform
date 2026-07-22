import { useEffect, useRef, useState } from 'react'
import { EnvironmentOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { companyInitial, formatLocations, formatSalary, getJobs, JOB_LOGO_TINTS, jobDetailPath, JobPreviewPanel, stripCompanyPrefix } from '@/entities/job'
import { JobImpressionBoundary } from '@/features/track-job-engagement'

// Khối "Danh sách việc làm ..." trong bài, lấy theo danh mục nghề liên quan.
export default function BlogRelatedJobs({ jobCategory }) {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [preview, setPreview] = useState({ job: null, anchor: null })
  const previewTimer = useRef(null)
  const closeTimer = useRef(null)

  useEffect(() => {
    if (!jobCategory?.id) return undefined
    let cancelled = false
    getJobs({ category: jobCategory.id, page_size: 20, view: 'preview' })
      .then((data) => {
        if (cancelled) return
        setJobs(Array.isArray(data) ? data : data.results || [])
      })
      .catch(() => { if (!cancelled) setJobs([]) })
    return () => { cancelled = true }
  }, [jobCategory?.id])

  useEffect(() => () => {
    clearTimeout(previewTimer.current)
    clearTimeout(closeTimer.current)
  }, [])

  function openPreview(job, anchor) {
    clearTimeout(previewTimer.current)
    clearTimeout(closeTimer.current)
    previewTimer.current = setTimeout(() => setPreview({ job, anchor }), 180)
  }

  function closePreview(delay = 0) {
    clearTimeout(previewTimer.current)
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setPreview({ job: null, anchor: null }), delay)
  }

  if (!jobCategory?.id || jobs.length === 0) return null

  return (
    <section className="my-6 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
      <h2 className="mb-3 text-lg font-bold text-slate-800">
        Việc làm {jobCategory.name}
      </h2>
      <p className="mb-3 text-xs text-slate-500">Di chuột vào một việc làm để xem nhanh thông tin chi tiết.</p>
      <ul className="max-h-[26rem] space-y-2 overflow-y-scroll pr-2 [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-300 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-emerald-50 sm:max-h-[30rem]">
        {jobs.map((job) => (
          <JobImpressionBoundary
            as="li"
            key={job.public_id}
            slug={job.slug}
            className="relative"
            onMouseEnter={(event) => openPreview(job, event.currentTarget.getBoundingClientRect())}
            onMouseLeave={() => closePreview(180)}
          >
            <Link
              to={jobDetailPath(job)}
              target="_blank"
              rel="noopener"
              className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand-primary)] hover:shadow-md"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50 text-sm font-bold text-slate-500">
                {job.company_logo_url ? (
                  <img src={job.company_logo_url} alt="" className="h-full w-full object-contain" />
                ) : companyInitial(job.company_name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block line-clamp-2 text-sm font-semibold leading-5 text-slate-800 transition group-hover:text-[var(--brand-primary)]">{job.title}</span>
                <span className="block truncate text-xs text-slate-500">{job.company_name}</span>
              </span>
              <span className="hidden shrink-0 text-right text-xs sm:block">
                <span className="block font-semibold text-[var(--brand-primary)]">{formatSalary(job)}</span>
                <span className="block text-slate-400">
                  <EnvironmentOutlined /> {formatLocations(job) || '—'}
                </span>
              </span>
            </Link>
          </JobImpressionBoundary>
        ))}
      </ul>
      {preview.job && (
        <RelatedJobPreview
          job={preview.job}
          anchor={preview.anchor}
          onEnter={() => clearTimeout(closeTimer.current)}
          onLeave={() => closePreview()}
          onViewDetail={() => navigate(jobDetailPath(preview.job))}
        />
      )}
      <Link
        to={`/viec-lam?category=${jobCategory.id}`}
        target="_blank"
        rel="noopener"
        className="mt-3 block w-full rounded-lg border border-[var(--brand-primary)] py-2 text-center text-sm font-semibold text-[var(--brand-primary)] transition-colors duration-200 hover:bg-[var(--brand-primary-soft)]"
      >
        Xem tất cả việc làm {jobCategory.name}
      </Link>
    </section>
  )
}

function RelatedJobPreview({ job, anchor, onEnter, onLeave, onViewDetail }) {
  const company = stripCompanyPrefix(job.company_name)
  const [logoBg, logoFg] = JOB_LOGO_TINTS[company.length % JOB_LOGO_TINTS.length]
  return (
    <JobPreviewPanel
      job={job}
      company={company}
      logoBg={logoBg}
      logoFg={logoFg}
      anchorRect={anchor}
      side="right"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onViewDetail={onViewDetail}
      onApply={onViewDetail}
    />
  )
}
