import { Alert } from 'antd'
import { m } from '@/shared/config/i18n'

const LIFECYCLE_COPY = {
  revoked: {
    title: m.employer_account_lifecycle_revoked_title(),
    consequence: m.employer_account_lifecycle_locked(),
  },
  expired: {
    title: m.employer_account_lifecycle_expired_title(),
    consequence: m.employer_account_lifecycle_locked(),
  },
}

export default function EmployerVerificationLifecycleAlert({
  verificationCase,
  className = '',
}) {
  const copy = LIFECYCLE_COPY[verificationCase?.status]
  if (!copy) return null
  const reason = verificationCase?.decision_reason?.trim()

  return (
    <Alert
      className={className}
      showIcon
      type="error"
      title={copy.title}
      description={(
        <div className="space-y-1">
          <p>{copy.consequence} {m.employer_account_lifecycle_resubmit()}</p>
          {reason && <p><strong>{m.employer_account_lifecycle_reason()}</strong> {reason}</p>}
          <p>
            {m.employer_account_lifecycle_note()}
          </p>
        </div>
      )}
    />
  )
}
