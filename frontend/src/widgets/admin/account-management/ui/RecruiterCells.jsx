import { Link } from 'react-router'
import {
  NextActionLabel,
  recruiterActionHref,
  recruiterNextAction,
} from '@/entities/account/admin-account'
import { formatElapsed } from '@/shared/lib/date-time'

const VERIFICATION_TONES = {
  approved: 'good',
  rejected: 'critical',
  changes_requested: 'warning',
  in_review: 'info',
  pending: 'warning',
  revoked: 'critical',
  expired: 'warning',
}
const WAITING_STATUSES = new Set(['pending', 'in_review'])

export function CompanyCell({ company }) {
  if (!company) return <span className="recruiter-cell__muted">Chưa liên kết công ty</span>
  return (
    <span className="recruiter-cell">
      <strong className="recruiter-cell__title" title={company.name}>{company.name}</strong>
      <span className="recruiter-cell__sub" translate="no">{company.tax_code ? `MST ${company.tax_code}` : 'Chưa có MST'}</span>
    </span>
  )
}

export function VerificationCell({ verification }) {
  const status = verification?.status || 'draft'
  const waiting = WAITING_STATUSES.has(status) && verification?.submitted_at
  return (
    <span className="recruiter-cell">
      <span className={`recruiter-status recruiter-status--${VERIFICATION_TONES[status] || 'muted'}`}>
        {verification?.status_label || 'Chưa nộp'}
      </span>
      <span className="recruiter-cell__sub">
        {waiting
          ? `Chờ ${formatElapsed(verification.submitted_at)}`
          : status === 'approved' ? 'Đủ điều kiện' : `${verification?.missing_step_count ?? 10} bước còn thiếu`}
      </span>
    </span>
  )
}

export function NextActionCell({ row, originState }) {
  const action = recruiterNextAction(row)
  if (!action || action.tone === 'none') return <span className="recruiter-cell__muted">Không có việc cần làm</span>
  return (
    <span className="recruiter-next">
      <NextActionLabel action={action} />
      {action.cta && (
        <Link className="recruiter-next__cta" state={originState} to={recruiterActionHref(row.public_id, action.cta)}>
          {action.cta.label}
        </Link>
      )}
    </span>
  )
}

