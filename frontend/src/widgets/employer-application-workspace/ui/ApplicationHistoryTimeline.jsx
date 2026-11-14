import { Alert, Skeleton } from 'antd'
import { APPLICATION_STATUS_TONES, RECRUITER_APPLICATION_STATUS_LABELS } from '@/entities/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { formatDateTime } from '@/shared/lib/date-time'

function noticeText(notice) {
  if (!notice) return null
  if (notice.state === 'delivered') {
    return `Đã báo ứng viên ${formatDateTime(notice.delivered_at)}${notice.email_sent_at ? ' · đã gửi email' : ''}`
  }
  if (notice.state === 'scheduled') return `Sẽ báo ứng viên lúc ${formatDateTime(notice.deliver_at)}`
  if (notice.state === 'superseded') return 'Không gửi: đã thay bằng thay đổi sau'
  return 'Không gửi: đã hoàn tác'
}

export default function ApplicationHistoryTimeline({ items, loading, error, onRetry }) {
  if (loading) return <Skeleton active paragraph={{ rows: 4 }} />
  if (error) {
    return (
      <Alert
        showIcon
        type="warning"
        message="Chưa tải được lịch sử"
        description={getApiErrorMessage(error, 'Vui lòng thử lại.')}
        action={<button type="button" className="font-semibold text-amber-700" onClick={onRetry}>Thử lại</button>}
      />
    )
  }
  if (!items.length) return <p className="text-xs text-slate-400">Chưa có thay đổi trạng thái.</p>

  return (
    <ol className="aw-timeline">
      {[...items].reverse().map((item, index) => {
        const fromLabel = RECRUITER_APPLICATION_STATUS_LABELS[item.from_status]
        const toLabel = RECRUITER_APPLICATION_STATUS_LABELS[item.to_status] || item.to_status
        const notice = noticeText(item.candidate_notice)
        return (
          <li
            key={`${item.created_at}-${item.to_status}-${index}`}
            className={`aw-timeline__item aw-tone-${APPLICATION_STATUS_TONES[item.to_status] || 'slate'}${item.reverted_at ? ' is-reverted' : ''}`}
          >
            <span className="aw-timeline__dot" aria-hidden />
            <div className="aw-timeline__title">{fromLabel ? `${fromLabel} → ${toLabel}` : toLabel}</div>
            <p className="aw-timeline__meta">
              {formatDateTime(item.created_at)} · {item.changed_by_name || 'Hệ thống'}
            </p>
            {notice && (
              <span className={`aw-notice aw-notice--${item.candidate_notice.state}`}>{notice}</span>
            )}
            {item.note && <p className="mt-1 rounded-lg bg-slate-50 p-2 text-[11px] leading-5 text-slate-600">{item.note}</p>}
          </li>
        )
      })}
    </ol>
  )
}
