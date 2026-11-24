import {
  ACCOUNT_ROLE_LABELS,
  ACCOUNT_STATUS_LABELS,
  accountSubtitle,
  formatAdminDate,
} from '@/entities/account/admin-account'
import { getIntlLocale, m } from '@/shared/config/i18n'
import { AccountIdentity, AccountRowActions, Stat } from './AccountRowParts'
import { CompanyCell, NextActionCell, VerificationCell } from './RecruiterCells'

// Pill tones map onto `.ws-tone-*` in @/shared/ui/workspace-list/workspace-list.css.
const STATUS_TONES = { active: 'emerald', pending: 'sky', inactive: 'orange', banned: 'red' }
const ROLE_TONES = { admin: 'violet', candidate: 'cyan', employer: 'sky' }

function StatusPill({ status }) {
  return <span className={`ws-pill ws-tone-${STATUS_TONES[status] || 'slate'}`}>{ACCOUNT_STATUS_LABELS[status] || status}</span>
}

function DateCell({ value, empty }) {
  if (!value) return <span className="ws-caption ws-muted">{empty}</span>
  const date = new Date(value)
  return (
    <>
      <span className="ws-strong ws-strong--sm">{new Intl.DateTimeFormat(getIntlLocale(), { dateStyle: 'short' }).format(date)}</span>
      <span className="ws-caption ws-muted">{new Intl.DateTimeFormat(getIntlLocale(), { timeStyle: 'short' }).format(date)}</span>
    </>
  )
}

function lastActivity(row) {
  return row.last_activity_at
    ? m.admin_account_list_active_at({ date: formatAdminDate(row.last_activity_at) })
    : m.admin_account_list_never_active()
}

/** One row of the account list; `recruiter` swaps in the recruiter columns. */
export default function AccountListRow({ row, recruiter = false, originState, actions }) {
  if (recruiter) {
    const meta = [
      row.context?.position_title,
      row.context?.company_role_label,
      m.admin_account_list_joined_at({ date: formatAdminDate(row.date_joined) }),
    ].filter(Boolean).join(' · ')
    return (
      <article data-testid={`admin-account-row-${row.public_id}`} className="wt-row">
        <div className="wt-cell wt-cell--main">
          <AccountIdentity row={row} meta={meta} onQuickView={actions.onQuickView} />
        </div>
        <Stat label={m.admin_recruiter_list_col_next()}>
          <NextActionCell row={row} originState={originState} />
        </Stat>
        <Stat label={m.admin_recruiter_list_col_verification()}>
          <VerificationCell verification={row.context?.verification} />
        </Stat>
        <Stat label={m.admin_recruiter_list_col_company()}>
          <CompanyCell company={row.context?.company} />
        </Stat>
        <Stat label={m.admin_recruiter_list_col_account()}>
          <StatusPill status={row.status} />
          <span className="ws-caption ws-muted">{lastActivity(row)}</span>
        </Stat>
        <AccountRowActions row={row} {...actions} />
      </article>
    )
  }

  return (
    <article data-testid={`admin-account-row-${row.public_id}`} className="wt-row">
      <div className="wt-cell wt-cell--main">
        <AccountIdentity row={row} meta={row.public_id} onQuickView={actions.onQuickView} />
      </div>
      <Stat label={m.admin_account_list_col_role()}>
        <span className={`ws-pill ws-tone-${ROLE_TONES[row.role] || 'slate'}`}>{ACCOUNT_ROLE_LABELS[row.role] || row.role}</span>
        <span className="ws-caption ws-muted aml-truncate">{accountSubtitle(row)}</span>
      </Stat>
      <Stat label={m.admin_account_list_col_status()}>
        <StatusPill status={row.status} />
        <span className={`ws-caption${row.email_verified ? ' ws-muted' : ' aml-warn'}`}>
          {row.email_verified ? m.admin_account_list_email_verified() : m.admin_account_list_email_unverified()}
        </span>
      </Stat>
      <Stat label={m.admin_account_list_col_activity()}>
        <DateCell value={row.last_activity_at} empty={m.admin_account_list_never_active()} />
      </Stat>
      <Stat label={m.admin_account_list_col_joined()}>
        <DateCell value={row.date_joined} empty={formatAdminDate(null)} />
      </Stat>
      <AccountRowActions row={row} {...actions} />
    </article>
  )
}
