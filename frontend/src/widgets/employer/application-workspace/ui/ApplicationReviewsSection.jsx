import { TeamOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Rate, Skeleton } from 'antd'
import { applicationKeys, getApplicationReviews, REVIEW_RECOMMENDATIONS } from '@/entities/application/application'
import { formatDateTime } from '@/shared/lib/date-time'
import { m } from '@/shared/config/i18n'

const LABELS = Object.fromEntries(REVIEW_RECOMMENDATIONS.map((item) => [item.value, item]))

/** Scorecards from invited reviewers; hidden until someone has answered. */
export default function ApplicationReviewsSection({ publicId }) {
  const query = useQuery({
    queryKey: applicationKeys.reviews(publicId),
    queryFn: () => getApplicationReviews(publicId),
  })
  if (query.isPending) return <section className="aw-section"><Skeleton active paragraph={{ rows: 2 }} /></section>
  const summary = query.data?.summary
  if (!summary?.total) return null

  return (
    <section className="aw-section" aria-label={m.employer_workspace_app_reviews_from_others()}>
      <h3 className="aw-section__title">
        <TeamOutlined className="text-emerald-600" aria-hidden /> {m.employer_workspace_app_reviews_from_others()}
        <span className="aw-count">{summary.total}</span>
      </h3>
      <div className="aw-review-summary">
        {REVIEW_RECOMMENDATIONS.map((item) => (
          <span key={item.value} className={`aw-badge aw-tone-${item.tone}`}>
            {item.label}: {summary.by_recommendation[item.value] || 0}
          </span>
        ))}
        {summary.average_rating && <span className="text-xs text-slate-500">{m.employer_workspace_app_average_score({ score: summary.average_rating })}</span>}
      </div>
      <ul className="mt-3 space-y-2">
        {query.data.results.map((review) => (
          <li key={`${review.reviewer_name}-${review.submitted_at}`} className="rounded-xl bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <strong className="truncate text-xs text-slate-800">{review.reviewer_name}</strong>
              <span className={`aw-badge aw-tone-${LABELS[review.recommendation]?.tone || 'slate'}`}>{review.recommendation_label}</span>
            </div>
            {review.rating && <Rate disabled value={review.rating} className="!text-xs" />}
            {review.strengths && <p className="mt-1 text-[11px] leading-5 text-slate-600"><strong>{m.employer_workspace_app_strengths()}</strong> {review.strengths}</p>}
            {review.concerns && <p className="mt-1 text-[11px] leading-5 text-slate-600"><strong>{m.employer_workspace_app_concerns()}</strong> {review.concerns}</p>}
            <p className="mt-1 text-[10px] text-slate-400">{formatDateTime(review.updated_at)}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
