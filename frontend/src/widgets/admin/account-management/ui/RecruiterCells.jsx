import { Link } from 'react-router'
import {
  NextActionLabel,
  recruiterActionHref,
  recruiterNextAction,
} from '@/entities/account/admin-account'
import { formatElapsed } from '@/shared/lib/date-time'

// Verification status → `.ws-tone-*` dot of a calm workspace pill.
const VERIFICATION_TONES = {
  approved: 'emerald',
  rejected: 'red',
  changes_requested: 'orange',
  in_review: 'sky',
  pending: 'amber',
  revoked: 'red',
  expired: 'orange',
}
const WAITING_STATUSES = new Set(['pending', 'in_review'])

export function CompanyCell({ company }) {
  if (!company) return <span className="ws-caption ws-muted">Chưa liên kết công ty</span>
  return (
    <>
      <strong className="ws-strong ws-strong--sm aml-truncate" title={company.name}>{company.name}</strong>
      <span className="ws-caption ws-muted" translate="no">{company.tax_code ? `MST ${company.tax_code}` : 'Chưa có MST'}</span>
    </>
  )
}

export function VerificationCell({ verification }) {
  const status = verification?.status || 'draft'
  const waiting = WAITING_STATUSES.has(status) && verification?.submitted_at
  return (
    <>
      <span className={`ws-pill ws-tone-${VERIFICATION_TONES[status] || 'slate'}`}>
        {verification?.status_label || 'Chưa nộp'}
      </span>
      <span className="ws-caption ws-muted">
        {waiting
          ? `Chờ ${formatElapsed(verification.submitted_at)}`
          : status === 'approved' ? 'Đủ điều kiện' : `${verification?.missing_step_count ?? 10} bước còn thiếu`}
      </span>
    </>
  )
}

export function NextActionCell({ row, originState }) {
  const action = recruiterNextAction(row)
  if (!action || action.tone === 'none') return <span className="ws-caption ws-muted">Không có việc cần làm</span>
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
