import { CheckCircleFilled, ExclamationCircleFilled, InfoCircleFilled } from '@ant-design/icons'
import { Link } from 'react-router'
import {
  employerNotificationTone,
  formatEmployerEventTime,
} from '@/entities/employer-notification'

const TONE_STYLES = {
  success: ['bg-emerald-50 text-emerald-600', CheckCircleFilled],
  warning: ['bg-amber-50 text-amber-600', ExclamationCircleFilled],
  danger: ['bg-red-50 text-red-600', ExclamationCircleFilled],
  info: ['bg-sky-50 text-sky-600', InfoCircleFilled],
}

export default function NotificationItem({ item, compact = false, onOpen }) {
  const [toneClass, Icon] = TONE_STYLES[employerNotificationTone(item.event_type)]
    || TONE_STYLES.info
  const content = (
    <div className={`flex gap-3 ${compact ? 'p-3' : 'p-4'}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${toneClass}`}>
        <Icon aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <strong className="text-sm font-bold text-slate-800">{item.title}</strong>
          {!item.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="Chưa đọc" />}
        </div>
        {item.message && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{item.message}</p>}
        <time className="mt-1.5 block text-[11px] font-medium text-slate-400" dateTime={item.created_at}>
          {formatEmployerEventTime(item.created_at)}
        </time>
      </div>
    </div>
  )
  if (!item.action_path) return content
  return (
    <Link
      to={item.action_path}
      onClick={() => onOpen?.(item)}
      className="block border-b border-slate-100 no-underline transition hover:bg-slate-50 last:border-b-0"
    >
      {content}
    </Link>
  )
}
