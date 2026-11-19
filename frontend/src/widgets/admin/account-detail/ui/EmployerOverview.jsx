import { Button } from 'antd'
import { AccountActivityTimeline, formatAdminDate } from '@/entities/account/admin-account'
import { formatElapsed } from '@/shared/lib/date-time'
import { m } from '@/shared/config/i18n'

const COUNT_LABELS = {
  recruitment_needs: m.admin_recruiter_count_needs,
  jobs: m.admin_recruiter_count_jobs,
  campaigns: m.admin_recruiter_count_campaigns,
  verification_documents: m.admin_recruiter_count_documents,
}

function Fact({ label, children }) {
  return (
    <div className="recruiter-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** Employer "Tổng quan": the facts to act on and recent activity first, the full profile below. */
export default function EmployerOverview({ account, profilePanel, onOpenTab }) {
  const context = account.context || {}
  const verification = context.verification || {}
  const waiting = ['pending', 'in_review'].includes(verification.status) && verification.submitted_at
  const counts = account.section_counts || {}

  return (
    <div className="recruiter-overview">
      <div className="recruiter-overview__top" aria-label={m.admin_recruiter_summary_label()} role="group">
        <section className="admin-panel recruiter-overview__card">
          <h3>{m.admin_recruiter_summary()}</h3>
          <dl className="recruiter-facts">
            <Fact label={m.admin_recruiter_company()}>{context.company?.name || m.admin_recruiter_not_linked()}</Fact>
            <Fact label={m.admin_recruiter_role()}>{context.company_role_label || m.admin_recruiter_role_none()}</Fact>
            <Fact label={m.admin_recruiter_verification()}>
              {verification.status_label || m.admin_recruiter_not_submitted()}
              {waiting ? ` · ${m.admin_recruiter_waiting({ elapsed: formatElapsed(verification.submitted_at) })}` : ''}
            </Fact>
            <Fact label="Email">{account.email_verified ? m.admin_recruiter_verified() : m.admin_recruiter_unverified()}</Fact>
            <Fact label={m.admin_recruiter_phone()}>
              {context.phone_verified ? m.admin_recruiter_verified() : m.admin_recruiter_unverified()}
            </Fact>
            <Fact label={m.admin_recruiter_open_sessions()}>{account.active_session_count ?? 0}</Fact>
            <Fact label={m.admin_recruiter_last_login()}>
              {formatAdminDate(account.last_login, m.admin_recruiter_never_signed_in())}
            </Fact>
            <Fact label={m.admin_recruiter_joined()}>{formatAdminDate(account.date_joined)}</Fact>
            {Object.entries(COUNT_LABELS).map(([key, label]) => (
              <Fact key={key} label={label()}>{counts[key] ?? 0}</Fact>
            ))}
          </dl>
        </section>
        <section className="admin-panel recruiter-overview__card">
          <div className="recruiter-overview__card-head">
            <h3>{m.admin_recruiter_recent_activity()}</h3>
            <Button size="small" type="link" onClick={() => onOpenTab('activity')}>{m.admin_recruiter_view_all_activity()}</Button>
          </div>
          <AccountActivityTimeline compact publicId={account.public_id} />
        </section>
      </div>
      {profilePanel}
    </div>
  )
}
