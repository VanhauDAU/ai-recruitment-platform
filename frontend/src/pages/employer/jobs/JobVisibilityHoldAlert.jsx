import { Alert, Button } from 'antd'
import dayjs from '@/shared/lib/dayjs'
import { m } from '@/shared/config/i18n'

const formatTime = (value) => (value && dayjs(value).isValid() ? dayjs(value).format('DD/MM/YYYY HH:mm') : null)

function changeRequestDescription(hold) {
  if (hold.resubmitted_at) {
    return m.employer_job_hold_resubmitted_at({ time: formatTime(hold.resubmitted_at) })
  }
  return m.employer_job_hold_changes_hint()
}

// The employer API sets `visibility_hold` while an administrator or the
// account state keeps a job off the public site.
export default function JobVisibilityHoldAlert({ hold, onResubmit, resubmitting = false }) {
  if (!hold) return null
  const heldAt = formatTime(hold.held_at)
  if (hold.code === 'changes_requested') {
    return (
      <Alert
        type="warning"
        showIcon
        data-testid="job-visibility-hold"
        title={[m.employer_job_hold_changes_requested(), hold.reason_label && m.employer_job_hold_reason({ reason: hold.reason_label })].filter(Boolean).join(' · ')}
        description={(
          <>
            {hold.request_note && <p className="m-0 whitespace-pre-line font-medium text-slate-700">{hold.request_note}</p>}
            <p className="m-0 mt-1">{changeRequestDescription(hold)}</p>
          </>
        )}
        action={hold.editable && onResubmit && (
          <Button type="primary" size="small" loading={resubmitting} onClick={onResubmit}>{m.employer_job_hold_resubmit()}</Button>
        )}
      />
    )
  }
  const headline = hold.kind === 'account'
    ? m.employer_job_hold_account_hold()
    : m.employer_job_hold_admin_hold()
  return (
    <Alert
      type="warning"
      showIcon
      data-testid="job-visibility-hold"
      title={[headline, hold.label, hold.reason_label && m.employer_job_hold_reason({ reason: hold.reason_label })].filter(Boolean).join(' · ')}
      description={heldAt ? m.employer_job_hold_hidden_since({ time: heldAt }) : m.employer_job_hold_hidden()}
    />
  )
}
