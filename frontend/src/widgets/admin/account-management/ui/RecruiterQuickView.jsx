import { UserOutlined } from '@ant-design/icons'
import { Avatar } from 'antd'
import { Link } from 'react-router'
import {
  AccountActivityTimeline,
  formatAdminDate,
  NextActionLabel,
  recruiterActionHref,
  recruiterNextAction,
} from '@/entities/account/admin-account'
import { formatElapsed } from '@/shared/lib/date-time'
import { AccountStatusTag } from './AccountStatusTag'
import { m } from '@/shared/config/i18n'

function Fact({ label, children }) {
  return (
    <div className="recruiter-quick__fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** Recruiter triage card: next action first, then the facts needed to act. */
export default function RecruiterQuickView({ account, originState }) {
  const context = account.context || {}
  const verification = context.verification || {}
  const action = recruiterNextAction(account)
  const waiting = ['pending', 'in_review'].includes(verification.status) && verification.submitted_at

  return (
    <div className="recruiter-quick">
      <header className="recruiter-quick__head">
        <Avatar size={48} src={account.avatar_url || undefined} icon={<UserOutlined />} />
        <div className="recruiter-quick__identity">
          <strong>{account.full_name || m.admin_recruiter_no_name()}</strong>
          <span>{account.email}</span>
          <span>{account.phone || m.admin_recruiter_no_phone()}</span>
        </div>
        <AccountStatusTag status={account.status} />
      </header>

      {action && action.tone !== 'none' && (
        <div className={`recruiter-quick__action recruiter-quick__action--${action.tone}`} role="status">
          <NextActionLabel action={action} />
          {action.cta && (
            <Link
              className="recruiter-quick__cta"
              state={originState}
              to={recruiterActionHref(account.public_id, action.cta)}
            >
              {action.cta.label}
            </Link>
          )}
        </div>
      )}

      <dl className="recruiter-quick__facts">
        <Fact label={m.admin_recruiter_company()}>
          {context.company
            ? `${context.company.name}${context.company.tax_code ? ` · ${m.admin_recruiter_tax_code({ code: context.company.tax_code })}` : ''}`
            : m.admin_recruiter_not_linked()}
        </Fact>
        <Fact label={m.admin_recruiter_role()}>
          {[context.company_role_label, context.position_title].filter(Boolean).join(' · ') || m.admin_recruiter_not_declared()}
        </Fact>
        <Fact label={m.admin_recruiter_verification()}>
          {verification.status_label || m.admin_recruiter_not_submitted()}
          {waiting ? ` · ${m.admin_recruiter_waiting({ elapsed: formatElapsed(verification.submitted_at) })}` : ''}
        </Fact>
        <Fact label={m.admin_recruiter_missing_steps()}>
          {verification.status === 'approved' ? m.admin_recruiter_none() : verification.missing_step_count ?? 10}
        </Fact>
        <Fact label="Email">{account.email_verified ? m.admin_recruiter_verified() : m.admin_recruiter_unverified()}</Fact>
        <Fact label={m.admin_recruiter_phone()}>
          {context.phone_verified ? m.admin_recruiter_verified() : m.admin_recruiter_unverified()}
        </Fact>
        <Fact label={m.admin_recruiter_open_sessions()}>{account.active_session_count ?? 0}</Fact>
        <Fact label={m.admin_recruiter_last_activity()}>{formatAdminDate(account.last_activity_at || account.last_login)}</Fact>
        <Fact label={m.admin_recruiter_joined()}>{formatAdminDate(account.date_joined)}</Fact>
      </dl>

      <section className="recruiter-quick__activity" aria-label={m.admin_recruiter_recent_activity()}>
        <div className="recruiter-quick__activity-head">
          <h3>{m.admin_recruiter_recent_activity()}</h3>
          <Link to={recruiterActionHref(account.public_id, { tab: 'activity' })} state={originState}>
            {m.admin_recruiter_view_all()}
          </Link>
        </div>
        <AccountActivityTimeline compact publicId={account.public_id} />
      </section>
    </div>
  )
}
