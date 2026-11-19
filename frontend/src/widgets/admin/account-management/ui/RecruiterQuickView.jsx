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
          <strong>{account.full_name || 'Chưa cập nhật họ tên'}</strong>
          <span>{account.email}</span>
          <span>{account.phone || 'Chưa có số điện thoại'}</span>
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
        <Fact label="Công ty">
          {context.company ? `${context.company.name}${context.company.tax_code ? ` · MST ${context.company.tax_code}` : ''}` : 'Chưa liên kết'}
        </Fact>
        <Fact label="Vai trò">
          {[context.company_role_label, context.position_title].filter(Boolean).join(' · ') || 'Chưa khai báo'}
        </Fact>
        <Fact label="Xác thực">
          {verification.status_label || 'Chưa nộp'}
          {waiting ? ` · chờ ${formatElapsed(verification.submitted_at)}` : ''}
        </Fact>
        <Fact label="Bước còn thiếu">{verification.status === 'approved' ? 'Không' : verification.missing_step_count ?? 10}</Fact>
        <Fact label="Email">{account.email_verified ? 'Đã xác minh' : 'Chưa xác minh'}</Fact>
        <Fact label="Điện thoại">{context.phone_verified ? 'Đã xác minh' : 'Chưa xác minh'}</Fact>
        <Fact label="Phiên đang mở">{account.active_session_count ?? 0}</Fact>
        <Fact label="Hoạt động gần nhất">{formatAdminDate(account.last_activity_at || account.last_login)}</Fact>
        <Fact label="Tham gia">{formatAdminDate(account.date_joined)}</Fact>
      </dl>

      <section className="recruiter-quick__activity" aria-label="Hoạt động gần đây">
        <div className="recruiter-quick__activity-head">
          <h3>Hoạt động gần đây</h3>
          <Link to={recruiterActionHref(account.public_id, { tab: 'activity' })} state={originState}>
            Xem toàn bộ
          </Link>
        </div>
        <AccountActivityTimeline compact publicId={account.public_id} />
      </section>
    </div>
  )
}
