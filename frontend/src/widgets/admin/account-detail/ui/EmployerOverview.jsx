import { Badge, Button, Tag } from 'antd'
import { AccountActivityTimeline, formatAdminDate } from '@/entities/account/admin-account'
import { verificationStatusMeta } from '@/entities/company/admin-employer-verification'
import { formatElapsed } from '@/shared/lib/date-time'
import { m } from '@/shared/config/i18n'
import DetailPanel from './DetailPanel'

function Fact({ label, children }) {
  return (
    <div className="recruiter-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Checked({ ok }) {
  return (
    <Badge
      status={ok ? 'success' : 'warning'}
      text={ok ? m.admin_recruiter_verified() : m.admin_recruiter_unverified()}
    />
  )
}

/** Employer "Tổng quan": profile in the main column, the facts to act on and recent activity in the rail. */
export default function EmployerOverview({ account, profilePanel, onOpenTab }) {
  const context = account.context || {}
  const verification = context.verification || {}
  const waiting = ['pending', 'in_review'].includes(verification.status) && verification.submitted_at

  return (
    <div className="recruiter-overview">
      <DetailPanel className="recruiter-overview__summary" title={m.admin_recruiter_summary()}>
        <dl className="recruiter-facts" aria-label={m.admin_recruiter_summary_label()}>
          <Fact label={m.admin_recruiter_company()}>{context.company?.name || m.admin_recruiter_not_linked()}</Fact>
          <Fact label={m.admin_recruiter_role()}>{context.company_role_label || m.admin_recruiter_role_none()}</Fact>
          <Fact label={m.admin_recruiter_verification()}>
            <Tag color={verificationStatusMeta(verification.status).color}>
              {verification.status_label || m.admin_recruiter_not_submitted()}
            </Tag>
            {waiting && (
              <span className="recruiter-fact__hint">
                {m.admin_recruiter_waiting({ elapsed: formatElapsed(verification.submitted_at) })}
              </span>
            )}
          </Fact>
          <Fact label="Email"><Checked ok={account.email_verified} /></Fact>
          <Fact label={m.admin_recruiter_phone()}><Checked ok={context.phone_verified} /></Fact>
          <Fact label={m.admin_recruiter_last_login()}>
            {formatAdminDate(account.last_login, m.admin_recruiter_never_signed_in())}
          </Fact>
          <Fact label={m.admin_recruiter_joined()}>{formatAdminDate(account.date_joined)}</Fact>
        </dl>
      </DetailPanel>
      <DetailPanel
        className="recruiter-overview__activity"
        title={m.admin_recruiter_recent_activity()}
        extra={(
          <Button size="small" type="link" onClick={() => onOpenTab('activity')}>
            {m.admin_recruiter_view_all_activity()}
          </Button>
        )}
      >
        <AccountActivityTimeline compact publicId={account.public_id} />
      </DetailPanel>
      <div className="recruiter-overview__profile">{profilePanel}</div>
    </div>
  )
}
