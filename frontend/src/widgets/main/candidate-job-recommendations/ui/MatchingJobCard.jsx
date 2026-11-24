import { DeleteOutlined, HeartFilled, HeartOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import { Link } from 'react-router'
import {
  formatJobPostedLabel,
  formatSalary,
  jobCardToneClass,
  jobDetailPath,
  JobPresentationLabels,
  VerifiedEmployerBadge,
} from '@/entities/job/job'
import { useSavedJob } from '@/features/main/job/saved-jobs'
import { JobImpressionBoundary } from '@/features/main/job/track-job-engagement'
import { m } from '@/shared/config/i18n'
import { recommendationReasons } from '../model/recommendation-reasons'

const ICON_BUTTON = 'grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition disabled:cursor-wait disabled:opacity-50'

function placesLabel(job) {
  const places = job.locations_detail || []
  if (places.length < 2) return places[0]?.name || ''
  return m.candidate_reco_more_places({ first: places[0].name, count: places.length - 1 })
}

// Một tin trên trang "Việc làm phù hợp": logo, tên, lương, nơi làm, lý do gợi ý và các thao tác.
export default function MatchingJobCard({ hidePending, job, onHide }) {
  const [saved, toggleSaved, savePending] = useSavedJob(job.public_id, job)
  const detailPath = jobDetailPath(job)
  const reasons = recommendationReasons(job)
  const places = placesLabel(job)
  const posted = formatJobPostedLabel(job)
  const saveLabel = saved ? m.candidate_reco_unsave() : m.candidate_reco_save()

  return (
    <JobImpressionBoundary slug={job.slug}>
      <article className={`group rounded-2xl border border-slate-200 p-3 shadow-sm transition hover:border-[var(--brand-primary)] hover:shadow-[0_12px_30px_color-mix(in_srgb,var(--brand-primary)_12%,transparent)] sm:p-4 ${jobCardToneClass(job)}`}>
        <div className="flex gap-3 sm:gap-4">
          <Link
            to={detailPath}
            aria-label={m.candidate_reco_logo_label({ title: job.title })}
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 !bg-white sm:h-24 sm:w-24"
          >
            {job.company_logo_url ? (
              <img src={job.company_logo_url} alt="" className="h-full w-full object-contain p-2" loading="lazy" />
            ) : (
              <span className="text-xl font-black text-[var(--brand-primary)]">{job.company_name?.charAt(0) || 'P'}</span>
            )}
          </Link>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <Link to={detailPath} className="line-clamp-2 text-base font-bold leading-6 !text-slate-900 transition group-hover:!text-[var(--brand-primary)] sm:text-lg">
                {job.title}
              </Link>
              <span className="shrink-0 text-sm font-bold text-[var(--brand-primary)] sm:text-base">{formatSalary(job)}</span>
            </div>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {job.company_name}
              <VerifiedEmployerBadge verified={job.company_verified} className="ml-1" />
            </p>
            <JobPresentationLabels job={job} compact className="mt-1.5" />

            <div className="mt-auto flex flex-col gap-2 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:flex-1">
                {places && <span className="max-w-full truncate rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-700">{places}</span>}
                {reasons.length > 0 && (
                  <Tooltip
                    trigger={['hover', 'click']}
                    title={(
                      <ul className="list-disc space-y-0.5 py-0.5 pl-4 text-xs leading-5">
                        {reasons.map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                    )}
                  >
                    <button type="button" className="inline-flex cursor-pointer items-center gap-1 font-semibold text-[var(--brand-primary)] underline underline-offset-2">
                      <InfoCircleOutlined /> {m.candidate_reco_why()}
                    </button>
                  </Tooltip>
                )}
                {posted && <span className="text-slate-400">{posted}</span>}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  to={`${detailPath}?ung-tuyen=1`}
                  className="rounded-full !bg-[var(--brand-primary)] px-5 py-2 text-sm font-bold !text-white transition hover:!bg-[var(--brand-primary-hover)]"
                >
                  {m.candidate_reco_apply()}
                </Link>
                <Tooltip title={m.candidate_reco_hide()}>
                  <button
                    type="button"
                    aria-label={m.candidate_reco_hide()}
                    disabled={hidePending}
                    onClick={() => onHide(job)}
                    className={`${ICON_BUTTON} hover:border-red-200 hover:bg-red-50 hover:text-red-500`}
                  >
                    <DeleteOutlined />
                  </button>
                </Tooltip>
                <Tooltip title={saveLabel}>
                  <button
                    type="button"
                    aria-label={saveLabel}
                    disabled={savePending}
                    onClick={toggleSaved}
                    className={`${ICON_BUTTON} hover:border-[var(--brand-primary)]/40 hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-primary)]`}
                  >
                    {saved ? <HeartFilled className="text-[var(--brand-primary)]" /> : <HeartOutlined />}
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </article>
    </JobImpressionBoundary>
  )
}
