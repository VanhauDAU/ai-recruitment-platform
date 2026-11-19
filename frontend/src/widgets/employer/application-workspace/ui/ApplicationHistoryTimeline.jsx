import { Alert, Skeleton } from 'antd'
import { APPLICATION_STATUS_TONES, RECRUITER_APPLICATION_STATUS_LABELS } from '@/entities/application/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { formatDateTime } from '@/shared/lib/date-time'
import { m } from '@/shared/config/i18n'

function noticeText(notice) {
  if (!notice) return null
  if (notice.state === 'delivered') {
    const delivered = m.employer_workspace_app_notice_delivered({ date: formatDateTime(notice.delivered_at) })
    return notice.email_sent_at ? `${delivered} · ${m.employer_workspace_app_notice_email_sent()}` : delivered
  }
  if (notice.state === 'scheduled') return m.employer_workspace_app_notice_scheduled({ date: formatDateTime(notice.deliver_at) })
  if (notice.state === 'superseded') return m.employer_workspace_app_notice_superseded()
  return m.employer_workspace_app_notice_reverted()
}

export default function ApplicationHistoryTimeline({ items, loading, error, onRetry }) {
  if (loading) return <Skeleton active paragraph={{ rows: 4 }} />
  if (error) {
    return (
      <Alert
        showIcon
        type="warning"
        message={m.employer_workspace_app_history_load_error()}
        description={getApiErrorMessage(error, m.employer_workspace_try_again())}
        action={<button type="button" className="font-semibold text-amber-700" onClick={onRetry}>{m.employer_workspace_retry()}</button>}
      />
    )
  }
  if (!items.length) return <p className="text-xs text-slate-400">{m.employer_workspace_app_history_empty()}</p>

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
              {formatDateTime(item.created_at)} · {item.changed_by_name || m.employer_workspace_app_system()}
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
