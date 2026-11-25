import { Link } from 'react-router'
import { companyInitial, formatSalary, jobDetailPath, JobPresentationLabels } from '@/entities/job/job'
import { getIntlLocale, m } from '@/shared/config/i18n'
import { formatDistance } from '@/shared/lib/geo'
import { shortPlaceName } from '../../lib/nearby-params'

function deadlineLabel(value) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return m.candidate_nearby_deadline({
    date: date.toLocaleDateString(getIntlLocale(), { day: '2-digit', month: '2-digit' }),
  })
}

function workplaceLabel(job) {
  const workplace = job.nearest_workplace
  if (!workplace) return (job.locations_detail || []).map((item) => shortPlaceName(item.name)).join(', ')
  // "Số 1, Phường X, Thành phố Y" -> giữ phường/xã + tỉnh cho gọn như danh sách mẫu.
  return workplace.display.split(', ').slice(-2).join(', ')
}

function DistanceBadge({ job }) {
  let text = formatDistance(job.distance_km, getIntlLocale())
  if (job.match_kind === 'province_wide') text = m.candidate_nearby_badge_province()
  if (job.match_kind === 'remote') text = m.candidate_nearby_badge_remote()
  return <span className={`nearby-card__distance nearby-card__distance--${job.match_kind}`}>{text}</span>
}

export default function NearbyJobCard({ job, active, onHover }) {
  const extra = Math.max(0, (job.nearby_workplace_count || 0) - 1)
  const approx = job.nearest_workplace?.precision === 'ward'
  return (
    <article
      className={`nearby-card${active ? ' nearby-card--active' : ''}`}
      onMouseEnter={() => onHover?.(job.slug)}
      onMouseLeave={() => onHover?.(null)}
      data-job-slug={job.slug}
    >
      <div className="nearby-card__logo">
        {job.company_logo_url
          ? <img src={job.company_logo_url} alt={job.company_name} loading="lazy" />
          : <span>{companyInitial(job.company_name)}</span>}
      </div>
      <div className="nearby-card__body">
        <h3 className="nearby-card__title">
          <Link to={jobDetailPath(job)}>{job.title}</Link>
        </h3>
        <JobPresentationLabels job={job} compact />
        <p className="nearby-card__company">{job.company_name}</p>
        <p className="nearby-card__meta">
          <span className="nearby-card__salary">{formatSalary(job)}</span>
          <span title={approx ? m.candidate_nearby_approx() : undefined}>{workplaceLabel(job)}</span>
          {extra > 0 && <span>{m.candidate_nearby_more_workplaces({ count: extra })}</span>}
          {job.deadline && <span>{deadlineLabel(job.deadline)}</span>}
        </p>
      </div>
      <DistanceBadge job={job} />
    </article>
  )
}
