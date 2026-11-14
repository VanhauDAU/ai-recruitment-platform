import { APPLICATION_STATUS_TONES, RECRUITER_APPLICATION_STATUS_LABELS } from '@/entities/application'

export default function ApplicationStatusBadge({ status }) {
  return (
    <span className={`aw-badge aw-tone-${APPLICATION_STATUS_TONES[status] || 'slate'}`}>
      {RECRUITER_APPLICATION_STATUS_LABELS[status] || status || 'Chưa rõ'}
    </span>
  )
}
