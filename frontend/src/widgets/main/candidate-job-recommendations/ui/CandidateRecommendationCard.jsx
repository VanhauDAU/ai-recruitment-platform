import { CheckCircleFilled, EnvironmentOutlined, EyeInvisibleOutlined, HeartFilled, HeartOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import { Link } from 'react-router'
import {
  formatLocations,
  formatSalary,
  jobDetailPath,
  JobPresentationLabels,
  VerifiedEmployerBadge,
} from '@/entities/job/job'
import { useSavedJob } from '@/features/main/job/saved-jobs'
import { JobImpressionBoundary } from '@/features/main/job/track-job-engagement'
import { m } from '@/shared/config/i18n'
import { recommendationReasons } from '../model/recommendation-reasons'
import './home-recommendations.css'

// Thẻ gọn của khối gợi ý ở trang chủ; trang "Việc làm phù hợp" dùng MatchingJobCard.
export default function CandidateRecommendationCard({ hidePending, job, onHide }) {
  const [saved, toggleSaved, savePending] = useSavedJob(job.public_id, job)
  const detailPath = jobDetailPath(job)
  const reasons = recommendationReasons(job)
  const location = formatLocations(job)
  const saveLabel = saved ? m.candidate_reco_unsave() : m.candidate_reco_save()

  return (
    <JobImpressionBoundary slug={job.slug} className="h-full">
      <article className="reco-card border-slate-200 bg-white">
        <div className="flex min-w-0 gap-2.5">
          <Link to={detailPath} aria-label={m.candidate_reco_home_logo_link({ title: job.title })} className="reco-card__logo">
            {job.company_logo_url ? (
              <img src={job.company_logo_url} alt="" loading="lazy" />
            ) : (
              job.company_name?.charAt(0) || 'P'
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <Link to={detailPath} className="reco-card__title">{job.title}</Link>
            <p className="reco-card__company">
              <span className="truncate">{job.company_name}</span>
              <VerifiedEmployerBadge verified={job.company_verified} />
            </p>
          </div>

          <div className="reco-card__actions">
            <Tooltip title={saveLabel}>
              <button
                type="button"
                aria-label={saveLabel}
                aria-pressed={saved}
                disabled={savePending}
                onClick={() => toggleSaved()}
                className="reco-card__action"
              >
                {saved ? <HeartFilled /> : <HeartOutlined />}
              </button>
            </Tooltip>
            <Tooltip title={m.candidate_reco_hide()}>
              <button
                type="button"
                aria-label={m.candidate_reco_hide()}
                disabled={hidePending}
                onClick={() => onHide(job)}
                className="reco-card__action reco-card__action--hide"
              >
                <EyeInvisibleOutlined />
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="reco-card__pill reco-card__pill--salary">{formatSalary(job)}</span>
          {location && (
            <span className="reco-card__pill">
              <EnvironmentOutlined />
              <span className="truncate">{location}</span>
            </span>
          )}
          <JobPresentationLabels job={job} compact />
        </div>

        {reasons.length > 0 && (
          <ul className="reco-card__reasons" aria-label={m.candidate_reco_home_reasons()}>
            {reasons.map((reason) => (
              <li key={reason}>
                <CheckCircleFilled />
                {reason}
              </li>
            ))}
          </ul>
        )}
      </article>
    </JobImpressionBoundary>
  )
}
