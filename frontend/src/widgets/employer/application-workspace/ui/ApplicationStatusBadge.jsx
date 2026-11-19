import { APPLICATION_STATUS_TONES, RECRUITER_APPLICATION_STATUS_LABELS } from '@/entities/application/application'
import { m } from '@/shared/config/i18n'

export default function ApplicationStatusBadge({ status }) {
  return (
    <span className={`aw-badge aw-tone-${APPLICATION_STATUS_TONES[status] || 'slate'}`}>
      {RECRUITER_APPLICATION_STATUS_LABELS[status] || status || m.employer_workspace_app_status_unknown()}
    </span>
  )
}
