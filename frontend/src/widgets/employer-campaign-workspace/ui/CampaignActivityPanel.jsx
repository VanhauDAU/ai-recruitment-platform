import { ArrowRightOutlined, CalendarOutlined, FileTextOutlined, HistoryOutlined, TeamOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Empty, Pagination, Select, Skeleton } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { campaignKeys, getCampaignActivities } from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'

const REPORT_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const GROUP_STYLES = {
  campaign: [HistoryOutlined, 'Chiến dịch', 'bg-violet-50 text-violet-700 ring-violet-100', 'bg-violet-100 text-violet-700 ring-violet-200'],
  job: [FileTextOutlined, 'Tin tuyển dụng', 'bg-sky-50 text-sky-700 ring-sky-100', 'bg-sky-100 text-sky-700 ring-sky-200'],
  application: [TeamOutlined, 'Ứng viên', 'bg-emerald-50 text-emerald-700 ring-emerald-100', 'bg-emerald-100 text-emerald-700 ring-emerald-200'],
}

const FALLBACK_STYLE = [HistoryOutlined, 'Hoạt động', 'bg-slate-100 text-slate-600 ring-slate-200', 'bg-slate-100 text-slate-600 ring-slate-200']

const STATUS_LABELS = {
  campaign: { draft: 'Chưa khởi động', active: 'Đang mở', paused: 'Đang tắt', completed: 'Hoàn tất', cancelled: 'Đã hủy' },
  job: { draft: 'Nháp', pending: 'Chờ duyệt', active: 'Đang tuyển', closed: 'Đã đóng', rejected: 'Từ chối' },
  application: { submitted: 'Tiếp nhận', viewed: 'Đã xem', considering: 'Cân nhắc', shortlisted: 'Phù hợp', interviewed: 'Phỏng vấn', accepted: 'Đã nhận offer', rejected: 'Từ chối' },
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
    return [metadata.candidate_name, metadata.job_title].filter(Boolean).join(' · ')
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

function StatusTransition({ activity }) {
  const metadata = activity.metadata || {}
  if (metadata.from_status === undefined && metadata.to_status === undefined) return null
  const from = statusLabel(activity.group, metadata.from_status, { initial: true })
  const to = statusLabel(activity.group, metadata.to_status)

  return (
    <div aria-label={`Chuyển trạng thái từ ${from} sang ${to}`} className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">{from}</span>
      <ArrowRightOutlined className="text-slate-300" aria-hidden />
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">{to}</span>
    </div>
  )
}

function ActivityMetadata({ activity }) {
  const metadata = activity.metadata || {}
  const reason = readableReason(metadata.reason)
  const hasTransition = metadata.from_status !== undefined || metadata.to_status !== undefined
  if (!hasTransition && !metadata.status && !metadata.deadline && !reason) return null

  return (
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <StatusTransition activity={activity} />
      {metadata.status && (
        <p className="text-xs text-slate-500">
          Trạng thái: <strong className="font-semibold text-slate-700">
            {statusLabel(activity.group, metadata.status)}
          </strong>
        </p>
      )}
      {metadata.deadline && (
        <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <CalendarOutlined className="text-sky-600" aria-hidden />
          Hạn mới: <strong className="font-semibold text-slate-700">{formatDate(metadata.deadline)}</strong>
        </p>
      )}
      {reason && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          <strong>Lý do:</strong> {reason}
        </p>
      )}
    </div>
  )
}

function ActivityCard({ activity, publicId }) {
  const [Icon, groupLabel, badgeClass, iconClass] = GROUP_STYLES[activity.group] || FALLBACK_STYLE
  const description = activityText(activity)
  const link = activityLink(publicId, activity)
  const actorName = typeof activity.actor_name === 'string' && activity.actor_name.trim()
    ? activity.actor_name.trim()
    : 'Hệ thống'

  return (
    <article className="group relative flex gap-3 sm:gap-4">
      <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-4 ring-white ${iconClass}`}>
        <Icon aria-hidden />
      </span>
      <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition group-hover:-translate-y-0.5 group-hover:border-slate-300 group-hover:shadow-md sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-sm font-bold text-slate-800 sm:text-base">
                {activity.event_label || activity.event_type || 'Hoạt động chiến dịch'}
              </strong>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badgeClass}`}>
                {activity.group_label || groupLabel}
              </span>
            </div>
            {description && (
              link
                ? <Link to={link} className="mt-2 block text-sm font-semibold !text-emerald-700 hover:underline">{description}</Link>
                : <p className="mt-2 text-sm font-medium text-slate-600">{description}</p>
            )}
          </div>
          <time dateTime={activity.occurred_at || undefined} className="shrink-0 text-xs font-medium text-slate-400">
            {formatTime(activity.occurred_at)}
          </time>
        </div>
        <ActivityMetadata activity={activity} />
        <p className="mt-3 text-xs text-slate-400">
          Thực hiện bởi <span className="font-medium text-slate-600">{actorName}</span>
        </p>
      </div>
    </article>
  )
}

export default function CampaignActivityPanel({ publicId }) {
  const [group, setGroup] = useState('')
  const [page, setPage] = useState(1)
  const params = {
    page,
    ...(group ? { group } : {}),
  }
  const query = useQuery({
    queryKey: campaignKeys.activities(publicId, params),
    queryFn: () => getCampaignActivities(publicId, params),
  })
  const pageData = query.data || { count: 0, results: [] }
  const dayGroups = groupByDay(pageData.results || [])

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
            Dòng thời gian
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">Lịch sử hoạt động</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
            Theo dõi thay đổi của chiến dịch, tin tuyển dụng và hồ sơ ứng viên theo từng ngày.
          </p>
        </div>
        <div className="w-full sm:w-56">
          <label className="mb-1.5 block text-xs font-semibold text-slate-500" htmlFor="campaign-activity-group">
            Nhóm hoạt động
          </label>
          <Select
            id="campaign-activity-group"
            aria-label="Lọc nhóm hoạt động"
            value={group}
            className="w-full"
            options={[
              { value: '', label: 'Tất cả hoạt động' },
              { value: 'campaign', label: 'Chiến dịch' },
              { value: 'job', label: 'Tin tuyển dụng' },
              { value: 'application', label: 'Ứng viên' },
            ]}
            onChange={(value) => {
              setGroup(value)
              setPage(1)
            }}
          />
        </div>
      </div>

      {query.isError ? (
        <Alert
          type="error"
          showIcon
          message="Không thể tải lịch sử hoạt động"
          description={getApiErrorMessage(query.error, 'Vui lòng thử lại sau.')}
          action={(
            <button
              type="button"
              className="font-semibold text-red-700"
              onClick={() => query.refetch()}
            >
              Thử lại
            </button>
          )}
        />
      ) : query.isLoading ? (
        <div aria-label="Đang tải lịch sử hoạt động" className="space-y-4">
          {[0, 1, 2].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-100 p-5">
              <Skeleton active title={{ width: '34%' }} paragraph={{ rows: 2 }} />
            </div>
          ))}
        </div>
      ) : dayGroups.length ? (
        <>
          <div className="space-y-7">
            {dayGroups.map((day) => (
              <section key={day.key} data-testid={`activity-day-${day.key}`}>
                <div className="mb-3 flex items-center gap-3">
                  <h3 className="text-sm font-bold text-slate-700">{formatDay(day.occurredAt)}</h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                    {day.activities.length} hoạt động
                  </span>
                  <span className="h-px min-w-6 flex-1 bg-slate-100" aria-hidden />
                </div>
                <div className="relative space-y-3 before:absolute before:bottom-5 before:left-5 before:top-5 before:w-px before:bg-slate-200">
                  {day.activities.map((activity) => (
                    <ActivityCard key={activity.id} activity={activity} publicId={publicId} />
                  ))}
                </div>
              </section>
            ))}
          </div>
          {pageData.count > 20 && (
            <div className="mt-7 flex justify-center border-t border-slate-100 pt-5">
              <Pagination
                current={page}
                pageSize={20}
                total={pageData.count}
                showSizeChanger={false}
                responsive
                onChange={setPage}
              />
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-8">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có hoạt động phù hợp" />
        </div>
      )}
    </div>
  )
}
