import { RECRUITER_APPLICATION_STATUS_LABELS } from '@/entities/application'
import { STATUS_BADGE_CLASSES } from '../model/application-workspace'

export default function ApplicationStatusBadge({ status, className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-bold leading-5 ${STATUS_BADGE_CLASSES[status] || STATUS_BADGE_CLASSES.rejected} ${className}`}
    >
      {RECRUITER_APPLICATION_STATUS_LABELS[status] || status || 'Chưa rõ'}
    </span>
  )
}
