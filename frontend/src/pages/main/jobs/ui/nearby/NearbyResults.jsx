import { Fragment } from 'react'
import { EnvironmentOutlined } from '@ant-design/icons'
import { Button, Pagination, Skeleton } from 'antd'
import { m } from '@/shared/config/i18n'
import { PAGE_SIZE } from '../../lib/job-list-params'
import { shortPlaceName } from '../../lib/nearby-params'
import NearbyJobCard from './NearbyJobCard'

function groupHeading(kind, provinceName) {
  if (kind === 'province_wide') return m.candidate_nearby_group_province({ province: shortPlaceName(provinceName || '') })
  if (kind === 'remote') return m.candidate_nearby_group_remote()
  return null
}

export function NearbyPickPrompt() {
  return (
    <div className="nearby-empty">
      <EnvironmentOutlined className="nearby-empty__icon" aria-hidden />
      <h2>{m.candidate_nearby_pick_title()}</h2>
      <p>{m.candidate_nearby_pick_text()}</p>
    </div>
  )
}

export default function NearbyResults({
  jobs,
  count,
  radius,
  placeLabel,
  provinceName,
  page,
  loading,
  error,
  expandSuggestion,
  highlightedSlugs,
  onHover,
  onPageChange,
  onExpand,
}) {
  if (loading) {
    return (
      <div className="nearby-results">
        {[0, 1, 2].map((key) => <Skeleton key={key} active avatar paragraph={{ rows: 2 }} className="nearby-card" />)}
      </div>
    )
  }
  if (error) return <div className="nearby-empty"><p>{m.candidate_nearby_load_failed()}</p></div>
  if (!count) {
    return (
      <div className="nearby-empty">
        <h2>{m.candidate_nearby_empty_title({ radius })}</h2>
        <p>{m.candidate_nearby_empty_text()}</p>
        {expandSuggestion && (
          <Button type="primary" onClick={() => onExpand(expandSuggestion.radius_km)}>
            {m.candidate_nearby_expand({ radius: expandSuggestion.radius_km, count: expandSuggestion.count })}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="nearby-results">
      <p className="nearby-results__summary" aria-live="polite">
        <strong>{m.candidate_nearby_result_jobs({ count })}</strong>
        {' '}{m.candidate_nearby_result_within({ radius })}{' '}
        <strong>{placeLabel}</strong>
      </p>
      {jobs.map((job, index) => {
        const heading = job.match_kind !== jobs[index - 1]?.match_kind && groupHeading(job.match_kind, provinceName)
        return (
          <Fragment key={job.public_id}>
            {heading && <h3 className="nearby-results__group">{heading}</h3>}
            <NearbyJobCard job={job} active={highlightedSlugs.has(job.slug)} onHover={onHover} />
          </Fragment>
        )
      })}
      {count > PAGE_SIZE && (
        <Pagination
          className="nearby-results__pagination"
          current={page}
          pageSize={PAGE_SIZE}
          total={count}
          showSizeChanger={false}
          onChange={onPageChange}
          size="small"
        />
      )}
    </div>
  )
}
