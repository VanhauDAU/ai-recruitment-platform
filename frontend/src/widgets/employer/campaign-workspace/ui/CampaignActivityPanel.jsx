import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Empty, Pagination, Skeleton } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { RECRUITER_APPLICATION_STATUS_LABELS } from '@/entities/application/application'
import { CAMPAIGN_STATUS_LABELS, campaignKeys, getCampaignActivities } from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'
import { getIntlLocale, m } from '@/shared/config/i18n'

const REPORT_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const STATUS_LABELS = {
  campaign: CAMPAIGN_STATUS_LABELS,
  job: {
    draft: m.employer_campaign_jobs_status_draft(),
    pending: m.employer_campaign_activity_job_pending(),
    active: m.employer_campaign_jobs_status_active(),
    closed: m.employer_campaign_jobs_status_closed(),
    rejected: m.employer_campaign_activity_job_rejected(),
  },
  application: RECRUITER_APPLICATION_STATUS_LABELS,
}

const REASON_LABELS = {
  account_status_policy_hold: m.employer_campaign_activity_reason_policy_hold(),
  account_resource_review_completed: m.employer_campaign_activity_reason_review_completed(),
}

const dayFormatter = new Intl.DateTimeFormat(getIntlLocale(), {
  timeZone: REPORT_TIME_ZONE, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat(getIntlLocale(), {
  timeZone: REPORT_TIME_ZONE, hour: '2-digit', minute: '2-digit',
})

const dateFormatter = new Intl.DateTimeFormat(getIntlLocale(), {
  timeZone: REPORT_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric',
})

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
})

function parseDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateKey(value) {
  const date = parseDate(value)
  if (!date) return 'unknown'
  const parts = dateKeyFormatter.formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function formatDay(value) {
  const date = parseDate(value)
  if (!date) return m.employer_campaign_activity_unknown_day()
  const label = dayFormatter.format(date)
  return label.charAt(0).toLocaleUpperCase(getIntlLocale()) + label.slice(1)
}

function formatTime(value) {
  const date = parseDate(value)
  return date ? timeFormatter.format(date) : m.employer_campaign_activity_unknown_time()
}

function formatDate(value) {
  const date = parseDate(value)
  return date ? dateFormatter.format(date) : String(value || '—')
}

function groupByDay(activities) {
  const groups = new Map()
  activities.forEach((activity) => {
    const key = dateKey(activity.occurred_at)
    if (!groups.has(key)) groups.set(key, { key, occurredAt: activity.occurred_at, activities: [] })
    groups.get(key).activities.push(activity)
  })
  return Array.from(groups.values())
}

function statusLabel(group, value, { initial = false } = {}) {
  if (!value) return initial ? m.employer_campaign_activity_initial() : m.employer_campaign_activity_unknown()
  return STATUS_LABELS[group]?.[value] || value
}

function readableReason(value) {
  if (!value) return ''
  if (REASON_LABELS[value]) return REASON_LABELS[value]
  if (!value.includes('_')) return value
  const text = value.replaceAll('_', ' ')
  return text.charAt(0).toLocaleUpperCase(getIntlLocale()) + text.slice(1)
}

function activityText(activity) {
  const metadata = activity.metadata || {}
  if (activity.group === 'job') return metadata.title || m.employer_campaign_activity_job_fallback()
  if (activity.group === 'application') {
    return [metadata.candidate_name, metadata.job_title].filter(Boolean).join(', ')
      || m.employer_campaign_activity_application_fallback()
  }
  return metadata.label || metadata.name || ''
}

function activityLink(publicId, activity) {
  if (!activity.subject_public_id) return null
  if (activity.group === 'job') {
    return employerAppPath(`/tin-tuyen-dung/${activity.subject_public_id}`)
  }
  if (activity.group === 'application') {
    return employerAppPath(`/ho-so-ung-tuyen?campaign=${publicId}&application=${activity.subject_public_id}`)
  }
  return null
}

const GROUPS = [
  { value: '', label: m.employer_campaign_activity_group_all() },
  { value: 'campaign', label: m.employer_campaign_activity_group_campaign() },
  { value: 'job', label: m.employer_campaign_activity_group_job() },
  { value: 'application', label: m.employer_campaign_activity_group_application() },
]

// Dòng phụ ngắn: đổi trạng thái, hạn mới, lý do và người thực hiện.
function ActivityDetails({ activity }) {
  const metadata = activity.metadata || {}
  const reason = readableReason(metadata.reason)
  const actor = typeof activity.actor_name === 'string' && activity.actor_name.trim() ? activity.actor_name.trim() : m.employer_campaign_activity_system()
  const moved = metadata.from_status !== undefined || metadata.to_status !== undefined
  const from = statusLabel(activity.group, metadata.from_status, { initial: true })
  const to = statusLabel(activity.group, metadata.to_status)

  return (
    <p className="cwa-item__meta">
      {moved && (
        <span className="cwa-move" aria-label={m.employer_campaign_activity_move_aria({ from, to })}>
          {from} <span aria-hidden>→</span> <strong>{to}</strong>
        </span>
      )}
      {metadata.status && !moved && <span>{m.employer_campaign_activity_status()} <strong>{statusLabel(activity.group, metadata.status)}</strong></span>}
      {metadata.deadline && <span>{m.employer_campaign_activity_new_deadline()} <strong>{formatDate(metadata.deadline)}</strong></span>}
      {reason && <span className="cwa-reason">{reason}</span>}
      <span>{m.employer_campaign_activity_by({ actor })}</span>
    </p>
  )
}

function ActivityItem({ activity, publicId }) {
  const description = activityText(activity)
  const link = activityLink(publicId, activity)

  return (
    <li className={`cwa-item is-${activity.group || 'other'}`}>
      <time className="cwa-item__time" dateTime={activity.occurred_at || undefined}>{formatTime(activity.occurred_at)}</time>
      <span className="cwa-item__dot" aria-hidden />
      <div className="cwa-item__body">
        <p className="cwa-item__title">
          <strong>{activity.event_label || activity.event_type || m.employer_campaign_activity_fallback()}</strong>
          {description && (link
            ? <Link to={link} className="cwa-item__subject">{description}</Link>
            : <span className="cwa-item__subject">{description}</span>)}
        </p>
        <ActivityDetails activity={activity} />
      </div>
    </li>
  )
}

export default function CampaignActivityPanel({ publicId }) {
  const [group, setGroup] = useState('')
  const [page, setPage] = useState(1)
  const params = { page, ...(group ? { group } : {}) }
  const query = useQuery({
    queryKey: campaignKeys.activities(publicId, params),
    queryFn: () => getCampaignActivities(publicId, params),
  })
  const pageData = query.data || { count: 0, results: [] }
  const dayGroups = groupByDay(pageData.results || [])

  return (
    <div className="cwa">
      <div className="cwa-head">
        <h2 className="cw-section-title">{m.employer_campaign_activity_title()}</h2>
        <div className="cwa-filter" role="group" aria-label={m.employer_campaign_activity_filter_aria()}>
          {GROUPS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={group === item.value}
              className={`cwa-filter__item ${group === item.value ? 'is-on' : ''}`}
              onClick={() => {
                setGroup(item.value)
                setPage(1)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {query.isError ? (
        <Alert
          type="error"
          showIcon
          message={m.employer_campaign_activity_load_error()}
          description={getApiErrorMessage(query.error, m.employer_campaign_try_again_later())}
          action={<Button size="small" danger onClick={() => query.refetch()}>{m.employer_campaign_retry()}</Button>}
        />
      ) : query.isLoading ? (
        <div aria-label={m.employer_campaign_activity_loading()}><Skeleton active paragraph={{ rows: 6 }} /></div>
      ) : dayGroups.length ? (
        <>
          {dayGroups.map((day) => (
            <section key={day.key} className="cwa-day" data-testid={`activity-day-${day.key}`}>
              <h3 className="cwa-day__label">
                {formatDay(day.occurredAt)}
                <span>{m.employer_campaign_activity_count({ count: day.activities.length })}</span>
              </h3>
              <ol className="cwa-list">
                {day.activities.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} publicId={publicId} />
                ))}
              </ol>
            </section>
          ))}
          {pageData.count > 20 && (
            <div className="cwa-pages">
              <Pagination current={page} pageSize={20} total={pageData.count} showSizeChanger={false} size="small" responsive onChange={setPage} />
            </div>
          )}
        </>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.employer_campaign_activity_empty()} />
      )}
    </div>
  )
}
