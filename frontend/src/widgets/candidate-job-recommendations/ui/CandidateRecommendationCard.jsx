import {
  ArrowRightOutlined,
  CheckCircleFilled,
  DeleteOutlined,
  EnvironmentOutlined,
  HeartFilled,
  HeartOutlined,
} from '@ant-design/icons'
import { Tooltip } from 'antd'
import { Link } from 'react-router'
import {
  formatLocations,
  formatSalary,
  jobCardToneClass,
  jobDetailPath,
  JobPresentationLabels,
  VerifiedEmployerBadge,
} from '@/entities/job'
import { useSavedJob } from '@/features/saved-jobs'
import { JobImpressionBoundary } from '@/features/track-job-engagement'
import { recommendationReasons } from '../model/recommendation-reasons'

export default function CandidateRecommendationCard({ compact = false, hidePending, job, onHide }) {
  const [saved, toggleSaved, savePending] = useSavedJob(job.public_id, job)
  const detailPath = jobDetailPath(job)
  const reasons = recommendationReasons(job)

  function handleSaved(event) {
    event.preventDefault()
    toggleSaved()
  }

  function handleHide(event) {
    event.preventDefault()
    onHide(job)
  }

  return (
    <JobImpressionBoundary slug={job.slug} className="h-full">
      <article className={`group flex h-full min-w-0 flex-col rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_12px_30px_rgba(16,185,129,0.1)] ${jobCardToneClass(job)}`}>
        <div className="flex min-w-0 gap-3 sm:gap-4">
          <Link
            to={detailPath}
            aria-label={`Xem chi tiết ${job.title} qua logo công ty`}
            className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white ${compact ? 'h-14 w-14' : 'h-16 w-16 sm:h-20 sm:w-20'}`}
          >
            {job.company_logo_url ? (
              <img src={job.company_logo_url} alt="" className="h-full w-full object-contain p-2" loading="lazy" />
            ) : (
              <span className="text-xl font-black text-[var(--brand-primary)]">
                {job.company_name?.charAt(0) || 'P'}
              </span>
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  to={detailPath}
                  className={`line-clamp-2 text-sm font-bold leading-5 transition sm:text-base sm:leading-6 ${compact ? '!text-black hover:!text-black focus-visible:!text-black' : 'text-slate-900 group-hover:text-[var(--brand-primary)]'}`}
                >
                  {job.title}
                </Link>
                <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm">
                  {job.company_name}
                  <VerifiedEmployerBadge verified={job.company_verified} className="ml-1" />
                </p>
                <JobPresentationLabels job={job} compact className="mt-1.5" />
              </div>
              <div className="flex shrink-0 gap-1">
                <Tooltip title={saved ? 'Bỏ lưu việc làm' : 'Lưu việc làm'}>
                  <button
                    type="button"
                    aria-label={saved ? 'Bỏ lưu việc làm' : 'Lưu việc làm'}
                    disabled={savePending}
                    onClick={handleSaved}
                    className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-slate-200 text-sm text-slate-400 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-[var(--brand-primary)] disabled:cursor-wait disabled:opacity-50"
                  >
                    {saved ? <HeartFilled className="text-[var(--brand-primary)]" /> : <HeartOutlined />}
                  </button>
                </Tooltip>
                <Tooltip title="Ẩn tin tuyển dụng này">
                  <button
                    type="button"
                    aria-label="Ẩn tin tuyển dụng này"
                    disabled={hidePending}
                    onClick={handleHide}
                    className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-slate-200 text-sm text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:cursor-wait disabled:opacity-50"
                  >
                    <DeleteOutlined />
                  </button>
                </Tooltip>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
              <span className="rounded-lg bg-white/80 px-2.5 py-1">{formatSalary(job)}</span>
              {formatLocations(job) && (
                <span className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-white/80 px-2.5 py-1">
                  <EnvironmentOutlined />
                  <span className="truncate">{formatLocations(job)}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-auto pt-4">
          {reasons.length > 0 && (
            <div className="mb-3 space-y-1.5 border-t border-slate-100 pt-3">
              {reasons.map((reason) => (
                <p key={reason} className="flex items-start gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircleFilled className="mt-0.5 shrink-0" />
                  <span>{reason}</span>
                </p>
              ))}
            </div>
          )}
          {!compact && (
            <div className={`flex justify-end ${reasons.length ? '' : 'border-t border-slate-100 pt-3'}`}>
              <Link
                to={detailPath}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-primary)] px-4 py-2 text-xs font-bold text-white transition hover:bg-[var(--brand-primary-hover)]"
              >
                Xem việc làm <ArrowRightOutlined />
              </Link>
            </div>
          )}
        </div>
      </article>
    </JobImpressionBoundary>
  )
}
