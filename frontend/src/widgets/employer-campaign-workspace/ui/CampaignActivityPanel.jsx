import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Empty, Pagination, Skeleton } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { RECRUITER_APPLICATION_STATUS_LABELS } from '@/entities/application'
import { CAMPAIGN_STATUS_LABELS, campaignKeys, getCampaignActivities } from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'

const REPORT_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const STATUS_LABELS = {
  campaign: CAMPAIGN_STATUS_LABELS,
  job: { draft: 'Nháp', pending: 'Chờ duyệt', active: 'Đang tuyển', closed: 'Ngừng tuyển', rejected: 'Từ chối' },
  application: RECRUITER_APPLICATION_STATUS_LABELS,
}

const REASON_LABELS = {
  account_status_policy_hold: 'Tạm giữ theo trạng thái tài khoản',
  account_resource_review_completed: 'Đã hoàn tất rà soát tài nguyên tài khoản',
}

const dayFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: REPORT_TIME_ZONE, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: REPORT_TIME_ZONE, hour: '2-digit', minute: '2-digit',
})

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
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
  if (!date) return 'Không rõ ngày'
  const label = dayFormatter.format(date)
  return label.charAt(0).toLocaleUpperCase('vi-VN') + label.slice(1)
}

function formatTime(value) {
  const date = parseDate(value)
  return date ? timeFormatter.format(date) : 'Không rõ giờ'
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
  if (!value) return initial ? 'Khởi tạo' : 'Không xác định'
  return STATUS_LABELS[group]?.[value] || value
}

function readableReason(value) {
  if (!value) return ''
  if (REASON_LABELS[value]) return REASON_LABELS[value]
  if (!value.includes('_')) return value
  const text = value.replaceAll('_', ' ')
  return text.charAt(0).toLocaleUpperCase('vi-VN') + text.slice(1)
}

function activityText(activity) {
  const metadata = activity.metadata || {}
  if (activity.group === 'job') return metadata.title || 'Tin tuyển dụng'
  if (activity.group === 'application') {
    return [metadata.candidate_name, metadata.job_title].filter(Boolean).join(', ')
      || 'Hồ sơ ứng viên'
  }
  return metadata.label || metadata.name || ''
}

function activityLink(publicId, activity) {
  if (!activity.subject_public_id) return null
  if (activity.group === 'job') {
    return employerAppPath(`/jobs/${activity.subject_public_id}`)
  }
  if (activity.group === 'application') {
    return employerAppPath(`/applications?campaign=${publicId}&application=${activity.subject_public_id}`)
  }
  return null
}

const GROUPS = [
  { value: '', label: 'Tất cả' },
  { value: 'campaign', label: 'Chiến dịch' },
  { value: 'job', label: 'Tin tuyển dụng' },
  { value: 'application', label: 'Ứng viên' },
]

// Dòng phụ ngắn: đổi trạng thái, hạn mới, lý do và người thực hiện.
function ActivityDetails({ activity }) {
  const metadata = activity.metadata || {}
  const reason = readableReason(metadata.reason)
  const actor = typeof activity.actor_name === 'string' && activity.actor_name.trim() ? activity.actor_name.trim() : 'Hệ thống'
  const moved = metadata.from_status !== undefined || metadata.to_status !== undefined
  const from = statusLabel(activity.group, metadata.from_status, { initial: true })
  const to = statusLabel(activity.group, metadata.to_status)

  return (
    <p className="cwa-item__meta">
      {moved && (
        <span className="cwa-move" aria-label={`Chuyển trạng thái từ ${from} sang ${to}`}>
          {from} <span aria-hidden>→</span> <strong>{to}</strong>
        </span>
      )}
      {metadata.status && !moved && <span>Trạng thái <strong>{statusLabel(activity.group, metadata.status)}</strong></span>}
      {metadata.deadline && <span>Hạn mới <strong>{formatDate(metadata.deadline)}</strong></span>}
      {reason && <span className="cwa-reason">{reason}</span>}
      <span>bởi {actor}</span>
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
          <strong>{activity.event_label || activity.event_type || 'Hoạt động chiến dịch'}</strong>
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
        <h2 className="cw-section-title">Lịch sử hoạt động</h2>
        <div className="cwa-filter" role="group" aria-label="Lọc nhóm hoạt động">
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
          message="Không thể tải lịch sử hoạt động"
          description={getApiErrorMessage(query.error, 'Vui lòng thử lại sau.')}
          action={<Button size="small" danger onClick={() => query.refetch()}>Thử lại</Button>}
        />
      ) : query.isLoading ? (
        <div aria-label="Đang tải lịch sử hoạt động"><Skeleton active paragraph={{ rows: 6 }} /></div>
      ) : dayGroups.length ? (
        <>
          {dayGroups.map((day) => (
            <section key={day.key} className="cwa-day" data-testid={`activity-day-${day.key}`}>
              <h3 className="cwa-day__label">
                {formatDay(day.occurredAt)}
                <span>{day.activities.length} hoạt động</span>
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
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có hoạt động phù hợp" />
      )}
    </div>
  )
}
