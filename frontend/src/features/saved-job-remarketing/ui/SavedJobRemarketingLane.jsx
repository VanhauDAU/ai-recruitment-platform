import { ArrowRightOutlined, HistoryOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import {
  formatLocations,
  formatSalary,
  getSavedJobRemarketingLane,
  jobCardToneClass,
  jobDetailPath,
  JobPresentationLabels,
  recordSavedJobRemarketingImpression,
} from '@/entities/job'
import { useConsent } from '@/entities/consent'
import { useSession } from '@/entities/session'

function RemarketingCard({ job }) {
  const cardRef = useRef(null)
  const recordedRef = useRef(false)

  useEffect(() => {
    const node = cardRef.current
    if (!node || recordedRef.current || !globalThis.IntersectionObserver) return undefined
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return
      recordedRef.current = true
      observer.disconnect()
      recordSavedJobRemarketingImpression({
        job_public_id: job.public_id,
        activation_public_id: job.remarketing_activation_public_id,
      }).catch(() => {})
    }, { threshold: 0.5 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [job.public_id, job.remarketing_activation_public_id])

  return (
    <article ref={cardRef} className={`flex h-full min-w-0 flex-col rounded-2xl border p-4 shadow-sm ${jobCardToneClass(job)}`}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white text-sm font-bold text-emerald-700">
          {job.company_logo_url ? (
            <img className="h-full w-full object-contain p-1" src={job.company_logo_url} alt="" loading="lazy" />
          ) : job.company_name?.charAt(0) || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <Link className="line-clamp-2 font-bold leading-6 text-slate-900 hover:text-[var(--brand-primary)]" to={jobDetailPath(job)}>
            {job.title}
          </Link>
          <p className="mt-1 truncate text-sm text-slate-500">{job.company_name}</p>
          <JobPresentationLabels job={job} compact className="mt-2" />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
        <span className="rounded-full bg-white/80 px-2.5 py-1">{formatSalary(job)}</span>
        {formatLocations(job) && <span className="max-w-full truncate rounded-full bg-white/80 px-2.5 py-1">{formatLocations(job)}</span>}
      </div>
      <p className="mt-4 flex items-center gap-2 border-t border-slate-200/70 pt-3 text-xs text-slate-500">
        <HistoryOutlined aria-hidden /> {job.display_reason}
      </p>
    </article>
  )
}

export default function SavedJobRemarketingLane() {
  const { isAuthenticated, user } = useSession()
  const { consent, status: consentStatus } = useConsent()
  const enabled = Boolean(
    isAuthenticated
    && user?.role === 'candidate'
    && consentStatus === 'ready'
    && consent?.marketing,
  )
  const query = useQuery({
    queryKey: ['jobs', 'saved-remarketing'],
    queryFn: getSavedJobRemarketingLane,
    enabled,
    staleTime: 60 * 1000,
    retry: false,
  })
  const jobs = query.data?.status === 'ready' ? query.data.results || [] : []

  if (!enabled || !jobs.length) return null
  return (
    <section aria-labelledby="saved-remarketing-title" className="max-w-6xl mx-auto px-4 pt-8">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-600">Dành riêng cho bạn</p>
          <h2 id="saved-remarketing-title" className="mt-1 text-xl font-extrabold text-slate-950 sm:text-2xl">Việc bạn đã quan tâm</h2>
          <p className="mt-1 text-sm text-slate-500">Các tin bạn đã lưu và vẫn còn nhận hồ sơ.</p>
        </div>
        <Link to="/viec-lam-da-luu" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
          Xem việc đã lưu <ArrowRightOutlined aria-hidden />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => <RemarketingCard key={job.public_id} job={job} />)}
      </div>
    </section>
  )
}
